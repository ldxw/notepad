const {VueLoaderPlugin} = require("vue-loader");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const PrerenderSPAPlugin = require('prerender-spa-plugin-next');
const webpack = require('webpack');
const path = require("path");

const isProd = (process.env.NODE_ENV === 'production');

const webpackConfig = {
    mode: isProd ? 'production' : 'development',
    entry: './src/main.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js'
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: [
                            ['@babel/preset-env', {targets: "ie 11"}]
                        ]
                    }
                },
            },
            {
                test: /\.vue$/,
                loader: "vue-loader",
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader'
                ]
            },
            {
                test: /\.scss$/,
                use: [
                    'style-loader',
                    'css-loader',
                    'postcss-loader',
                    'sass-loader'
                ]
            }
        ],
    },
    plugins: [
        new VueLoaderPlugin(),
        new HtmlWebpackPlugin({
            title: process.env.VUE_APP_COMPONENT_TITLE,
            template: "public/index.html",
            inject: true,
            minify: false,
            hash: true
        }),
        new webpack.DefinePlugin({
      'process.env': JSON.stringify({
        VUE_APP_META_DESCRIPTION: process.env.VUE_APP_META_DESCRIPTION || "小窝笔记,自动加密的网页版记事本,无需注册.",
        VUE_APP_META_KEYWORDS: process.env.VUE_APP_META_KEYWORDS || "云记事本, 在线记事本, 带密码的在线记事本, 加密记事本, 网页版记事本, 网络记事本, 在线写字板, 在线文本编辑器, 网页记事本, SimpleNote 替代品, Standard Notes 替代品",
        VUE_APP_PAGE_TITLE: process.env.VUE_APP_PAGE_TITLE || "小窝笔记 - 在线存储您的笔记",
        VUE_APP_COMPONENT_TITLE: process.env.VUE_APP_COMPONENT_TITLE || "note.ldxw.top",
        VUE_APP_APP_KEY: process.env.VUE_APP_APP_KEY || "note.ldxw.top",
        VUE_APP_H3_TITLE: process.env.VUE_APP_H3_TITLE || "在线储存您的笔记",
        VUE_APP_FAVICON_URL: process.env.VUE_APP_FAVICON_URL || "https://fastly.jsdelivr.net/gh/ldxw/cdn@master/logo/svg/logo/32x32/favicon.ico"
      })
    })
    ],
    devServer: {
        proxy: [
            {
                context: ['/api', '/notes'],
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        ]
    },
    resolve: {
        extensions: [".js", ".vue"],
    },
};

if (isProd) {

    const prerender = new PrerenderSPAPlugin({
        routes: ['/']
    });

    // requires extra dependencies
    // error while loading shared libraries: libX11-xcb.so.1: cannot open shared object file: No such file or directory
    // webpackConfig.plugins.push(prerender);
}

module.exports = webpackConfig;
