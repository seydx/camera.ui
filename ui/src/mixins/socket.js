import NotificationBanner from '@/components/notification-banner.vue';

export default {
  data() {
    return {
      notId: '',
      notIdInfo: '',
      notImages: [],
      notIndex: null,
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

      if (this.connected && this.isPage(['Dashboard', 'Camview'])) {
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

      this.connected = true;
    },
    disconnect() {
      console.log('Disconnected from socket');
      //this.connected = false;
    },
    async unauthenticated() {
      console.log('Disconnected from socket, unauthenticated!');
      this.connected = false;

      await this.$store.dispatch('auth/logout');
      setTimeout(() => this.$router.push('/'), 200);
    },
    async invalidToken(token) {
      if (token === this.currentUser.access_token) {
        console.log('Session timed out');
        this.connected = false;

        await this.$store.dispatch('auth/logout');
        setTimeout(() => this.$router.push('/'), 200);
      }
    },
    notification(notification) {
      if (this.isValidPage && !notification.isSystemNotification) {
        this.notId = '_' + Math.random().toString(36).substr(2, 9);

        if (notification.mediaSource) {
          this.notImages = [
            {
              title: notification.title,
              src: notification.mediaSource,
              thumb: notification.thumbnail || notification.mediaSource,
            },
          ];
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
              this.notIndex = notification.recordStoring ? 0 : null;
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
            this.images?.unshift({
              id: notification.id,
              title: `${notification.camera} - ${notification.time}`,
              src: `/files/${notification.fileName}`,
              thumb:
                notification.recordType === 'Video'
                  ? `/files/${notification.name}@2.jpeg`
                  : `/files/${notification.fileName}`,
            });
          }
        }
      }
    },
    recording(recording) {
      if (this.isPage('Recordings')) {
        this.recordings?.unshift(recording);

        this.images?.unshift({
          title: `${recording.camera} - ${recording.time}`,
          src: `/files/${recording.fileName}`,
          thumb: recording.recordType === 'Video' ? `/files/${recording.name}@2.jpeg` : `/files/${recording.fileName}`,
        });
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
      this.notIndex = null;
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
