const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  important: true,
  corePlugins: {
    preflight: false,
  },
  purge: ['/public/index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  prefix: 'tw-',
  darkMode: false,
  theme: {
    extend: {
      maxWidth: {
        '10xl': '100rem',
      },
    },
    screens: {
      xxs: '275px',
      xs: '475px',
      ...defaultTheme.screens,
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};
