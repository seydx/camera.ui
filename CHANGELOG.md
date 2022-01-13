# Changelog
All notable changes to this project will be documented in this file.

# Next

## Other Changes
- Reduced default videoanalysis sensitivity to 25
- Removed session control
- Videoanalysis improvements
- Refactored web stream
- Improved camera pinging
- Moved ENOENT messages to debug (eg. if recording not found)
- Minor UI improvements

## Bugfixes
- Fixed an issue where resetting motion via MQTT didnt work
- Fixed an issue where the video analysis sensitivity does not work as desired
- Fixed an issue where mapping video/audio stream didnt work (ffmpeg)
- Minor Bugfixes

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