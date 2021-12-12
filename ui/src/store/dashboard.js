const layout = JSON.parse(localStorage.getItem('dashboard-layout'));
const initialState = { layout: layout || [] };

export const dashboard = {
  namespaced: true,
  state: initialState,
  actions: {
    updateElements: ({ commit }, payload) => {
      commit('updateElements', payload);
      return layout;
    },
  },
  mutations: {
    updateElements: (state, payload) => {
      localStorage.setItem('dashboard-layout', JSON.stringify(payload));
      state.layout = payload;
    },
  },
};
