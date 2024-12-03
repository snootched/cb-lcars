const path = require('path');

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
            },
        ],
    },
    resolve: {
        extensions: ['.js'],
    },
    devtool: 'source-map',
    cache: false,
};

