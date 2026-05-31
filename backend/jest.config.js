module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'routes/**/*.js',
    'utils/**/*.js',
    'config/**/*.js',
    'server.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  // Отключаем трансформацию для простых .js файлов
  transform: {}
};