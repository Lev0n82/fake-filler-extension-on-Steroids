import * as path from "path";

import Dotenv from "dotenv-webpack";
import * as webpack from "webpack";
import { merge } from "webpack-merge";
import TerserPlugin from "terser-webpack-plugin";

import webpackConfig from "./webpack.config";

const { CleanWebpackPlugin } = require("clean-webpack-plugin");

const productionConfig: webpack.Configuration = {
  mode: "production",
  devtool: false,
  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [path.join(__dirname, "dist")],
    }),
    new Dotenv({
      path: "./.env.production",
      silent: true, // Don't fail if .env file is missing
      defaults: false, // Don't load .env.defaults
    }),
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        parallel: true,
        terserOptions: {
          output: {
            ascii_only: true,
          },
        },
      }) as any,
    ],
  },
};

export default merge(webpackConfig, productionConfig);
