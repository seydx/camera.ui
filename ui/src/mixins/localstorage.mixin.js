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
        automation: {
          expand: true,
        },
        themes: {
          expand: true,
        },
        rooms: {
          expand: true,
        },
      };
    }

    if (!this.settingsLayout.general.general) {
      this.settingsLayout.general.general = {
        expand: true,
      };
    }

    if (!this.settingsLayout.general.automation) {
      this.settingsLayout.general.automation = {
        expand: true,
      };
    }

    if (!this.settingsLayout.general.themes) {
      this.settingsLayout.general.themes = {
        expand: true,
      };
    }

    if (!this.settingsLayout.general.rooms) {
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
          camerasExpands: {},
        },
      };
    }

    if (!this.settingsLayout.dashboard.dashboard) {
      this.settingsLayout.dashboard.dashboard = {
        expand: true,
      };
    }

    if (!this.settingsLayout.dashboard.favourites) {
      this.settingsLayout.dashboard.favourites = {
        expand: true,
        camerasExpands: {},
      };
    }

    if (!this.settingsLayout.dashboard.favourites.camerasExpands) {
      this.settingsLayout.dashboard.favourites.camerasExpands = {};
    }

    if (!this.settingsLayout.cameras) {
      this.settingsLayout.cameras = {
        aws: {
          expand: true,
        },
        cameras: {
          expand: true,
          camerasExpands: {},
        },
      };
    }

    if (!this.settingsLayout.cameras.aws) {
      this.settingsLayout.cameras.aws = {
        expand: true,
      };
    }

    if (!this.settingsLayout.cameras.cameras) {
      this.settingsLayout.cameras.cameras = {
        expand: true,
        camerasExpands: {},
      };
    }

    if (!this.settingsLayout.cameras.cameras.camerasExpands) {
      this.settingsLayout.cameras.cameras.camerasExpands = {};
    }

    if (!this.settingsLayout.recordings) {
      this.settingsLayout.recordings = {
        recordings: {
          expand: true,
        },
      };
    }

    if (!this.settingsLayout.recordings.recordings) {
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
    }

    if (!this.settingsLayout.notifications.notifications) {
      this.settingsLayout.notifications.notifications = {
        expand: true,
      };
    }

    if (!this.settingsLayout.notifications.alexa) {
      this.settingsLayout.notifications.alexa = {
        expand: true,
      };
    }

    if (!this.settingsLayout.notifications.telegram) {
      this.settingsLayout.notifications.telegram = {
        expand: true,
      };
    }

    if (!this.settingsLayout.notifications.webhook) {
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
          camerasExpands: {},
        },
      };
    }

    if (!this.settingsLayout.camview.camview) {
      this.settingsLayout.camview.camview = {
        expand: true,
      };
    }

    if (!this.settingsLayout.camview.favourites) {
      this.settingsLayout.camview.favourites = {
        expand: true,
        camerasExpands: {},
      };
    }

    if (!this.settingsLayout.camview.favourites.camerasExpands) {
      this.settingsLayout.camview.favourites.camerasExpands = {};
    }

    if (!this.settingsLayout.config) {
      this.settingsLayout.config = {
        config: {
          expand: true,
        },
        server: {
          expand: true,
        },
      };
    }

    if (!this.settingsLayout.config.server) {
      this.settingsLayout.config.server = {
        expand: true,
      };
    }

    if (!this.settingsLayout.config.config) {
      this.settingsLayout.config.config = {
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
              automation: {
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
                camerasExpands: {},
              },
            },
            cameras: {
              aws: {
                expand: true,
              },
              cameras: {
                expand: true,
                camerasExpands: {},
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
                camerasExpands: {},
              },
            },
            config: {
              config: {
                expand: true,
              },
              server: {
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
