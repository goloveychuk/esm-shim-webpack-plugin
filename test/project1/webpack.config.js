const Plugin = require('../..').default;

module.exports = [
  {
    entry: { entry: './entry.js', entry2: './entry2.js', external: './external.js' },
    mode: 'development',
    devtool: false,
    output: {
      filename: '[name].min.js',
      libraryTarget: 'umd',
      publicPath: 'http://localhost:8080/dist/',
    },
    plugins: [new Plugin()],
    externals: { 'external': 'mod/external.esm.min.mjs' },
  },
];
