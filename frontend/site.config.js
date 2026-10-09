// 站点元信息 —— 单一数据源。
// 这些值会在构建时由 webpack（HtmlWebpackPlugin 的 templateParameters）注入到
// public/index.html 里，所以改这里就够了，不用去改 HTML。
// 说明：<title> 在运行时还会被 src/i18n.js 按当前语言覆盖（中/英两套标题），
// 这里的 title 是构建出的静态 HTML 里的默认值（英文）。
module.exports = {

    // 页面标题（静态 HTML 默认值；运行时按语言切换）
    title: "Online Notepad - store your notes securely online",

    // <meta name="description">
    description: "Web-based Notepad with automatic encryption. No registration needed. Maximum privacy. Zero tracking.",

    // <meta name="keywords">
    keywords: "cloud notepad, online notepad, online notepad with password, encrypted notepad, web based notepad, internet notepad, online writing pad, textpad online, web notepad, simplenote alternative, standard notes alternative",

    // <meta name="author">
    author: "Athlon1600",

    // 站点地址（保留给 canonical / og:url 之类的扩展用）
    siteUrl: "https://notepad.mx"
};
