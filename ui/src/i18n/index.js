import Vue from 'vue';
import VueI18n from 'vue-i18n';
import Languages from './languages';

const supportedLanguages = (lang) => {
  switch (lang) {
    case 'de':
    case 'nl':
      return lang;
    default:
      return 'en';
  }
};

const currentLanguage = (lang) => {
  if ((!lang || lang === '') && window.navigator && window.navigator.language) {
    return supportedLanguages(Languages[window.navigator.language.toLowerCase()]);
  }

  if (!lang || lang === '') {
    return supportedLanguages('en');
  }

  return supportedLanguages(Languages[lang.toLowerCase()]);
};

const loadLanguage = (lang) => {
  return require(`./locale/${currentLanguage(lang)}.json`);
};

const lang = currentLanguage();

Vue.use(VueI18n);

const index18n = new VueI18n({
  locale: lang,
  messages: loadLanguage(lang),
});

export { index18n as i18n, currentLanguage, loadLanguage, supportedLanguages };
