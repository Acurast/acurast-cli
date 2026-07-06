const { resolve } = require("path")

module.exports = {
  entry: "./src/index.ts",
  mode: "production",
  output: {
    filename: "bundle.js",
    path: resolve(__dirname, "dist"),
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  target: "node",
}
