const layout = JSON.parse(localStorage.getItem('camview-layouts'));
const initialState = { layout: layout || {} };

export const camview = {
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
      const storedLayout = JSON.parse(localStorage.getItem('camview-layouts')) || {};
      storedLayout[Object.keys(payload)[0]] = Object.values(payload)[0];
      localStorage.setItem('camview-layouts', JSON.stringify(storedLayout));
      state.layout = storedLayout;
    },
  },
};
