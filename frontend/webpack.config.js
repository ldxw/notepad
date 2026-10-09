const {VueLoaderPlugin} = require("vue-loader");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const PrerenderSPAPlugin = require('prerender-spa-plugin-next')

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

// 预渲染（prerender）默认关闭，原因见下：
//   它依赖 puppeteer 自带的 Chromium，而 puppeteer@1.20 只提供 x86_64 的 Linux 版
//   （下载表里只有 Linux_x64）。arm64 构建时它会拉到一个 x86_64 二进制，
//   启动必然失败（Failed to launch chrome! ... ENOENT），从而让多架构构建中断。
//   之前它在构建期负责把首页 HTML 预渲染出来（给搜索引擎看）。
// 需要预渲染时（仅能用于 amd64 构建）：
//   PRERENDER=true npm run build
//   并且 Dockerfile 的 vue-build 阶段需要装回 Chromium 的系统库。
const enablePrerender = isProd && process.env.PRERENDER === 'true';

if (enablePrerender) {

    const prerender = new PrerenderSPAPlugin({
        routes: ['/']
    });

    webpackConfig.plugins.push(prerender);
}

module.exports = webpackConfig;
