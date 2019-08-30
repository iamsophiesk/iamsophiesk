---
title: User registration using Simple Oauth
description: In a headless setup, I wanted to protect the user registration endpoint from being accessed by unauthenticated users. I achieved it using the Simple Oauth module.
date: 2019-08-09
permalink: "posts/{{ date | date: '%Y/%m' }}/{{ title | slug }}/index.html"
tags:
  - work
  - drupal
layout: layouts/post.njk
---
We've struggled with spam registrations previously, and protecting the user account form is easy: you add a Captcha, or Honeypot, and most spam registrations are avoided. It's a lot more difficult to do that in a headless situation though. With a separate application that needs to be able to send user registrations through to a central Drupal repository, how do you make it possible for anonymous users to register without allowing spam bots to flood the endpoint?

### Initial setup

This would be a REST endpoint, so the first thing I did was enable Drupal Core's REST module. Naturally this meant I needed the [REST UI](https://drupal.org/project/restui) module as well, so that I could configure the endpoints:

```bash
$ composer require --dev drupal/restui
```

We were already using the [Oauth2 server](https://drupal.org/project/oauth2_server) module for SSO, so it felt like a natural first step to use that as an authentication provider. I spent some time playing with [Simple OAuth](https://drupal.org/project/simple_oauth) but decided it was, at the time, too feature-rich for the use case I had in mind.

### The wrong approach

It's important to note that I did this "wrong" to start with. Even though this post is about how I _solved_ the problem, I'm keen to compare it to how I misunderstood some fundamentals of OAuth to start with.

I followed the [Oauth2 Server documentation](https://www.drupal.org/node/1938218) to set up a server which I hoped would supply authentication for my requests. Because I knew I wanted any anonymous user to be able to submit a registration, I enabled the `/user/register` endpoint, and allowed anonymous users to submit to the endpoint.

This combined meant I could submit a cURL request to get an auth token:

```bash
curl -i -X POST \
  -H "Content-Type:application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=my_new_server" \
  -d "client_secret=a_secret_value" \
  -d "scope=my_specific_scope" \
'https://drupal.instance/oauth2/token'
```

This provided me with a secret which I could then use in another cURL request to create the user:

```bash
curl -i -X POST \
  -H "Content-Type:application/json" \
  -H "Authorization:Bearer [auth token]" \
  -d \
'{
	"name": [{"value": "Test User"}],
  "status": [{"value": 1}],
	"mail": [{"value": "mytestuser@test.com"}],
  "pass": [{"value": "password"}]
}' \
'https://drupal.instance/user/register?_format=json'
```

The nice thing about this was that any anonymous user could post to it. But my fundamental misunderstanding was this: by providing an authorization header, I was saying "this request is coming from User X", and User X isn't allowed to submit the user registration form, because they are an authenticated user. Anonymous users were still able to submit the request and sign up for an account without any kind of authentication. This wasn't going to work.

Cue record scratch and a mad rush to rework an integration.

### Using Simple Oauth

Initially I thought this was an issue with the Oauth2 Server module, so the team decided to leave it doing what it was good at - the SSO - and focus our efforts on installing and configuring Simple Oauth to protect the endpoint.

This time around, I knew I wanted to protect the endpoint with a user role, so I created an imaginatively-named role called "api", and gave it permission to post to the registration form. I created a Consumer based on that role: OAuth provides access based on "scopes", and in Simple OAuth terms, a "scope" is a set of user permissions - or a user role.

I followed the instructions on the project page and was soon receiving access tokens from a different endpoint:

```bash
curl -i -X POST \
   -H "Content-Type:application/x-www-form-urlencoded" \
   -d "grant_type=client_credentials" \it s
   -d "client_id=consumer-uuid" \
   -d "client_secret=a_secret_value" \
   -d "username=api" \
   -d "password=api" \
   -d "scope=" \
 'https://drupal.instance/oauth/token'
```

But for some reason I was getting 404s when posting to the user registration form - until my access token required, at which point I was magically able to create the user. Exactly the same as I'd seen with OAuth2 Server! How frustrating - this was completely the opposite of the behaviour I wanted!

It took me the best part of an afternoon to work out that we had the [403 to 404](https://www.drupal.org/project/m4032404) module installed, which was hiding the _real_ problem. When I allowed the API role access to the original 403 errors, I could see that there was an error saying that authenticated users cannot register accounts... ohh...!

#### Whut?

When you pass an authorization header through with a request, you're effectively telling Drupal "Please perform this request as the user to whom this token belongs". If I pass through the token `abc123`, then Drupal will look up the token `abc123`, see who it belongs to, and perform the request as that user.

So by passing in an authorization header, I was saying "please submit the registration form as this API user", which was failing.

### Using a different endpoint

The solution was to use the `/entity/user` endpoint instead. This endpoint is only accessible to accounts with the `administer users` permission. While this is a broad permission, it seemed okay to give it to the API user, given that the rest of the endpoints relating to user accounts were totally locked down.

Now the request looks a little more like this:

```bash
curl -i -X POST \
   -H "Content-Type:application/json" \
   -H "Authorization:Bearer [auth token]" \
   -d \
'{
  "name": [{"value": "Test User"}],
  "status": [{"value": 1}],
  "mail": [{"value": "mytestuser@test.com"}],
  "pass": [{"value": "password"}]
}' \
 'https://drupal.instance/entity/user?_format=json'
```

And whaddaya know - the request works first time, every time.
