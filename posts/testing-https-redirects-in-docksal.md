---
title: Testing https redirects in Docksal
description: Redirecting http:// to https:// is standard practice, but how do you test that locally if the redirect depends on environment variables and a certain set of paths?
date: 2019-10-23
tags:
  - work
  - docksal
  - acquia
layout: post
---
It's pretty normal to want to redirect from an `http` to an `https` URL on a production server - and even for non-production where staging and development sites share an SSL certificate.

On Acquia, you can set up custom URLs against an environment, but they also provide you with a generated URL so you can access your site before you've set up your DNS. In the end, against your sites you might end up with a list of URLs like:

```
# Dev:
dev.myexamplesite.com
exampledev.prod.acquia-sites.com

# Test:
stage.myexamplesite.com
test.myexamplesite.com
exampletest.prod.acquia-sites.com

# Production:
prelive.myexamplesite.com
myexamplesite.com
cdn.myexamplesite.com
exampleprod.prod.acquia-sites.com
```

Setting up the `.htaccess` rules is easy; [Acquia provide documentation on how to do this][1]. But it's dangerous to release that to Acquia when your site isn't live yet, especially if you don't have your real live domain set up on Acquia yet (because you're doing a migration to the platform, like we were).

Testing this locally is therefore very important. We use Docksal for developing locally, and it took a little while to figure out how.

### `.htaccess` changes

The first task is to make the changes to the `.htaccess` file. This file is used for the configuration of site access issues, such as redirections, URL shortening, access control and so on.

It's helpful to write out what you want your rule to achieve before making the changes:

* Any environment except for the RA (remote administration) environment should redirect to `https`.
* If the URL is an Acquia URL, we should *not* redirect to `https`.
* We need to retain the request URI, so that the user accessing the site goes to the page they tried to access.

Following the instructions in Acquia's docs, then, we can add the following to our Drupal `.htaccess` file:

```
# This section should already exist in your file; just add your code to it.
<IfModule mod_rewrite.c>
  RewriteRule ^ - [E=protossl]
  RewriteCond %{ENV:AH_SITE_ENVIRONMENT} prod [NC,OR]
  RewriteCond %{ENV:AH_SITE_ENVIRONMENT} test [NC,OR]
  RewriteCond %{ENV:AH_SITE_ENVIRONMENT} dev [NC]
  RewriteCond %{HTTP_HOST} !\.acquia-sites\.com [NC]
  RewriteCond %{HTTPS} off
  RewriteCond %{HTTP:X-Forwarded-Proto} !https
  RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
  RewriteRule ^ - [E=protossl:s]
</IfModule>
```

Hopefully it's pretty straightforward what each bit does, but in case you're not sure:

```
RewriteCond %{ENV:AH_SITE_ENVIRONMENT} prod [NC,OR]
RewriteCond %{ENV:AH_SITE_ENVIRONMENT} test [NC,OR]
RewriteCond %{ENV:AH_SITE_ENVIRONMENT} dev [NC]
```

This matches our first rule, "any environment except for the RA one". I've done it manually since I like explicitly defining which environments to target. We use the `%{ENV:AH_SITE_ENVIRONMENT}` environment variable, which is set by Acquia. Note that your environments may be different: I've seen the test environment called "stage" and "test" for example.

```
RewriteCond %{HTTP_HOST} !\.acquia-sites\.com [NC]
```

This matches our second rule, "don't redirect Acquia URLs". Note the exclaimation mark at the start of the string - it negates the match.

```
RewriteCond %{HTTPS} off
RewriteCond %{HTTP:X-Forwarded-Proto} !https
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

This matches if we aren't currently on `https`, and then redirects the user to `https://` followed by the host and request URI that were requested originally. That fulfils our third requirement, "retain the original path".

The `HTTP:X-Forwarded-Proto` is used for proxies: this will check the path that was served to the proxy, rather than the proxy itself.

```
RewriteRule ^ - [E=protossl]
...
RewriteRule ^ - [E=protossl:s]
```

Finally this wrapper sets the `protossl` variable for use within the rest of the file. This is useful if you want to dynamically add paths later - for example `http%{protossl}` will add the `s` if `https` is enabled.

Now that the `.htaccess` file is set up, how can we test that properly?

### Changes to hosts file

The easy way of testing redirects is to change your hosts file. This little file says, "When you access this web address, look at this IP address, instead of looking one up online." It's how L/MAMP stacks usually work, by adding a URL to the hosts file and saying "look at localhost (127.0.0.1) for this site".

In this instance, because we're using Docksal, we want the URL to point to Docksal's [virtual host (vhost) proxy][2]. This will sort out the routing and point your site to your local Docksal project instead.

Open up the hosts file - it's at `/etc/hosts` on Unix machines, or `C:\Windows\system32\drivers\etc\hosts` on Windows; make sure to open it as an administrator - and add the following to the end of it:

```
192.168.64.100  myexamplesite.com
```

Now if you go to that URL, instead of seeing the actual live site (if it exists) or a blank screen (if it doesn't), you should see your shiny Docksal site. ... or ... will you?

You're more likely to end up on a page that looks something like this:

![Screenshot of Docksal project missing](/img/2019/10/project-missing.png)

Ah, hmm.

### Setting up Docksal

The issue here is that Docksal doesn't know about the site and therefore doesn't know which project to look at to serve files. From the vhost service docs, it says:

> DNS resolution and routing for `*.docksal` domains is automatically configured.

Right, so this isn't a `.docksal` domain and it isn't directly linked to a project. Reading down the vhost proxy documentation page, there's a section called ["Using arbitrary custo domains"][3]:

> A completely custom domain(s) can be assigned by extending the `io.docksal.virtual-host` label of the web container in either `docksal-local.yml` or `docksal.yml` file in the project.
>
> Note: `io.docksal.virtual-host=${VIRTUAL_HOST},*.${VIRTUAL_HOST},${VIRTUAL_HOST}.*` is the default value.

Since we want this site to connect to our Docksal project we need to add the following to the `docksal.yml` file (or, if only you need to test, to the `docksal-local.yml` file):

```yaml
services:
  web:
    labels:
      - io.docksal.virtual-host=${VIRTUAL_HOST},*.${VIRTUAL_HOST},${VIRTUAL_HOST}.*,myexamplesite.com,*.myexamplesite.com
```

This simply adds your site's URL to the end of the default value, rather than replacing it entirely, so that you can still access the site at `myexamplesite.docksal` as previously.

Run `fin restart` in the root of your project, so the changes get picked up, and you should almost be good to go - except that you'll notice now that your `http` to `https` redirect doesn't work.

That's because of the other rule that was decided on: only redirect if the `AH_SITE_ENVIRONMENT` environment variable is present and set to one of `prod`, `test` or `dev`. Docksal lacks documentation on adding environment variables but there is [a useful blog from the Docksal maintainers on how to do it][4]. You'll need to make changes to two files.

First you'll need to add the environment variable's value to your `docksal.env` file (again, this could be `docksal-local.env` if you don't want it in your repo):

```
AH_SITE_ENVIRONMENT=test
```

And then you'll need to make the `cli` service aware of that variable by changing the `docksal.yml` (or `docksal-local.yml`) file:

```yaml
services:
  cli:
    environment:
      - MYSQL_DATABASE
      - MYSQL_PASSWORD
      - MYSQL_USER
      - AH_SITE_ENVIRONMENT
```

Now you should be able to check that variable in your command line:

```shell
$ fin restart
$ fin bash
docker@cli:/var/www$ echo $AH_SITE_ENVIRONMENT
test
```

Nice!

### Putting it all together

That should be everything that's needed now: go back to `myexamplesite.com` and refresh the page. (You may need to clear your browser cache or restart your network manager, if you're struggling to load the site.)

With luck, the site should now redirect correctly to the `https` version. You should be able to change the `AH_SITE_ENVIRONMENT` variable value to something different and the redirect should still work.

It should be possible to extrapolate this to other hosts as well - the method should be the same!

[1]: https://docs.acquia.com/acquia-cloud/manage/htaccess/
[2]: https://docs.docksal.io/core/system-vhost-proxy/
[3]: https://docs.docksal.io/core/system-vhost-proxy/#custom-domains
[4]: https://blog.docksal.io/how-to-set-environment-variable-inside-docksals-cli-container-7548a69c57db
