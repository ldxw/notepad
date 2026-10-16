/**
 * 构建期把主题调色板导出成 dist/themes.json，供服务端渲染页（/backups/、403）使用。
 *
 * 数据只有一份：这里直接读取 src/theme.js 求值取出 skins，
 * 而不是在后端再抄一份调色板（抄一份就等于以后改色漏一处）。
 *
 * theme.js 里有两处 node 求值不了的东西，去掉即可：
 *   1. 主题模块 import（bento/glass/fluid 会 import .css）
 *   2. THEME_HOOKS 里对这些模块的引用
 * 数据部分本身不依赖 DOM，所以可以安全求值。
 */

import fs from "fs";
import path from "path";
import {fileURLToPath, pathToFileURL} from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.join(dir, "../src/theme.js");
const outDir = path.join(dir, "../dist");
const tmp = path.join(dir, "../.theme-source.tmp.mjs");

let src = fs.readFileSync(srcPath, "utf8");

src = src.replace(/^import .*from "\.\/themes\/.*";$/gm, "");
src = src.replace(/const THEME_HOOKS = \{[\s\S]*?\};/, "const THEME_HOOKS = {};");
src = src.replace(/^export /gm, "");
src += "\nexport const __skins = skins;\n";

fs.writeFileSync(tmp, src, "utf8");

try {
    const mod = await import(pathToFileURL(tmp).href);
    const skins = (mod.__skins || []).map((one) => ({id: one.id, light: one.light, dark: one.dark}));

    if (!skins.length) {
        throw new Error("没取到任何主题数据");
    }

    fs.mkdirSync(outDir, {recursive: true});
    fs.writeFileSync(path.join(outDir, "themes.json"), JSON.stringify({skins}, null, 1), "utf8");
    console.log(`[themes] 导出 ${skins.length} 套主题令牌 → dist/themes.json`);
} finally {
    fs.rmSync(tmp, {force: true});
}
