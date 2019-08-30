---
title: Creating fields in update hooks on Drupal 8
description: You've got an update hook that depends on a new field that depends on config import that needs to be done after the update hook has run that requires the config import that needs... ARGH.
date: 2019-08-30
permalink: "posts/{{ date | date: '%Y/%m' }}/{{ title | slug }}/index.html"
tags:
  - work
  - drupal
layout: layouts/post.njk
---
Everyone's seen this issue when updating a Drupal 8 site: you've got an update hook that depends on a new field that will be created when your config gets imported, but you want the database to be up-to-date before config is imported, so you run database updates before config imports. Then your update fails, because your field doesn't exist yet.

It's an issue I've faced several times and have fixed a number of different ways, but I think I figured out _the_ way to do it recently.

### A little more detail

This time around, the field had already been installed on the dev environment, and a new module was trying to create an entity (a user) that depended on that field being available. This worked fine on the development environment, but it became apparent that it wouldn't be okay on staging (where the update would run before the field was enabled).

Therefore it was necessary to check to see if the field was enabled first, before going ahead and enabling it.

### The update hook

```php
use Drupal\Core\Config\FileStorage;

/**
 * Ensure the field_my_field field is installed.
 */
function mysite_user_update_8002() {
  $config_path = config_get_config_directory(CONFIG_SYNC_DIRECTORY);
  $config_manager = Drupal::service('config.manager');
  $source = new FileStorage($config_path);

  $entity_type_manager = Drupal::entityTypeManager();
  $field_storage = $entity_type_manager->getStorage('field_storage_config');
  $field_config = $entity_type_manager->getStorage('field_config');

  // Only try to create the field if it doesn't already exist.
  if (!$field_storage->load('user.field_my_field')) {
    $config_record = $source->read('field.storage.user.field_my_field');
    $entity_type = $config_manager->getEntityTypeIdByName('field.storage.user.field_my_field');

    /** @var \Drupal\Core\Config\Entity\ConfigEntityStorageInterface $storage */
    $storage = $entity_type_manager->getStorage($entity_type);

    // Create the config entity.
    $entity = $storage
      ->createFromStorageRecord($config_record)
      ->save();
  }

  if (!$field_config->load('user.user.field_my_field')) {
    $config_record = $source->read('field.field.user.user.field_my_field');
    $entity_type = $config_manager->getEntityTypeIdByName('field.field.user.user.field_my_field');

    /** @var \Drupal\Core\Config\Entity\ConfigEntityStorageInterface $storage */
    $storage = $entity_type_manager->getStorage($entity_type);

    // Create the config entity.
    $entity = $storage
      ->createFromStorageRecord($config_record)
      ->save();
  }
}
```

### What's it doing?

It starts by loading in the config from the active config directory. This could be from your module's config install directory if preferred:

```php
$config_path = config_get_config_directory(CONFIG_SYNC_DIRECTORY);
$config_manager = Drupal::service('config.manager');
$source = new FileStorage($config_path);
```

Then it checks the field storage to see if storage for a given field exists and, if not, creates it:
```php
// Only try to create the field if it doesn't already exist.
if (!$field_storage->load('user.field_my_field')) {
  $config_record = $source->read('field.storage.user.field_my_field');
  $entity_type = $config_manager->getEntityTypeIdByName('field.storage.user.field_my_field');

  /** @var \Drupal\Core\Config\Entity\ConfigEntityStorageInterface $storage */
  $storage = $entity_type_manager->getStorage($entity_type);

  // Create the config entity.
  $entity = $storage
    ->createFromStorageRecord($config_record)
    ->save();
}
```

It's important to create the field storage before adding the field config, because otherwise how will the system know how to structure the field when it's created?

The following `if` statement does the same but for the field config itself:

```php
if (!$field_config->load('user.user.field_my_field')) {
  $config_record = $source->read('field.field.user.user.field_my_field');
  $entity_type = $config_manager->getEntityTypeIdByName('field.field.user.user.field_my_field');

  /** @var \Drupal\Core\Config\Entity\ConfigEntityStorageInterface $storage */
  $storage = $entity_type_manager->getStorage($entity_type);

  // Create the config entity.
  $entity = $storage
    ->createFromStorageRecord($config_record)
    ->save();
}
```

And the job's a good'un. The field is installed if it doesn't exist and, if it does exist, then nothing happens during the update hook at all.
