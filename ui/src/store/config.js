import { i18n, loadLanguage, supportedLanguages, languageList } from '@/i18n';
import { getConfig } from '@/api/config.api';

const initialState = { ui: false };

export const config = {
  namespaced: true,
  state: initialState,
  actions: {
    async loadConfig({ commit }) {
      try {
        const response = await getConfig();
        commit('saveConfig', response.data);

        const lang = localStorage.getItem('language');
        commit('setLang', lang);

        let mode = localStorage.getItem('theme') ? localStorage.getItem('theme').split('-')[0] : 'dark';
        const color = localStorage.getItem('theme-color') || 'pink';
        const autoMode = localStorage.getItem('darkmode') === 'auto';

        if (autoMode) {
          mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        commit('setTheme', `${mode}-${color}`);
      } catch (error) {
        console.log(error);
      }
    },
  },
  mutations: {
    saveConfig(state, config) {
      state.ui = {
        ...config,
        currentLanguage: i18n.locale,
        validLangs: languageList,
        validThemes: [
          'light-blue',
          'light-blgray',
          'light-brown',
          'light-green',
          'light-gray',
          'light-orange',
          'light-pink',
          'light-purple',
          'dark-blue',
          'dark-blgray',
          'dark-brown',
          'dark-green',
          'dark-gray',
          'dark-orange',
          'dark-pink',
          'dark-purple',
        ],
      };
    },
    setLang(state, lang) {
      if (!lang) {
        lang = i18n.locale;
      }

      lang = supportedLanguages(lang);

      if (lang in i18n.messages) {
        i18n.locale = lang;
      } else {
        const messages = loadLanguage(lang);
        i18n.setLocaleMessage(lang, messages[lang]);
        i18n.locale = lang;
      }

      state.ui.currentLanguage = lang;
      localStorage.setItem('language', lang);
    },
    setTheme(state, theme) {
      if (state.ui.validThemes.includes(theme)) {
        const darkmode = theme.split('-')[0];
        const colorTheme = theme.split('-')[1];

        document.documentElement.dataset.theme = darkmode;
        document.documentElement.dataset.themeColor = colorTheme;

        localStorage.setItem('theme', darkmode);
        localStorage.setItem('theme-color', colorTheme);
      }
    },
  },
  getters: {
    getConfig(state) {
      return state.ui;
    },
  },
};
