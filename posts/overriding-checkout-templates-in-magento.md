---
title: Overriding checkout templates in Magento
description: I recently spent the best part of a day trying to figure out how to replace a single part of a Magento checkout with a custom template. Since I spent most of my time jumping around the internet, I thought I'd collate my findings in this post.
date: 2020-02-28
tags:
  - work
  - magento
layout: post
---
At Focusrite we're currently working on adding a new e-store. We've chosen to use headless Magento that can be accessed via our existing Drupal sites. I recently spent the best part of a day trying to figure out how to replace a single part of a Magento checkout with a custom template.

It took longer than expected: I'm a reasonable Drupal developer, but I've got very little Magento experience. Since I spent most of my time jumping from one StackOverflow post to another MagePlaza documentation page, I thought I'd collate my findings in this post.

### The problem

Customers should not be able to log in on our Magento instance. We'd like to integrate with a fully-formed SSO solution in the future, but the accounts will never live on the Magento site; all checkouts should be, according to Magento, anonymous. But the checkout is designed to work for logged-in customers only. If it finds an email address that matches a customer, it'll ask the customer to enter a password to login. It says they can create an account after checkout.

We didn't want any of these things to happen or appear. Our first thought was that it'd be super-easy to hide the "you can create an account" message using CSS (after all, what's a simple `display: none;` between friends?) but it quickly became apparent - when I was jumping between checkout steps - that this was not all that was needed. 

![Screenshot of the email field on Magento with a login indicator](/img/2020/02/user-create.png)
![Screenshot of the login form on Magento](/img/2020/02/user-login.png)

I needed to not only hide that text, but also to remove the JavaScript functionality that was checking for an account when a user entered their email address. (That it checks and you can't disable it is annoying and possibly a data risk - but that's another topic!)

In order to figure this one out, I needed to find the file(s) that were responsible for this bit of code, and then override them in a custom module. 

> **Important note**: Turns out you can't override the template in your front-end theme, it does have to be a module. This tripped me up for a long while, so I'm pulling that out here so you know!

### Finding where the code comes from

Really simply, I started out by searching within the `magento` directory for the string I knew I needed to get rid of: `You can create an account...`

This threw up the file `module-checkout/view/frontend/web/template/form/element/email.html`, which has this bit in it, at around line 31:

```html
<span class="note" data-bind="fadeVisible: isPasswordVisible() == false"><!-- ko i18n: 'You can create an account after checkout.'--><!-- /ko --></span>
```

As well as some hidden fields that would hold the customer's password. 

I also found a JavaScript file that linked to this template at `module-checkout/view/frontend/web/js/view/form/element/email.js`.

```javascript
return Component.extend({
  defaults: {
    template: 'Magento_Checkout/form/element/email',
    [...]
  }
});
```

So not only do we have to replace the template file, we also need to replace this JavaScript file as well, and update the path in this file to our custom template. Okay! 

### Create the custom module

The Magento documentation is pretty easy to follow with regards creating new modules. Under `app/code/VendorName`, I created a new module, `Checkout`, with the following files in it: 

`registration.php`:

```php 
<?php

\Magento\Framework\Component\ComponentRegistrar::register(
  \Magento\Framework\Component\ComponentRegistrar::MODULE,
  'VendorName_Checkout',
  __DIR__
);

?>
```

`etc/module.xml`:
```xml
<?xml version="1.0"?>

<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="urn:magento:framework:Module/etc/module.xsd">
  <module name="VendorName_Checkout" setup_version="1.0.0" />
</config>
```

This can now be enabled using `bin/magento module:enable VendorName_Checkout`. I wasn't kidding when I said it was a simple module. :-)

Remember to run your normal cache flush/upgrade/dependency injection compile commands between each of these steps.

### Override the layout

We're going to modify the checkout layout, so we need to reference the checkout module's `checkout_index_index.xml` file. This file serves to define the components that exist in the checkout layout - and we are dealing with a component, as per the JavaScript file, which returns `Component.extend...`.

Find the name of the component we're looking for (in this case, `Magento_Checkout/js/view/form/element/email`) in the XML document in `module-checkout/view/frontend/layout/checkout_index_index.xml`, and copy that and all of its parent selectors. It'll go into `app/code/VendorName/view/frontend/layout/checkout_index_index.xml`:

```xml
<?xml version="1.0"?>
<page xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" layout="checkout" xsi:noNamespaceSchemaLocation="urn:magento:framework:View/Layout/etc/page_configuration.xsd">
  <body>
    <referenceBlock name="checkout.root">
      <arguments>
        <argument name="jsLayout" xsi:type="array">
          <item name="components" xsi:type="array">
            <item name="checkout" xsi:type="array">
              <item name="children" xsi:type="array">
                <item name="steps" xsi:type="array">
                  <item name="children" xsi:type="array">
                    <item name="shipping-step" xsi:type="array">
                      <item name="children" xsi:type="array">
                        <item name="shippingAddress" xsi:type="array">
                          <item name="children" xsi:type="array">
                            <item name="customer-email" xsi:type="array">
                              <item name="component" xsi:type="string">VendorName_Checkout/js/view/form/element/email</item>
                            </item>
                          </item>
                        </item>
                      </item>
                    </item>
                  </item>
                </item>
              </item>
            </item>
          </item>
        </argument>
      </arguments>
    </referenceBlock>
  </body>
</page>
```

Note there are a couple of really key changes from the core file: 
* Instead of `<referenceContainer name="content">` as one of the root elements, use `<referenceBlock name="checkout.root">`. This works like overriding a block in a Twig template.
* Change the component to use your module's name. The rest of the path can remain the same.

This will probably cause an error at checkout now, because it can't find the component. So let's create it. 

### Create the component

To override the component we'll need two files. The first (that is referenced in the XML above) is the JavaScript file that will take the place of the `email.js` file used in checkout currently.

Within your module directory, create `view/frontend/web/js/view/form/element/email.js`. The path to this file can technically be anything but I prefer to keep them matched as exactly as possible - there are other times when an exact filepath is needed for overriding, and it'll be much easier to find the file if you have it in the same place in your own module.

This should contain the contents of the `email.js` file we're overriding, with one key change: the `template` line should say `VendorName_Checkout` instead of `Magento_Checkout`.

If you want to make any other changes here, now is your chance. I changed the `emailHasChanged` function so that it allowed the email validation but set the password to invisible: 

```javascript
// Replaced this:
this.emailCheckTimeout = setTimeout(function () {
  if (self.validateEmail()) {
    self.checkEmailAvailability();
  } else {
    self.isPasswordVisible(false);
  }
}, self.checkDelay);

// With this:
self.isPasswordVisible(false);
```

Now if you visit the checkout you'll see a different error: that the template file couldn't be loaded. Time to make the template file. In the same vein as previously, create a template file in your module that follows the same path as the system one, at `view/frontend/template/form/element/email.html`. This file will include any changes to that particular template you want to make. 

In my case I removed the hidden fieldset and removed the line that said a user can create an account. 

![Screenshot of the email field on Magento with no login indicators](/img/2020/02/user-no-create.png)

### In summary 

After finding the file I wanted to replace, I had to create a module to override the template. 

I know the paths can get confusing, so for clarity, my module file structure ended up looking like this:

```
VendorName
|-- Checkout
    |-- registration.php
    |-- etc
    |   `-- module.xml
    `-- view
        `-- frontend
            |-- layout
            |   `-- checkout_index_index.xml
            `-- web
                |-- js
                |   `-- view
                |       `-- form
                |           `-- element
                |               `-- email.js
                `-- template
                    `-- form
                        `-- element
                            `-- email.js
```

Enjoy, and good luck.

### Further reading

* [Create a new module](https://devdocs.magento.com/videos/fundamentals/create-a-new-module/)
* [How to customise a checkout step in Magento 2](https://www.mageplaza.com/devdocs/custom-checkout-component-magento-2.html)
