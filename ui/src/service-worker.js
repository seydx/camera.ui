/* eslint-disable no-undef */
workbox.core.setCacheNameDetails({ prefix: 'camera.ui' });

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

let click_open_url;
self.addEventListener('push', function (event) {
  if (!(self.Notification && self.Notification.permission === 'granted')) return;

  const data = event.data.json();
  const title = `${data.camera} (${data.room})`;

  click_open_url = self.location.origin + (data.recordStoring ? '/files/' + data.fileName : '/notifications');

  const options = {
    type: 'image',
    dir: 'auto',
    body: `${data.camera} - ${data.time}`,
    tag: 'camera.ui',
    persistent: true,
    badge: 'img/web/logo.png',
    icon: 'img/web/logo.png',
    iconUrl: 'img/web/logo.png',
    image: data.recordStoring
      ? `files/${data.name}${data.recordType === 'Video' ? '@2.jpeg' : '.jpeg'}`
      : 'img/web/logo.png',
    imageUrl: data.recordStoring
      ? `files/${data.name}${data.recordType === 'Video' ? '@2.jpeg' : '.jpeg'}`
      : 'img/web/logo.png',
    vibrate: [100, 50, 100],
    eventTime: Date.now(),
    timestamp: Date.now(),
    data: {
      options: {
        action: 'open-only',
        close: true,
        url: click_open_url,
      },
    },
    actions: [
      {
        action: 'open',
        title: 'Open',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  const clickedNotification = event.notification;
  clickedNotification.close();
  if (click_open_url) {
    const promiseChain = clients.openWindow(click_open_url);
    event.waitUntil(promiseChain);
  }
});

self.addEventListener(
  'pushsubscriptionchange',
  (event) => {
    event.waitUntil(
      swRegistration.pushManager.subscribe(event.oldSubscription.options).then((subscription) => {
        console.log(subscription);
        fetch('/api/subscribe', {
          method: 'POST',
          body: JSON.stringify(subscription),
          headers: {
            'Content-Type': 'application/json',
          },
        });
      })
    );
  },
  false
);

self.__precacheManifest = [].concat(self.__precacheManifest || []);
workbox.precaching.precacheAndRoute(self.__precacheManifest, {});
