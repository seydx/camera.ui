module.exports = {
  verbose: true,
  rootDir: './',
  coveragePathIgnorePatterns: ['test.js'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['./setup'],
  testEnvironment: 'node',
  testRunner: '../node_modules/jest-jasmine2/build/index',
};
