import Dotenv from "dotenv-webpack";
import * as webpack from "webpack";
import { merge } from "webpack-merge";

import webpackConfig from "./webpack.config";

const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

const developmentConfig: webpack.Configuration = {
  mode: "development",
  devtool: "inline-source-map",
  plugins: [
    new ForkTsCheckerWebpackPlugin(),
    new webpack.SourceMapDevToolPlugin({
      exclude: /^vendor.*.\.js$/,
      filename: "[file].map",
    }),
    new Dotenv({
      silent: true, // Don't fail if .env file is missing
      defaults: false, // Don't load .env.defaults
    }),
  ],
};

export default merge(webpackConfig, developmentConfig);
