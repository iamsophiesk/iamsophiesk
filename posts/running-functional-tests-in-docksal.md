---
title: Running functional JavaScript tests in Docksal
description: Running PHPUnit tests in Docksal is straightforward, but we struggled to get Functional JavaScript tests to run within Docksal. Here's how we got them working.
date: 2019-10-16
tags:
  - work
  - docksal
layout: post
---
Testing your work is important, there is absolutely no doubt about it. For a while I've been writing and running PHPUnit tests for Drupal sites that I work on, working mainly with Unit and Kernel tests. With [Docksal](https://docksal.io), I've been able to run Functional tests as well (where I was struggling to get my Docker containers to talk to each other previously). However Functional JavaScript tests were proving an unusual hurdle.

Drupal recommends, in its [tests README file](https://git.drupalcode.org/project/drupal/blob/8.8.x/core/tests/README.md), that you use [Chromedriver](https://sites.google.com/a/chromium.org/chromedriver/) to run these tests, but it wasn't exactly clear how to do that within the Docksal framework.

After wrestling with a number of legacy Composer dependencies I ended up heading to the [Docksal channel on the Drupal Slack](https://app.slack.com/client/T06GX3JTS/C6GPEEEV8) and asking my questions there. Thanks to the help of [Andrew Macpherson](https://www.drupal.org/u/andrewmacpherson) and [J.D. Flynn](https://www.drupal.org/u/dorficus), I was able to figure out what to do.

### Changes to `docksal.yml`

The first thing was to add a new service to the Docksal set up. It's called `browser` but as Andrew pointed out there may be scope to add an extra browser in the future, so something like `chrome` may have made more sense.

This got added to the end of our `docksal.yml` file as another service:

```yaml
browser:
  hostname: browser
  image: selenium/standalone-chrome
  dns:
    - '${DOCKSAL_DNS1}'
    - '${DOCKSAL_DNS2}'
  labels:
    - >-
      io.docksal.virtual-host=browser.${VIRTUAL_HOST},browser.${VIRTUAL_HOST}.*
```

Then run `fin restart` to pick up the change, download the new service and there it was: `http://browser.project.docksal` was up and running.

### Changes to `phpunit.xml`

Tests still weren't running, but J.D. pointed out that I may need to adjust my `phpunit.xml` file. We were using a very pared-back version of core's [`phpunit.xml.dist`](https://git.drupalcode.org/project/drupal/blob/8.8.x/core/phpunit.xml.dist) so I had to check against that. In that file was a variable we weren't using in ours:

```xml
<!-- Example for changing the driver args to webdriver tests MINK_DRIVER_ARGS_WEBDRIVER value: '["chrome", { "chromeOptions": { "w3c": false } }, "http://localhost:4444/wd/hub"]' For using the Firefox browser, replace "chrome" with "firefox" -->
<env name="MINK_DRIVER_ARGS_WEBDRIVER" value=''/>
```

Whew, what a mouthful! But it gave me the pointers I needed to adjust our `phpunit.xml` file to include the following:

```xml
<env name="MINK_DRIVER_ARGS_WEBDRIVER" value='["chrome", { "chromeOptions": { "w3c": false } }, "http://browser.project.docksal/wd/hub"]'/>
```

### The proof is in the pudding

With all that in place I was able to run one of Core's functional JavaScript tests (I have a custom `fin phpunit` command that allows me to put a `phpunit.xml` file outside of core):

```shell
sophie@Belgaer:~/projects/project|functional-js-tests⚡
⇒  fin phpunit docroot/core/modules/node/tests/src/FunctionalJavascript/ContextualLinksTest.php --verbose
PHPUnit 6.5.14 by Sebastian Bergmann and contributors.

Runtime:       PHP 7.3.9
Configuration: /var/www/.docksal/drupal/phpunit.xml

Testing Drupal\Tests\node\FunctionalJavascript\ContextualLinksTest
.                                                                   1 / 1 (100%)

Time: 33.96 seconds, Memory: 6.00MB

OK (1 test, 10 assertions)
```

Job's a good'un!

Thanks again to the lovely folk in the Docksal channel. That community is top-notch :)
