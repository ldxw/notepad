const {VueLoaderPlugin} = require("vue-loader");
const HtmlWebpackPlugin = require("html-webpack-plugin");

// 页面元信息（description / keywords / author / title）集中在 site.config.js，
// 下面用 templateParameters 注入 public/index.html —— 改一处即可，不用动 HTML。
const site = require("./site.config");

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
            title: site.title,
            template: "public/index.html",
            // 把 public/favicon.ico 复制进 dist/ 并自动注入 <link rel="icon">；
            // 运行时可以用 SITE_ICON 覆盖掉这个 href（见 backend/src/SiteMeta.ts）
            favicon: path.resolve(__dirname, "public/favicon.ico"),
            inject: true,
            minify: false,
            hash: true,
            templateParameters: {site}
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

// 预渲染不再由 webpack 插件负责（见 scripts/prerender.mjs）：
// 原来那套插件依赖 puppeteer@1.20（2019 年，只提供 x86_64 版 Chromium，
// 在 arm64 上必然启动失败）。现在 `npm run build` 在 webpack 之后调用
// scripts/prerender.mjs，用官方 Chrome for Testing 的 headless-shell + --dump-dom
// 生成静态首页 —— x64 与 arm64 都有官方二进制，两种架构行为一致。

module.exports = webpackConfig;
