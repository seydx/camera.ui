/* eslint-disable no-console */

import { register } from 'register-service-worker';
import { getKeys, subscribe } from '@/api/subscribe.api';

import store from '@/store';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; ++index) {
    outputArray[index] = rawData.charCodeAt(index);
  }
  return outputArray;
}

if (process.env.NODE_ENV === 'production') {
  register(`${process.env.BASE_URL}service-worker.js`, {
    registrationOptions: { scope: './' },
    async ready(reg) {
      console.log(
        'App is being served from cache by a service worker.\n' + 'For more details, visit https://goo.gl/AFskqB'
      );

      let deferredPrompt;
      const addButton = document.querySelector('.add-button');

      if (addButton) {
        window.addEventListener('beforeinstallprompt', (event) => {
          event.preventDefault();
          deferredPrompt = event;

          addButton.style.display = 'block';

          addButton.addEventListener('click', () => {
            addButton.style.display = 'none';

            deferredPrompt.prompt();

            deferredPrompt.userChoice.then((choiceResult) => {
              if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the A2HS prompt');
              } else {
                console.log('User dismissed the A2HS prompt');
              }
              deferredPrompt = null;
            });
          });
        });
      }

      if ('PushManager' in window && Notification.permission !== 'denied') {
        let subscription = await reg.pushManager.getSubscription();
        let isSubscribed = !(subscription === null);
        let reReg = false;

        const user = JSON.parse(JSON.stringify(store.getters['auth/user']));

        if (
          user &&
          user.access_token &&
          user.permissionLevel.some((level) => level === 'recordings:access' || level === 'admin')
        ) {
          const webpush = await getKeys();

          if (isSubscribed && !webpush.data.subscription) {
            subscription.unsubscribe();
            reReg = true;
          } else if (!isSubscribed) {
            reReg = true;
          }

          if (reReg) {
            try {
              const newSubscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(webpush.data.publicKey),
              });

              await subscribe(newSubscription);
            } catch (error) {
              console.log('Can not subscribe user!', error);
            }
          }
        } else if (isSubscribed) {
          subscription.unsubscribe();
        }
      }
    },
    registered() {
      console.log('Service worker has been registered.');
    },
    cached() {
      console.log('Content has been cached for offline use.');
    },
    updatefound() {
      console.log('New content is downloading.');
    },
    updated(reg) {
      console.log('New content is available;');
      document.dispatchEvent(new CustomEvent('swUpdated', { detail: reg }));
      //reg.update();
    },
    offline() {
      console.log('No internet connection found. App is running in offline mode.');
    },
    error(error) {
      console.error('Error during service worker registration:', error);
    },
  });
}
