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
      zIndex: {
        1: '1',
        2: '2',
        3: '3',
        4: '4',
        5: '5',
        6: '6',
        7: '7',
        8: '8',
        9: '9',
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
