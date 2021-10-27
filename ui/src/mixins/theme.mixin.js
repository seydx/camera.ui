export default {
  mounted() {
    const currentColorTheme = localStorage.getItem('theme-color') ? localStorage.getItem('theme-color') : null;
    if (currentColorTheme) {
      const images = document.querySelectorAll('.theme-img');
      for (const img of images) {
        let imgSource = img.src;
        imgSource = imgSource.split('/');
        imgSource = imgSource[imgSource.length - 1].split('.png')[0].split('.')[0].split('@')[0];

        img.src = require(`@/assets/img/${imgSource}@${currentColorTheme}.png`);
      }
    }
  },
};
