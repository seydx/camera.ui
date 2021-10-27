export default {
  watch: {
    settingsLayout: {
      handler() {
        if (!this.loading) {
          this.setLsSettings(this.settingsLayout);
        }
      },
      deep: true,
    },
  },
  created() {
    this.settingsLayout = this.getLsSettings();

    if (!this.settingsLayout.profile) {
      this.settingsLayout.profile = {};
    }

    if (!this.settingsLayout.general) {
      this.settingsLayout.general = {
        general: {
          expand: true,
        },
        themes: {
          expand: true,
        },
        rooms: {
          expand: true,
        },
      };
    } else if (!this.settingsLayout.general.general) {
      this.settingsLayout.general.general = {
        expand: true,
      };
    } else if (!this.settingsLayout.general.themes) {
      this.settingsLayout.general.themes = {
        expand: true,
      };
    } else if (!this.settingsLayout.general.rooms) {
      this.settingsLayout.general.rooms = {
        expand: true,
      };
    }

    if (!this.settingsLayout.dashboard) {
      this.settingsLayout.dashboard = {
        dashboard: {
          expand: true,
        },
        favourites: {
          expand: true,
        },
      };
    } else if (!this.settingsLayout.dashboard.dashboard) {
      this.settingsLayout.dashboard.dashboard = {
        expand: true,
      };
    } else if (!this.settingsLayout.dashboard.favourites) {
      this.settingsLayout.dashboard.favourites = {
        expand: true,
      };
    }

    if (!this.settingsLayout.cameras) {
      this.settingsLayout.cameras = {
        aws: {
          expand: true,
        },
        cameras: {
          expand: true,
        },
      };
    } else if (!this.settingsLayout.cameras.aws) {
      this.settingsLayout.cameras.aws = {
        expand: true,
      };
    } else if (!this.settingsLayout.cameras.cameras) {
      this.settingsLayout.cameras.cameras = {
        expand: true,
      };
    }

    if (!this.settingsLayout.recordings) {
      this.settingsLayout.recordings = {
        recordings: {
          expand: true,
        },
      };
    } else if (!this.settingsLayout.recordings.recordings) {
      this.settingsLayout.recordings.recordings = {
        expand: true,
      };
    }

    if (!this.settingsLayout.notifications) {
      this.settingsLayout.notifications = {
        notifications: {
          expand: true,
        },
        alexa: {
          expand: true,
        },
        telegram: {
          expand: true,
        },
        webhook: {
          expand: true,
        },
      };
    } else if (!this.settingsLayout.notifications.notifications) {
      this.settingsLayout.notifications.notifications = {
        expand: true,
      };
    } else if (!this.settingsLayout.notifications.alexa) {
      this.settingsLayout.notifications.alexa = {
        expand: true,
      };
    } else if (!this.settingsLayout.notifications.telegram) {
      this.settingsLayout.notifications.telegram = {
        expand: true,
      };
    } else if (!this.settingsLayout.notifications.webhook) {
      this.settingsLayout.notifications.webhook = {
        expand: true,
      };
    }

    if (!this.settingsLayout.camview) {
      this.settingsLayout.camview = {
        camview: {
          expand: true,
        },
        favourites: {
          expand: true,
        },
      };
    } else if (!this.settingsLayout.camview.camview) {
      this.settingsLayout.camview.camview = {
        expand: true,
      };
    } else if (!this.settingsLayout.camview.favourites) {
      this.settingsLayout.camview.favourites = {
        expand: true,
      };
    }
  },
  methods: {
    getLsSettings() {
      const settings = localStorage.getItem('settings')
        ? JSON.parse(localStorage.getItem('settings'))
        : {
            profile: {},
            general: {
              general: {
                expand: true,
              },
              themes: {
                expand: true,
              },
              rooms: {
                expand: true,
              },
            },
            dashboard: {
              dashboard: {
                expand: true,
              },
              favourites: {
                expand: true,
              },
            },
            cameras: {
              aws: {
                expand: true,
              },
              cameras: {
                expand: true,
              },
            },
            recordings: {
              recordings: {
                expand: true,
              },
            },
            notifications: {
              notifications: {
                expand: true,
              },
              alexa: {
                expand: true,
              },
              telegram: {
                expand: true,
              },
              webhook: {
                expand: true,
              },
            },
            camview: {
              camview: {
                expand: true,
              },
              favourites: {
                expand: true,
              },
            },
          };

      return settings;
    },
    setLsSettings(settingsLayout) {
      if (settingsLayout) {
        localStorage.setItem('settings', JSON.stringify(settingsLayout));
      }
    },
  },
};
