---
title: Make a file executable in Git
description: I make it a habit to ignore all file permission changes in Git, but sometimes I need to make a script executable. This is how I change the permissions on a file in such a way that they're stored in the repo.
date: 2018-10-22
tags:
  - work
  - drupal
layout: layouts/post.njk
---
I make it a habit to ignore all file permission changes in Git, but sometimes I need to make a script executable. This is how I change the permissions on a file in such a way that they're stored in the repo.

I don't like Git storing file permission changes. Sometimes I want to make a whole folder wide open for testing locally, or a Composer install will install files with permissions that are too broad. I don't want the file permissions to change from their default states, so I use the following Git config to ignore filemode changes:

```
$ git config --global core.filemode false

# Check the config...
$ cat ~/.gitconfig
...snip...
[core]
  filemode = false
```

This ensures that if any permissions of files in my repository change, they don't get committed back to the central repo.

But sometimes I want a script to be executable on the server (for example, when using Acquia's build hooks to automate post-deployment tasks). That requires a permission change.

To do that, you can use Git's update-index command:

```
# Should show that the file permissions of the file are 100644.
$ git ls-files --stage

# Add 'executable' to the script.
$ git update-index --chmod=+x path/to/script.sh

# Should show that the file permissions are 100755.
$ git ls-files --stage
```

And then you can commit your changes, push them back to your repo, and carry on with your workflow.
