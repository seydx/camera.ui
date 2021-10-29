export default {
  computed: {
    currentUser() {
      return this.$store.state.auth.user;
    },
  },
  sockets: {
    connect() {
      console.log('CONNECTED');

      if (this.cameras && this.refreshStreamSocket && this.connected) {
        console.log('REFRESH STREAM');

        for (const camera of this.cameras) {
          if (camera.live) {
            this.refreshStreamSocket({ camera: camera.name });
          }
        }
      }

      this.connected = true;
    },
    disconnect() {
      //this.connected = false;
    },
    async unauthenticated() {
      this.connected = false;

      await this.$store.dispatch('auth/logout');
      setTimeout(() => this.$router.push('/'), 500);
    },
  },
  created() {
    this.$socket.client.io.opts.extraHeaders = {
      Authorization: `Bearer ${this.currentUser?.access_token}`,
    };

    this.$socket.client.open();
  },
};
