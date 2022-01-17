//https://dev.to/drbragg/handling-service-worker-updates-in-your-vue-pwa-1pip
import UpdateBanner from '@/components/update-banner.vue';

export default {
  data() {
    return {
      // refresh variables
      refreshing: false,
      registration: null,
      updateExists: false,
    };
  },

  created() {
    if ('serviceWorker' in navigator) {
      // Listen for our custom event from the SW registration
      document.addEventListener('swUpdated', this.updateAvailable, { once: true });

      // Prevent multiple refreshes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (this.refreshing) return;
        this.refreshing = true;
        // Here the actual reload of the page occurs
        window.location.reload();
      });
    }

    this.$store.dispatch('config/loadConfig');
  },

  methods: {
    // Store the SW registration so we can send it a message
    // We use `updateExists` to control whatever alert, toast, dialog, etc we want to use
    // To alert the user there is an update they need to refresh for
    updateAvailable(event) {
      this.registration = event.detail;
      this.updateExists = true;

      this.idInfo = 'swUpdate';

      const content = {
        component: UpdateBanner,
        props: {
          updateInformTxt: this.$t('new_content_available'),
          updateNowTxt: this.$t('refresh'),
        },
        listeners: {
          updateClicked: () => this.refreshApp(),
        },
      };

      this.$toast(content, {
        id: this.idInfo,
      });
    },

    // Called when the user accepts the update
    refreshApp() {
      this.updateExists = false;
      this.$toast.dismiss(this.idInfo);
      // Make sure we only send a 'skip waiting' message if the SW is waiting
      if (!this.registration || !this.registration.waiting) return;
      // send message to SW to skip the waiting and activate the new SW
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    },
  },
};
