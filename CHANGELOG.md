# Changelog
All notable changes to this project will be documented in this file.

# v1.1.7 - 2022-04-24

## Bugfixes
- Several issues that caused the process to crash have been fixed

# v1.1.16 - 2022-04-24

## Notable Changes
- **API:**
  - New endpoint `/api/system/disk`
- **Charts:** 
  - Added new chart `disk load`
- **Widgets:**
  - Added new widget to view the available and used disk space

## Other Changes
- Added disk space information to `Settings > Recordings`
- Added check of storage space for motion events to avoid recording when storage space is low
- Simplified `Add Camera` through UI
- Minor UI improvements

## Bugfixes
- Fixed an issue where removing a camera via the user interface did not destroy the camera controller
- Minor bugfixes

# v1.1.15 - 2022-04-24

## Notable Changes
- **Config:** 
  - Added `"motionDelay"` parameter to the camera block. Motion Delay: The number of seconds to wait to trigger the motion sensor after a motion event is received from e.g. MQTT, SMTP, FTP or HTTP (this can be useful if you use an external motion sensor and the camera feed lags several seconds behind the event).

## Other Changes
- Minor UI improvements
- Bump dependencies

## Bugfixes
- Fixed an issue where replacing deprecated ffmpeg args failed due to invalid ffmpeg version

# v1.1.14 - 2022-04-23

## Other Changes
- **MQTT:** When motion is detected, two MQTT messages are now published on following topics:
  1. **camera.ui/notifications**: Contains all notifications AFTER motion has been detected AND recorded.
  2. **camera.ui/motion** _(can be changed in the interface):_ Contains motion event (before something is recorded).
- Deprecated FFmpeg arguments will be auto replaced now
- Minor improvements to probe stream

## Bugfixes
- Fixed an issue where changing camera settings via the interface did not work

# v1.1.12 / v1.1.13 - 2022-04-23

## Other Changes
- Improved probe stream
- Minor improvements
- Bump dependencies

## Bugfixes
- Fixed an issue where recording information such as motion label was not correctly saved in the image data
- Fixed an issue where prebuffering and/or video analysis was started for disabled cameras anyway
- Minor bugfixes

# v1.1.11 - 2022-04-23

## Notable Changes
- **Interface:**
  - **Recordings:** The recordings section has been redesigned and now includes another list mode to view the recordings. The filter function has been redesigned.
  - **Camera:** Added a new endpoint for direct streaming (`/cameras/:name/feed`)
  - **Cameras:** The cameras section has been redesigned and now includes another list mode to view the cameras.
  - **Notifications:** The filter function has been redesigned.
  - **Console:** Added a new filter function
  - **System:** Improved loading time (`npm`)
- **Config:** 
  - Top level `"debug"` in config.json is deprecated now. Replaced with `"logLevel"`. Log Level: Show only defined log level. _(Info = Show informative messages during processing. This is in addition to warnings and errors - Debug: Show everything, including debugging information - Warning: Show only warnings and errors - Error: Show only errors)_
- **MQTT:** When motion is detected, the messages are now also published via MQTT to the topic configured under `Settings > Cameras > Notifications > MQTT Publish Topic`

## Other Changes
- Minor UI improvements
- Minor logger improvements
- Bump dependencies
- Downgrade `ffmpeg-for-homebridge`

## Bugfixes
- Minor bugfixes

# v1.1.10 - 2022-04-17

## Other Changes
- Enabled Web Assembly for better streaming performance within web browser
- Minor UI improvements
- Changed to `@seydx/jsmpeg`
- Bump dependencies

# v1.1.9 - 2022-04-16

## Bugfixes
- Fixed minor issues with FFmpeg v5

# v1.1.8 - 2022-04-16

## Other Changes
- Minor recording improvements

## Bugfixes
- Fixed an issue where the notification in the interface referred to a saved recording even though recordings were disabled
- Fixed an issue where the recorded video could not be sent via Telegram
- Fix ffmpeg command `-stimeout`
- Minor bugfixes

# v1.1.7 - 2022-04-15

## Other Changes
- i18n: Thai (th) language added by [@tomzt](https://github.com/tomzt)
- i18n: French (fr) language added by [@NebzHB](https://github.com/NebzHB)
- i18n: Spanish (es) language added by [@mastefordev](https://github.com/masterfordev)
- Added a new config.json tab to `Interface > Settings > System`
- Improved videoanalysis
- Minor UI improvements
- Bump dependencies

## Bugfixes
- Fixed an issue where pinging camera sources with `non-break spaces` failed
- Fixed an issue where Doorbell Topic and Message were not displayed in the interface
- Fixed an issue where changing `recordOnMovement` in the ui settings was resetted after restart
- Fixed an issue where notifications were saved to the database even if the notifications were disabled in the settings
- Fixed an issue where Telegram sometimes could not send videos
- Fixed tests
- Minor bugfixes

# v1.1.6 - 2022-01-25

## Bugfixes
- Fixed an issue where the interface was not accessible because the browser language could not be determined (camera.ui)

# v1.1.5 - 2022-01-25

## Other Changes
- Improved debug/error logging for recording
- Minor ui improvements

## Bugfixes
- Minor bugfixes

# v1.1.4 - 2022-01-24

## Other Changes
- Improved adding of cameras within the interface
- Added a new "Reports" page (atm its only placeholder)
- Redesigned the "save" button in camera settings page
- Reduced system payload
- Added more translations

## Bugfixes
- Fixed an issue where filtering of recordings and/or notifications did not work if end date was before start date
- Fixed an issue where it was possible to add multiple cameras with the same name through the interface
- Fixed an issue where a maximum of only 6 cameras could be displayed on Dashboard and Camview
- Fixed an issue where the config generator failed
- Minor bugfixes

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
- Database: Changed to `lowdb`
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