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
      return this.$route.meta.name !== 'login' && this.$route.meta.name !== 'start';
    },
  },
  sockets: {
    connect() {
      console.log('Connected to socket');

      if (this.connected && this.isPage(['dashboard', 'camview'])) {
        if (this.cameras) {
          for (const camera of this.cameras) {
            if (camera.live) {
              this.refreshStreamSocket({ camera: camera.name });
            }
          }
        }
      } else if (this.isPage('camera')) {
        if (this.camera?.live) {
          this.refreshStreamSocket({ camera: this.camera.name });
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
      setTimeout(() => this.$router.push('/'), 500);
    },
    notification(notification) {
      if (this.isValidPage) {
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

        const content = {
          component: NotificationBanner,
          props: {
            headerTxt: this.$t('notifications'),
            timeTxt: this.$t('now'),
            title: notification.title,
            message: notification.message,
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

      if (this.isPage('notifications')) {
        if (notification.isNotification) {
          this.notifications?.unshift(notification);

          if (notification.recordStoring) {
            this.images?.unshift({
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
      if (this.isPage('recordings')) {
        this.recordings?.unshift(recording);

        this.images?.unshift({
          title: `${recording.camera} - ${recording.time}`,
          src: `/files/${recording.fileName}`,
          thumb: recording.recordType === 'Video' ? `/files/${recording.name}@2.jpeg` : `/files/${recording.fileName}`,
        });
      }
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
        return page.includes(this.$route.meta.name);
      } else if (typeof page === 'string') {
        return this.$route.meta.name === page;
      }

      return false;
    },
  },
};
