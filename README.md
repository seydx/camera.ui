<p align="center">
    <img src="https://github.com/SeydX/camera.ui/blob/master/images/logo.png">
</p>

# camera.ui

[![npm](https://img.shields.io/npm/v/camera.ui.svg?style=flat-square)](https://www.npmjs.com/package/camera.ui)
[![npm](https://img.shields.io/npm/dt/camera.ui.svg?style=flat-square)](https://www.npmjs.com/package/camera.ui)
[![GitHub last commit](https://img.shields.io/github/last-commit/SeydX/camera.ui.svg?style=flat-square)](https://github.com/SeydX/camera.ui)
[![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=flat-square&maxAge=2592000)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=NP4T3KASWQLD8)

**camera.ui** is a NVR like PWA to control your RTSP capable cameras with:

- **Live Streams** on Web
- **Camview**: A resizable, drag & drop camera overview
- **Web Application** with almost full PWA support like push notification and more
- **Multi-language**: Easily expandable multi-language support
- **Motion Detection** via video analysis, MQTT, FTP, SMT or HTTP.
- **Image Rekognition** via AWS Rekognition
- **Notifications** via Alexa, Telegram, Webhook and WebPush
- **Snapshot/Video**: Save recording of snapshots/videos locally when motion is detected
- **Prebuffering:** See the seconds before the movement event
- **User Interface**: Beautiful and with love designed interface with 8 different color themes, darkmode and more
- **HomeKit**: Easily expose the cameras to Apple Home with HSV support

and much mure...

**Supported Languages:** 

:de: | :gb: | :netherlands:

## Installation

```
sudo npm install -g camera.ui@latest
```

## Configuration

camera.ui installs itself in the user directory under `~/.camera.u`.

The database, recordings as well as config.json are stored locally in this folder and are never accessible to others. The settings can be changed directly with the help of an editor, or directly via the interface.

After the installation you can start camera.ui with the following command in the terminal

``camera.ui``

`-D, --debug`: Turn on debug level logging
`-C, --no-color`: Disable color in logging
`-T, --no-timestamp`: Do not issue timestamps in logging
`--no-sudo`: Disable sudo for updating through ui
`--no-global`: Disable global (-g) prefix for updating through ui
`-S, --storage-path`: Look for camera.ui files at [path] instead of the default location (~/.camera.ui)'

## Defaults

Once you have installed and configured it you can access the interface via http://localhost:8081.

The default username is ``master`` and the default password is ``master``. When you log in for the first time, camera.ui will ask you to change your username and password.

# Usage

### Login

<img src="https://github.com/SeydX/camera.ui/blob/master/images/browser/login.png" align="center" alt="camera.ui">

### Dashboard

<img src="https://github.com/SeydX/camera.ui/blob/master/images/browser/dashboard.png" align="center" alt="camera.ui">

### Cameras

<img src="https://github.com/SeydX/camera.ui/blob/master/images/cameras.png" align="center" alt="camera.ui">

### Camera

<img src="https://github.com/SeydX/camera.ui/blob/master/images/camera.png" align="center" alt="camera.ui">

### Recordings

<img src="https://github.com/SeydX/camera.ui/blob/master/images/browser/recordings.png" align="center" alt="camera.ui">

### Notifications

<img src="https://github.com/SeydX/camera.ui/blob/master/images/browser/notifications.png" align="center" alt="camera.ui">

### Camview

<img src="https://github.com/SeydX/camera.ui/blob/master/images/camview.png" align="center" alt="camera.ui">

### Log

<img src="https://github.com/SeydX/camera.ui/blob/master/images/console.png" align="center" alt="camera.ui">

### Config

<img src="https://github.com/SeydX/camera.ui/blob/master/images/config.png" align="center" alt="camera.ui">

### Utilization

<img src="https://github.com/SeydX/camera.ui/blob/master/images/utilization.png" align="center" alt="camera.ui">

### Settings

<img src="https://github.com/SeydX/camera.ui/blob/master/images/browser/settings.png" align="center" alt="camera.ui">

# HomeKit

The cameras that are included in camera.ui can easily be exposed to Apple Home via Homebridge.

To do this, please install `homebridge-config-ui-x` and search for the plugin `homebridge-camera-ui` and install it.

<img src="https://github.com/SeydX/camera.ui/blob/master/images/homebridge/homebridge_search.png" align="center" alt="camera.ui">

Your database, if you have not changed the path, will remain the same. However you have to copy the content of `config.json` and paste it via homebridge-config-ui-x into the config.json block of homebridge-camera-ui.

# Motion detection

camera.ui offers a variety of options to detect and process motion.

### Videoanalysis

<img src="https://github.com/SeydX/camera.ui/blob/master/images/browser/videoanalysis.png" align="center" alt="camera.ui">

With this option camera.ui connects to the stream and compares frame by frame if there are changes. The zones and sensitivity can be set in the interface.

### HTTP / MQTT / SMTP / FTP

If your camera is able to send an email when motion is detected, or send a command vie MQTT or upload an image vie FTP, then you can easily configure camera.ui to act as a destination. With this camera.ui interprets a movement and processes it (takes a picture/video, sends a notification etc)

# Image Rekognition

camera.ui also uses image rekognition with Amazon Web Services to analyse, detect, remember and recognize objects, scenes, and faces in images. You can enable for each camera the image rekogniton and you can even set labels for each camera. For each object, scene, and concept the API returns one or more labels. Each label provides the object name. For example, suppose the input image has a lighthouse, the sea, and a rock. The response includes all three labels, one for each object.

This makes it possible to analyze every movement before this is stored or sent as a notification.

To use image rekognition, you need to set up a AWS account with an IAM user. More Infos: [AWS Image Rekognition](https://aws.amazon.com/rekognition/?nc1=h_ls&blog-cards.sort-by=item.additionalFields.createdDate&blog-cards.sort-order=desc)

# PWA

camera.ui is a full-featured PWA (Progressive Web Application). The PWA offers several advantages over a normal web page. Via Windows/macOS/Android the browser can directly send you push notifications natively. The handling of the page becomes much faster and much more.

To "enable" PWA you need to run the page over HTTPS. In the config.json you can provide your own SSL key and certificate to run camera.ui over HTTPS.

# Supported clients

This plugin has been verified to work with the following apps/systems:

- iOS
- Android
- Windows 10
- macOS Catalina 10.15
- Node >= 14

### Browser

The following browsers are supported by this plugin:

- Chrome - latest
- Firefox - latest
- Safari - 2 most recent major versions
- iOS - 2 most recent major versions

_MS Internet Explorer (any version) is not supported!_

# Supported Cameras

Every camera with an active RTSP stream!

# FAQ

Please check our [FAQ](https://github.com/SeydX/camera.ui/wiki/FAQ) before you open an issue.

# Contributing

You can contribute to this in following ways:

- Report issues and help verify fixes as they are checked in.
- Review the source code changes.
- Contribute bug fixes.
- Contribute changes to extend the capabilities
- Pull requests are accepted.

See [CONTRIBUTING](https://github.com/SeydX/camera.ui/blob/master/CONTRIBUTING.md)

# Troubleshooting
If you have any issues then you can run camera.ui in debug mode, which will provide some additional information. This might be useful for debugging issues. Open the interface > settings > system > 

https://github.com/SeydX/camera.ui/wiki/Debug

# License

### MIT License

Copyright (c) 2020-2022 SeydX

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
