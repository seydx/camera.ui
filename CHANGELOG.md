# Changelog
All notable changes to this project will be documented in this file.

# v1.0.8 - 2022-01-16

## Other Changes
- Videoanalysis: Using a default zone if none was created
- Videoanalysis: Increases default sensitivity
- Telegram: Stop Telegram bot after message is send
- Added new Translations
- Bump dependencies

## Bugfixes
- Minor bugfixes

# v1.0.7 - 2022-01-15

## Other Changes
- Videoanalysis: Reduced the dwell time from 90s to 60s
- Videoanalysis: Removed `-hwaccel` from FFMPEG parameters
- Videoanalysis: Added `pixel/color difference` slider to be able to adjust the video analysis even more precisely within ui
- Prebuffering: Added `-preset:v ultrafast` if `forcePrebuffering` is enabled
- Added the possibility to control the motion sensor (OFF state) via the camera instead of via motionTimeout (set `"motionTimeout": 0`, the camera must be able to send a `OFF` message e.g. via MQTT or Videoanalysis)
- More translation added
- Minor improvements (camera.ui)

## Bugfixes
- Fixed an isue where crashing FFmpeg did not display an error message in the log
- Fixed an issue where the dwell time could start before the motion handler was initialized
- Fixed an issue where the restart timer for prebuffering and videoanalysis were calculated wrong
- Minor bugfixes

# v1.0.6 - 2022-01-14

## Other Changes
- Videoanalysis: Reduced dwell time from 120s to 90s
- Videoanalysis: Minor improvements
- Refactored log output for better understanding of the flow of events

## Bugfixes
- Fixed an issue where prebuffering/videoanalysis didnt work on cameras with mapping video/audio
- Minor bugfixes

# v1.0.5 - 2022-01-13

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
- Minor bugfixes

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