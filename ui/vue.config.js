const fs = require('fs-extra');
const path = require('path');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

let configJson = {};

try {
  configJson = require('../test/camera.ui/config.json');
} catch {
  // ignore
}

process.env.VUE_APP_SERVER_PORT = configJson.port || 3600;

module.exports = {
  transpileDependencies: ['vuetify'],
  devServer: {
    https:
      configJson.ssl?.active && configJson.ssl?.key && configJson.ssl?.cert
        ? {
            key: fs.readFileSync(configJson.ssl.key),
            cert: fs.readFileSync(configJson.ssl.cert),
          }
        : false,
    port: 8081,
  },
  outputDir: path.resolve(__dirname, '../interface'),
  productionSourceMap: false,
  pwa: {
    name: 'camera.ui',
    themeColor: '#f1f1f1',
    msTileColor: '#f1f1f1',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'black-translucent',
    assetsVersion: Date.now(),
    manifestPath: 'manifest.json',
    manifestOptions: {
      lang: 'en',
      dir: 'ltr',
      name: 'camera.ui',
      short_name: 'camera.ui',
      description: 'camera.ui is a user interface for RTSP capable cameras.',
      theme_color: '#f1f1f1',
      background_color: '#f1f1f1',
      display: 'standalone',
      orientation: 'any',
      id: '/',
      scope: '/',
      start_url: '/',
      icons: [
        {
          src: '/img/icons/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/img/icons/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: '/img/icons/android-chrome-maskable-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/img/icons/android-chrome-maskable-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/img/icons/apple-touch-icon-dark-60x60.png',
          sizes: '60x60',
          type: 'image/png',
        },
        {
          src: '/img/icons/apple-touch-icon-dark-76x76.png',
          sizes: '76x76',
          type: 'image/png',
        },
        {
          src: '/img/icons/apple-touch-icon-dark-120x120.png',
          sizes: '120x120',
          type: 'image/png',
        },
        {
          src: '/img/icons/apple-touch-icon-dark-152x152.png',
          sizes: '152x152',
          type: 'image/png',
        },
        {
          src: '/img/icons/apple-touch-icon-dark-180x180.png',
          sizes: '180x180',
          type: 'image/png',
        },
        {
          src: '/img/icons/apple-touch-icon-dark.png',
          sizes: '180x180',
          type: 'image/png',
        },
        {
          src: '/img/icons/favicon-16x16.png',
          sizes: '16x16',
          type: 'image/png',
        },
        {
          src: '/img/icons/favicon-32x32.png',
          sizes: '32x32',
          type: 'image/png',
        },
        {
          src: '/img/icons/msapplication-icon-144x144.png',
          sizes: '144x144',
          type: 'image/png',
        },
        {
          src: '/img/icons/mstile-150x150.png',
          sizes: '150x150',
          type: 'image/png',
        },
      ],
    },
    iconPaths: {
      favicon32: 'img/icons/favicon-32x32.png',
      favicon16: 'img/icons/favicon-16x16.png',
      appleTouchIcon: 'img/icons/apple-touch-icon-dark-180x180.png',
      maskIcon: 'img/icons/safari-pinned-tab.svg',
      msTileImage: 'img/icons/msapplication-icon-144x144.png',
    },
    workboxPluginMode: 'InjectManifest',
    workboxOptions: {
      swSrc: 'src/service-worker.js',
    },
  },
  chainWebpack: (config) => {
    config.performance.maxEntrypointSize(500000).maxAssetSize(500000);
    config.plugin('html').tap((arguments_) => {
      const payload = arguments_;
      payload[0].title = 'camera.ui';
      return payload;
    });
  },
  configureWebpack: {
    /*performance: {
      hints: process.env.NODE_ENV === 'production' ? false : 'warning',
    },*/
    resolve: {
      alias: {
        jquery: path.resolve(__dirname, 'node_modules/gridstack/dist/jq/jquery.js'),
        'jquery-ui': path.resolve(__dirname, 'node_modules/gridstack/dist/jq/jquery-ui.js'),
        'jquery.ui': path.resolve(__dirname, 'node_modules/gridstack/dist/jq/jquery-ui.js'),
        'jquery.ui.touch-punch': path.resolve(__dirname, 'node_modules/gridstack/dist/jq/jquery.ui.touch-punch.js'),
      },
    },
    plugins: [
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        openAnalyzer: true,
      }),
    ],
  },
  css: {
    extract:
      process.env.NODE_ENV === 'production'
        ? {
            ignoreOrder: true,
          }
        : false,
  },
};
