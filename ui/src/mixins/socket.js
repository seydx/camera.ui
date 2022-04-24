import NotificationBanner from '@/components/notification-banner.vue';

export default {
  data() {
    return {
      notId: '',
      notIdInfo: '',
      notImages: [],
    };
  },
  computed: {
    currentUser() {
      return this.$store.state.auth.user;
    },
    isValidPage() {
      return this.$route.name !== 'Login' && this.$route.name !== 'Start';
    },
  },
  sockets: {
    connect() {
      console.log('Connected to socket');

      if (this.connected) {
        if (this.isPage('Dashboard')) {
          if (this.items && this.instances) {
            const cameras = this.items.filter((item) => item.type === 'CamerasWidget');

            for (const camera of cameras) {
              const instance = this.instances[camera.id];

              if (instance.$refs[camera.id]) {
                instance.$refs[camera.id].refreshStream(true);
              }
            }
          }
        } else if (this.isPage('Camview')) {
          if (this.cameras) {
            for (const camera of this.cameras) {
              if (camera.live) {
                if (this.$refs[camera.name] && this.$refs[camera.name][0]) {
                  this.$refs[camera.name][0].refreshStream(true);
                }
              }
            }
          }
        } else if (this.isPage('Camera')) {
          if (this.camera) {
            if (this.$refs[this.camera.name]) {
              this.$refs[this.camera.name].refreshStream(true);
            }
          }
        }
      }

      this.connected = true;
    },
    disconnect() {
      console.log('Disconnected from socket');
      //this.connected = false;
    },
    // eslint-disable-next-line no-unused-vars
    diskSpace(data) {},
    async unauthenticated() {
      console.log('Disconnected from socket, unauthenticated!');
      this.connected = false;

      await this.$store.dispatch('auth/logout');
      setTimeout(() => this.$router.push('/'), 500);
    },
    async invalidToken(token) {
      if (token === this.currentUser.access_token) {
        console.log('Session timed out');
        this.connected = false;

        await this.$store.dispatch('auth/logout');
        setTimeout(() => this.$router.push('/'), 500);
      }
    },
    notification(notification) {
      if (this.isValidPage && !notification.isSystemNotification) {
        this.notId = '_' + Math.random().toString(36).substr(2, 9);

        if (notification.mediaSource) {
          let mediaContainer = {
            type: 'image',
            caption: notification.title,
            src: notification.mediaSource,
            thumb: notification.thumbnail || notification.mediaSource,
          };

          if (notification.recordType === 'Video') {
            mediaContainer = {
              ...mediaContainer,
              type: 'video',
              sources: [
                {
                  src: notification.mediaSource,
                  type: 'video/mp4',
                },
              ],
              width: '100%',
              height: 'auto',
              autoplay: false,
            };
          }

          this.notImages = [mediaContainer];
        }

        let message = '';

        if (notification.isNotification) {
          let trigger = notification.message.split(' -')[0];
          trigger = this.$t(trigger);

          message = `${trigger} - ${notification.message.split('- ')[1]}`;
        } else {
          message = notification.message;
        }

        const content = {
          component: NotificationBanner,
          props: {
            headerTxt: this.$t('notifications'),
            timeTxt: this.$t('now'),
            title: notification.title,
            message: message,
            subtxt: notification.subtxt,
          },
          listeners: {
            showNotification: () => {
              this.$refs.lightboxBanner?.showImage(0);
            },
          },
        };

        this.$toast.info(content, {
          id: this.notId,
          containerClassName: 'notification-container',
          toastClassName: 'notification-toast',
        });
      }

      if (this.isPage('Notifications')) {
        if (notification.isNotification) {
          let message = this.$t('notification_text').replace('@', notification.camera).replace('%', notification.room);

          this.notifications?.unshift({
            ...notification,
            message: message,
          });

          if (notification.recordStoring) {
            let mediaContainer = {
              type: 'image',
              caption: `${notification.camera} - ${notification.time}`,
              src: `/files/${notification.fileName}`,
              thumb: `/files/${notification.fileName}`,
            };

            if (notification.recordType === 'Video') {
              delete mediaContainer.src;

              mediaContainer = {
                ...mediaContainer,
                type: 'video',
                sources: [
                  {
                    src: `/files/${notification.fileName}`,
                    type: 'video/mp4',
                  },
                ],
                thumb: `/files/${notification.name}@2.jpeg`,
                width: '100%',
                height: 'auto',
                autoplay: false,
              };
            }

            this.images?.unshift({
              id: notification.id,
              ...mediaContainer,
            });
          }
        }
      }
    },
    recording(recording) {
      if (this.isPage('Recordings')) {
        this.recordings?.unshift(recording);

        if (this.totalRecordings !== undefined) {
          this.totalRecordings++;
        }

        let mediaContainer = {
          type: 'image',
          caption: `${recording.camera} - ${recording.time}`,
          src: `/files/${recording.fileName}`,
          thumb: `/files/${recording.fileName}`,
        };

        if (recording.recordType === 'Video') {
          delete mediaContainer.src;

          mediaContainer = {
            ...mediaContainer,
            type: 'video',
            sources: [
              {
                src: `/files/${recording.fileName}`,
                type: 'video/mp4',
              },
            ],
            thumb: `/files/${recording.name}@2.jpeg`,
            width: '100%',
            height: 'auto',
            autoplay: false,
          };
        }

        this.images?.unshift(mediaContainer);
      }
    },
    updated() {
      //this.$toast.success(this.$t('system_successfully_updated'));
    },
  },
  created() {
    this.$socket.client.io.opts.extraHeaders = {
      Authorization: `Bearer ${this.currentUser?.access_token}`,
    };

    this.$socket.client.open();
  },
  methods: {
    closeHandler() {
      this.$toast.dismiss(this.notId);
      this.notId = '';
    },
    isPage(page) {
      if (Array.isArray(page)) {
        return page.some((p) => p === this.$route.name || p === this.$route.meta.name);
      } else if (typeof page === 'string') {
        return this.$route.name === page || this.$route.meta.name === page;
      }

      return false;
    },
  },
};
