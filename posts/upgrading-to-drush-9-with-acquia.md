---
title: Upgrading from Drush 8 to 9 with Acquia
description: While starting on a new project recently, I decided to take the plunge and upgrade to Drush 9. The upgrade process, especially since it's an Acquia site, was a little bit haphazard. In this post I'll describe the issues I faced and how I resolved them.
date: 2018-07-04
tags:
  - work
  - drupal
layout: layouts/post.njk
---
**While starting on a new project recently, I decided to take the plunge and upgrade to [Drush 9][1]. The upgrade process, especially since it's an Acquia site, was a little bit haphazard. In this post I'll describe the issues I faced and how I resolved them.**

<!--more-->

### A bit of background

[Microserve][2] recently won a piece of work that involved the creation of a brand spanking new Drupal 8 site for the client. They already used [Acquia][3] to host other sites and, as we have a lot of experience working with Acquia, we were happy to work with the platform again for the new site.

Previously we've attempted to upgrade to Drush 9 (remember when it was required for a couple of days earlier this year?) and had absolutely no luck with the integration on Acquia. It was so buggy that we were unable to access the site at all, never mind perform any command-line updates. By then, Drush 8.1.12 had been released, so we rolled back.

I started the site setup about a week ago and, without thinking, I installed Drush 8 using Composer. A few days later, I was considering a config management tool. Torn between [Config Split][4] and [CMI Tools][5], one of the reasons I was against using CMI Tools (which we've used before, to great success) was that I wouldn't be able to upgrade to Drush 9, as there is no stable upgrade path.

In the end, CMI Tools won out, but I decided I didn't want that to stop me from upgrading to the Latest And Greatest versions of software - so an upgrade to Drush 9 was due!

### The initial upgrade

[Drush 9 docs state][6] that every project that uses Drush needs to have it installed using Composer. It needs to be provided per-project, rather than being installed globally, on your local computer or the server.

At Microserve we've been managing all project dependencies using Composer for about a year now, so this was no problem. I already had Drush listed as a dependency in Composer for this project, so it was a simple case of requiring the newer version:

```bash
$ fin run composer require drush/drush:^9
```

(**Note**: we use Docksal, so my Composer commands will be prefixed with `fin run`. My Drush commands will be prefixed with `fin drush`.)

Composer went away to get all the updates, unpacked them, and that was that:

```bash
$ fin drush status
 Drupal version   : 8.5.4                                 
 Drush version    : 9.3.0
```

### Installing CMI Tools

Installing CMI Tools on a previous site had proven very easy: we simply downloaded the script from the PreviousNext website and put it into a drush directory in our repo. Drush picked it up and we were using it within a few minutes.

Drush 9, however, has changed everything around. Commands are no longer defined in PHP .inc files, but rather in Command files. Luckily there was an upgrade for the script available on the Github project.

But that's Github! In order for Composer to pick that up, I had to make some changes to composer.json, per the Github README:

```json
"repositories": [
    {
        "type": "composer",
        "url": "https://packages.drupal.org/8"
    },
    {
        "type": "git",
        "url": "https://github.com/previousnext/drush_cmi_tools.git"
    }
]
```

Then I could require the script as previously:

```bash
$ fin run composer require drupal/drush-cmi-tools:dev-8.x-2.x
```

Note that I had to specify **exactly** which branch to use, otherwise it may have defaulted to an outdated branch (eg 8.x-1.x).

Composer did its thing again and downloaded the files to the modules directory. This was a surprise, as I expected it to be downloaded as a Drush script, but it's a module. That means you **have to enable it** in order for Drush to pick up the commands.

I repeat: **you must enable the module**! Then you can run the commands:

```bash
$ fin drush en drush-cmi-tools
$ fin drush config-export-plus --destination=../config/sync
 [notice] The active configuration is identical to the configuration in the export directory (../config/sync)
```

### Convert drushrc.php to drush.yml

The beauty of CMI Tools is that you can maintain a list of ignored config items. However, adding that ignore list every time you want to run a config export is nasty, so in Drush 8 that was maintained using a `drushrc.php` file.

A `drushrc.php` file makes it super-easy to set default values for Drush commands. For example, if you're always going to use the same value for a command, you can set it in this file and forget about it.

In Drush 9, that file has been upgraded to a YAML file, but finding any documentation about how to upgrade proved difficult. In the end, I found [a very wordy example file][7] in the Drush 9 Github repo.

The `drushrc.php` file that I started with (from the other project) looked like this:

```php
$command_specific['config-export-plus']['ignore-list'] = '../drush/ignore.yml';
$command_specific['config-export-plus']['destination'] = '../config/sync';

$command_specific['config-import-plus']['source'] = '../config/sync';
$command_specific['config-import-plus']['install'] = '../config/install';
$command_specific['config-import-plus']['delete-list'] = '../drush/delete.yml';
```

In the end, the changes were pretty straightforward:

```json
command:
  # For each command, add a new section.
  config-export-plus:
    # For each parameter you can pass in, add a key-value pair under 'options'.
    options:
      ignore-list: ../drush/ignore.yml
      destination: ../config/sync

  config-import-plus:
    options:
      source: ../config/sync
      install: ../config/install
      delete-list: ../drush/delete.yml
```

Drop these contents into `/drush/drush.yml`. If you have a multisite, and you want site-specific overrides, you can also add a copy into `/docroot/sites/{site name}/drush.yml`, and it'll be picked up only for that particular site.

Now you should be able to run a streamlined version of your config export command, or the aliased command if you prefer:

```bash
$ fin drush config-export-plus
$ fin drush cexy
```

That's pretty much all you need to know for running the basic config import/export commands. The upgraded script seems to work well, and Drush's feedback is much cleaner than it was previously.

### Updating sql-dump

As part of standard practice at Microserve, we spin up test sites for every feature branch we work on. Part of this process is to use the `drush sql-dump` command on a site that has the latest development code on it.

This process broke with our update to Drush 9. In Drush 8, if you ran the `sql-dump` command with the `--result-file` flag, you'd get a database saved to a location in your home directory:

```bash
$ fin drush sql-dump --result-file
 [success] Database dump saved to /home/docker/drush-backups/database_name/20180704105010/database_name_20180704_105011.sql

```

In Drush 9, if you do the same again:

```bash
$ fin drush sql:dump --result-file
  The "--result-file" option requires a value.
```

And no database is exported.

It took me a while to dig out [a relevant issue on Github][8], where someone suggested adding an extra flag to auto-generate the file name as previously. The full command now looks like:

```bash
$ fin drush sql:dump --result-file auto
```

This is still a lot to type out, though. You can automate that in your shiny new `drush.yml` file, by adding another command set:

```json
command:
  sql:
    dump:
      options:
        result-file: 'auto'
```

The command is technically `sql:dump`, so it's a nested command set, instead of a single-line one like the CMI Tools commands.

Now you should be able to run the command without any arguments and get a nice database dump:

```bash
$ fin drush sql:dump
 [success] Database dump saved to /home/docker/drush-backups/database_name/20180704105825/database_name_20180704_105825.sql
```

### Updating site aliases

The final piece in the puzzle was to update our site aliases for Acquia.

Acquia provide downloadable site aliases that you can use to perform tasks with Drush on remote sites. This is incredibly useful as it means you don't have to SSH into a server and perform updates, but can manage the site from the comfort of your local computer.

If you inspect one of those alias files (they'll sit in your home directory, under `~/.drush/application.aliases.drushrc.php`), you'll see they add information to an array of aliases, in PHP.

Drush 9 has (you guessed it) upgraded these files to YAML files. More importantly, they are **no longer stored in your home directory**. Standard practice is now to store these alias files within your site's repository. The file name has changed, too: it should now be `application.site.yml`.

While there is a command to convert aliases, I've found that it doesn't reliably convert Acquia aliases, and generated more empty files than useful ones - and it generated one for each environment, rather than each site.

You can try using this command:

```bash
$ fin drush site:alias-convert
```

You will be prompted to specify the directory where your aliases currently live. If it works, you should be able to copy the appropriate file into `/drush/sites/application.site.yml` in your repository, then use your alias as usual.

If you're unlucky (like I was), you'll need to manually create an alias file.

Let's assume we start out with a single alias for the Acquia subscription `mysite`:

```php
// Site mysite, environment dev.
// To use this alias: drush @mysite.dev status
$aliases['dev'] = array(
  'root' => '/var/www/html/mysite.dev/docroot',
  'ac-site' => 'mysite',
  'ac-env' => 'dev',
  'ac-realm' => 'prod',
  'uri' => 'mysitedev.acquia-sites.com',
  'remote-host' => 'mysite.ssh.acquia-sites.com',
  'remote-user' => 'mysite.dev',
  'path-aliases' => array(
    '%drush-script' => 'drush' . $drush_major_version,
  ),
);
```

Create a new file in your `/drush/sites` directory called `mysite.site.yml` and convert the aliases to YAML:

```json
# To use this alias: drush @mysite.dev status
dev:
  root: '/var/www/html/mysite.dev/docroot'
  uri: 'mysitedev.acquia-sites.com'
  ac-site: 'mysite'
  ac-env: 'dev'
  ac-realm: 'prod'
  host: 'mysite.ssh.acquia-sites.com'
  user: 'mysite.dev'
  paths:
    drush-script: 'drush9'
```

Repeat for each of the aliases you have. Put all of them into the same file, and make sure you commit them to your repository. Then you should be able to use your aliases as usual:

```bash
$ drush @mysite.dev status
 Drupal version   : 8.5.4                                                    
 Database         : Connected                                                
 Drupal bootstrap : Successful                                               
 Drush version    : 9.3.0                                                    
Connection to mysite.ssh.acquia-sites.com closed.
```

### Conclusion

Updating to Drush 9 is difficult but totally worth it for the CLI alone. (It has so many pretty colours!) It's a tricky process if you don't know what you're doing, and if you don't know where to go for resources.

It's super important to keep on top of your updates, though, otherwise you risk falling too far behind to upgrade easily. If you have something that depends on a particular version of Drush (or any other dependency!), consider reassessing your requirements and see if you can schedule some time to do some upgrades.

#### Further reading

*   Drush example files: <https://github.com/drush-ops/drush/tree/master/examples>
*   Drush CMI Tools announcement post: <https://www.previousnext.com.au/blog/introducing-drush-cmi-tools>
*   About Acquia site aliases: <https://docs.acquia.com/acquia-cloud/manage/ssh/drush/aliases/>

[1]: http://docs.drush.org/en/master/
[2]: https://microserve.io/
[3]: https://www.acquia.com/
[4]: https://www.drupal.org/project/config_split
[5]: https://github.com/previousnext/drush_cmi_tools
[6]: http://docs.drush.org/en/master/install/
[7]: https://github.com/drush-ops/drush/blob/master/examples/example.drush.yml
[8]: https://github.com/drush-ops/drush/pull/3370
