/**
 * Bento 主题：把首页排成磁贴网格的一套布局皮肤。
 *
 * 与其它皮肤的区别：别的皮肤只换令牌（配色），这一套还改排版结构 ——
 * 所以它有自己的一份 CSS（下面 import 的 bento.css）和一小段 JS 行为。
 *
 * 约定（见 theme.js）：
 *   · CSS 作用域一律挂在 html[data-skin="bento"] 下，不选中全局，避免影响别的皮肤
 *   · 需要 JS 行为时导出 onApply()，theme.js 会在 applyTheme() 里调用它
 *   · 全部令牌仍走 var(--…)，所以明暗模式、其它皮肤互不干扰
 */

import "./bento.css";

let scrollBound = false;

/** 页头滚动压缩：往下滚时把页头压扁一点，回到顶部还原 */
function bindHeaderShrink() {

    if (scrollBound) {
        return;
    }

    scrollBound = true;

    const update = () => {
        const html = document.documentElement;

        // 只在当前就是 bento 时动作，切走之后不再改别的皮肤
        if (html.dataset.skin !== "bento") {
            html.removeAttribute("data-scrolled");
            return;
        }

        if (window.scrollY > 24) {
            html.setAttribute("data-scrolled", "1");
        } else {
            html.removeAttribute("data-scrolled");
        }
    };

    window.addEventListener("scroll", update, {passive: true});
}

/** theme.js 每次应用主题时调用；只有当前是 bento 才做额外的事 */
export function onApply() {

    bindHeaderShrink();
}

export default {onApply};
