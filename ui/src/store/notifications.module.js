const initialState = { size: 0 };

const notifications = {
  namespaced: true,
  state: initialState,
  actions: {
    socket_notification({ commit }, notification) {
      if (notification.count) {
        commit('increaseNotifications');
      }
    },
    socket_increaseNotification({ commit }) {
      commit('increaseNotifications');
    },
    socket_notificationSize({ commit }, size) {
      commit('updateNotifications', size);
    },
    socket_removeNotification({ commit }) {
      commit('decreaseNotifications');
    },
    decrease: ({ commit }) => {
      commit('decreaseNotifications');
    },
    removeAll: ({ commit }) => {
      commit('updateNotifications', 0);
    },
  },
  mutations: {
    decreaseNotifications(state) {
      state.size--;
    },
    increaseNotifications(state) {
      state.size++;
    },
    updateNotifications(state, size) {
      state.size = size;
    },
  },
  getters: {
    getSize(state) {
      return state.size;
    },
  },
};

export { notifications };
