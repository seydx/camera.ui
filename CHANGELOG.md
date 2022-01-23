# Changelog
All notable changes to this project will be documented in this file.

# v1.1.3 - 2022-01-23

## Other Changes
- Refactored recordings/notifications filter
- Refactored config generator

## Bugfixes
- Fixed an issue where camera names were displayed incorrectly in recordings
- Fixed an issue where the recordings/notifications could not be filtered properly
- Fixed an issue where config.json was not created in standalone mode
- Fixed an issue where deleting the camera via the interface caused errors
- Minor bugfixes

# v1.1.2 - 2022-01-22

## Bugfixes
- Fixed issues with logging
- Minor bugfixes

# v1.1.1 - 2022-01-22

## Other Changes
- Refactored logging into file
- Bump dependencies
- Minor improvements

## Bugfixes
- Minor bugfixes

# v1.1.0 - 2022-01-21

## Breaking Changes
- camera.ui has been refactored is now a ESM package.

## Notable Changes
- camera.ui now throws an error if no `storagePath` is given
- The database has been completely updated and will not be read/written again when the data is changed. Instead, any changes are cached and saved when logging out/restarting/closing camera.ui

## Other Changes
- Database: Changed to `@seydx/lowdb`
- Videoanalysis: It is now possible to set the internal "forceClose" timer for video analysis via the interface
- Videoanalysis: A "reset" button has been added (interface) to reset the values for video analytics to default values
- SMTP: The SMTP server can now also search the content of an email if no camera could be assigned to the email addresse(s)
- More translations
- Minor UI improvements
- Bump dependencies

## Bugfixes
- Fixed an issue where recordings displayed an invalid date
- Fixed an issue where references were obtained instead of (copied) values when reading from the database
- Fixed an issue where notification cleartimer not resetted if notification was removed
- Fixed an issue where mapping mqtt messages failed
- Fixed an issue where the "videoanalysis" image was not displayed
- Fixed a bug where a removed camera widget (when Snapshot was set) tried to refresh the image in the background even though the widget no longer existed.
- When writing or reading from the database, unnecessary actions to the database are prevented (Windows: `EMFILE`)
- Pinned `"mqtt"` to v4.2.8 to fix `RangeError: Maximum call stack size exceeded`
- Minor bugfixes

# v1.0.9 - 2022-01-17

## Other Changes
- Videoanalysis: Improved log output (debug level)
- Videoanalysis: Dwell time is now configurable within interface (minimum 15s)
- SMTP: It is now possible to modify the email adress for a camera (Settings > Cameras > Camera > Alarm > SMTP)
- Telegram: Switched to `node-telegram-bot-api`
- Minor UI improvements

## Bugfixes
- Fixed an issue that sometimes prevented the interface from loading
- Fixed an issue where the profile picture did not update immediately after uploaded a new one
- Fixed translation issues on `/start` page
- Fixed an issue where the MQTT messages could not be mapped correctly
- Minor bugfixes

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