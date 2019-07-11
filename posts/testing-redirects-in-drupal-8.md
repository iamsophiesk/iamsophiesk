---
title: Testing redirects in Drupal 8
description: I'm setting up a controller on Drupal 8 which should redirct to the home page if certain query parameters aren't set. Writing a test to make sure that the redirect happens correctly took longer than expected. After trying a number of different approaches, I finally figured it out.
date: 2019-01-03
tags:
  - work
  - drupal
layout: layouts/post.njk
---
**I'm setting up a controller on Drupal 8 which should redirect to the home page if certain query parameters aren't set. Writing a test to make sure that the redirect happens correctly took longer than expected. After trying a number of different approaches, I finally figured it out.**

Normally you would check if a page is the front page using the path matcher service:

```php
$path_matcher = \Drupal::service('path.matcher');
$is_front = $path_matcher->isFrontPage();
```

This didn't seem to work when running PHPUnit tests though. For some reason, the site was redirecting to `/user` (despite my controller returning a redirect response to `/`).

That meant my tests were all failing. I spent most of today trying to track down a solution until I finally came across an issue on Drupal.org: "[User cancel link doesn't redirect to the homepage](https://www.drupal.org/project/drupal/issues/2855054)" - not *quite* what I was looking for, but it was fixed in 8.6-dev, which suggested there might be tests to check the redirect.

There in the patch was a useful assertion to check the current address:

```php
+    // Confirm that the user was redirected to the front page.
+    $this->assertSession()->addressEquals('');
```

Pop that into my test and it works like a charm:

```php  
public function testDirectAccessNoParameters() {
 // If no parameters are provided, expect a redirect.
 $this->drupalGet('add-product');
 $this->assertSession()->addressEquals('');
}
```

And the output of my test:

```bash
sophie@Belgaer:$ fin phpunit --group=current_tests
WARNING: No swap limit support
PHPUnit 6.5.10 by Sebastian Bergmann and contributors.

Testing
. 1 / 1 (100%)

Time: 36.78 seconds, Memory: 914.50MB

OK (1 test, 3 assertions)
```

Bingo!
