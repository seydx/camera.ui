module.exports = {
  verbose: true,
  rootDir: './',
  transform: {},
  coveragePathIgnorePatterns: ['test.js'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['./setup.js'],
  testEnvironment: 'jest-environment-node',
  //testRunner: '../node_modules/jest-jasmine2/build/index',
};
