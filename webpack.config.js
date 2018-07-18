var webpack = require('webpack');
var path = require('path');
var fs = require('fs');

module.exports = {
  watch: true,
  mode: 'development',
  watchOptions: {
    ignored: [/node_modules/],
    poll: 1000,
  },
  target: 'web',
  entry: './src/client/client.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.js'
  },
  module: {
    rules: [
      {
        test: /\.js?$/,
        loader: "babel-loader",
        options: {
          presets: ["es2015"],
          plugins: ["transform-class-properties"]
        },
      }
    ]
  },
}
