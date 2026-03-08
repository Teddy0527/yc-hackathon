const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background/service-worker.ts',
    content: './src/content/content.ts',
    popup: './src/popup/popup.ts',
    settings: './src/popup/settings.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/popup/popup.html', to: 'popup.html' },
        { from: 'src/popup/popup.css', to: 'popup.css' },
        { from: 'src/popup/settings.html', to: 'settings.html' },
        { from: 'src/popup/settings.css', to: 'settings.css' },
        { from: 'src/assets', to: 'assets', noErrorOnMissing: true },
        { from: 'src/icons', to: 'icons', noErrorOnMissing: true },
        { from: 'src/content/styles.css', to: 'styles.css', noErrorOnMissing: true },
      ],
    }),
  ],
  devtool: 'cheap-module-source-map',
};
