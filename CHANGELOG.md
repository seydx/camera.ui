# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 1.2.0 (2023-12-22)


### Features

* **front-end:** add initial camera controls (IoT functionality) ([64d039c](https://github.com/SeydX/camera.ui/commit/64d039c0f943b17fc3d6fd25a07e349aa0460140))

# [1.0.4] - 2022-01-11

## Other Changes
- Interface:
  - Limit max page size to 6 (pagination)
  - Refactored Lightbox
- Bump dependencies

## Bugfixes
- Fixed an issue with pagination middleware, where the nextPage and prevPage attribute showed wrong path
- Fixed an isue where opening a recording or a notification (with recording) loaded all recordings in the background and caused the interface to crash
- Fixed an issue where the notification banner could not display a video
- Fixed an issue where utilization could not show process cpu load / memory usage
- Minor bugfixes

# [1.0.3] - 2022-01-11

## Bugfixes
- Fixed an issue where the sensitivity for video analysis was not applied
- Fixed an issue where building the ui failed if no test config.json found

# [1.0.2] - 2022-01-11

## Bugfixes
- Fixed an issue where the videoanalysis zones were not taken over
- Fixed an issue where the sensitivity for videoanalysis was reset after each reboot

# [1.0.1] - 2022-01-10

## Bugfixes
- Fixed an issue where the status widget and the system page could not be displayed due to incorrect version checking

# [1.0.0] - 2022-01-10
- Initial relase
