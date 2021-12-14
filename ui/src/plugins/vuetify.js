import Vue from 'vue';
import Vuetify from 'vuetify/lib/framework';
import minifyTheme from 'minify-css-string';

Vue.use(Vuetify);

export default new Vuetify({
  icons: {
    iconfont: 'mdiSvg',
  },
  options: { minifyTheme },
});
