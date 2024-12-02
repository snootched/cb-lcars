const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
    entry: './src/cb-lcars.js',
    output: {
        filename: 'cb-lcars.js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', {
                                targets: {
                                    // Specify target browsers or environments
                                    browsers: ['> 1%'],
                                    node: 'current',
                                },
                                modules: false, // Disable module transforms
                            }],
                        ],
                        plugins: [
                            // Add necessary plugins like @babel/plugin-proposal-decorators
                            ['@babel/plugin-proposal-decorators', { legacy: true }],
                        ],
                    },
                },
            },
        ],
    },
    resolve: {
        extensions: ['.js'],
    },
    devtool: 'source-map',
    cache: false,
    optimization: {
        usedExports: true,
        minimizer: [
            new TerserPlugin(),
        ],
    },
    plugins: [
        new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            openAnalyzer: false,
        }),
    ],
};