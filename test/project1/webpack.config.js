const Plugin = require('../..').default;

module.exports = [
  {
    entry: { entry: './entry.js', entry2: './entry2.js', external: './external.js' },
    mode: 'production',
    // mode: 'development',
    devtool: 'source-map',
    output: {
      filename: '[name].min.js',
      libraryTarget: 'umd',
      publicPath: 'http://localhost:8080/dist/',
    },
    plugins: [new Plugin()],
    externals: { 'external': 'mod/external.esm.min.mjs' },
  },
];
