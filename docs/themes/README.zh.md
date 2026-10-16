# 主题画廊

11 套主题，每套都有浅色与深色两版 —— 一共 **22 种外观**。
两个轴彼此独立：**明暗**（`SITE_THEME` = `auto` / `light` / `dark`）与 **皮肤**（`SITE_SKIN`）。

下面的图都是**真实运行时的截图**（1280×900，首页）。访客在页头自己选过的主题记在浏览器里，
会盖过部署方注入的默认值。

[English](README.md)

| # | `SITE_SKIN` | 名称 | 说明 | 浅色 | 深色 |
|---|---|---|---|---|---|
| 1 | `classic` | 经典 | 默认：现代 teal + 橙色行动色 | ![经典 浅色](classic-light.png) | ![经典 深色](classic-dark.png) |
| 2 | `paper` | 纸张 | 暖纸张色 + 衬线字体 + 6px 圆角 | ![纸张 浅色](paper-light.png) | ![纸张 深色](paper-dark.png) |
| 3 | `ocean` | 海洋 | 蓝色系 | ![海洋 浅色](ocean-light.png) | ![海洋 深色](ocean-dark.png) |
| 4 | `forest` | 森林 | 绿色系 | ![森林 浅色](forest-light.png) | ![森林 深色](forest-dark.png) |
| 5 | `grape` | 葡萄 | 紫色系 | ![葡萄 浅色](grape-light.png) | ![葡萄 深色](grape-dark.png) |
| 6 | `sunset` | 日落 | 暖橙红 | ![日落 浅色](sunset-light.png) | ![日落 深色](sunset-dark.png) |
| 7 | `mono` | 黑白 | 无彩色 + 等宽字体 + 4px 圆角 | ![黑白 浅色](mono-light.png) | ![黑白 深色](mono-dark.png) |
| 8 | `neon` | 霓虹 | 高对比紫青 | ![霓虹 浅色](neon-light.png) | ![霓虹 深色](neon-dark.png) |
| 9 | `bento` | 磁贴 | **改布局**：磁贴网格、提示与统计并成两块、页头滚动压缩 | ![磁贴 浅色](bento-light.png) | ![磁贴 深色](bento-dark.png) |
| 10 | `glass` | 玻璃 | **玻璃拟态**：渐变底 + 星点 + 半透明磨砂卡片 | ![玻璃 浅色](glass-light.png) | ![玻璃 深色](glass-dark.png) |
| 11 | `fluid` | 自适应 | **适配视口**：流体排版与间距、手机上面板变贴底抽屉、考虑安全区 | ![自适应 浅色](fluid-light.png) | ![自适应 深色](fluid-dark.png) |

## 怎么用

```bash
# .env
SITE_THEME="dark"      # auto（默认）/ light / dark
SITE_SKIN="glass"      # 上表任意一个 id
```

首页、备份页、403 页都会跟随。访客在页头选过的（明暗 + 皮肤）记在浏览器里，优先级更高。

## 加一套主题

- **只换配色** → 在 `frontend/src/theme.js` 的 `skins` 数组加一条
  （`id` + 每套语言包里的标签 + 明暗两套令牌）。
- **还要改布局或行为** → 在 `frontend/src/themes/` 放一个模块：
  `<id>.css`（结构样式，选择器一律挂在 `html[data-skin="<id>"]` 下）+ `<id>.js`（可选行为，
  导出 `onApply()`），再在 `theme.js` 的 `THEME_HOOKS` 里登记一行。
  `themes/bento.{css,js}` 就是现成的样板。

调色板只有一份；服务端渲染页读的是它在构建期导出的 `dist/themes.json`。
