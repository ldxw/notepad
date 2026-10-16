/**
 * Fluid 主题的行为：把"真实可用视口高度"写进 --app-vh。
 *
 * 为什么要自己算：移动浏览器的 100vh 是"工具栏收起时的高度"，
 * 键盘弹出或地址栏显隐时它不变，导致编辑区被顶出屏幕。
 * visualViewport.height 才是当下真正可见的高度。
 *
 * 这里只写一个 CSS 变量，不做布局判断 —— 布局仍由 CSS 的媒体查询决定。
 */

import "./fluid.css";

let bound = false;

/** 把当前真实视口高度写到 <html> 上的 --app-vh */
export function syncViewportHeight() {

    try {
        const vv = window.visualViewport;
        const h = (vv && vv.height) || window.innerHeight || 0;

        if (h > 0) {
            document.documentElement.style.setProperty("--app-vh", Math.round(h) + "px");
        }
    } catch (ex) {
        // 拿不到就退回 CSS 里的 100vh 兜底
    }
}

/** theme.js 在应用主题时调用 */
export function onApply() {

    if (!bound) {
        bound = true;

        window.addEventListener("resize", syncViewportHeight, {passive: true});
        window.addEventListener("orientationchange", syncViewportHeight);

        // 键盘弹出 / 地址栏显隐时，visualViewport 比 window 更早更准
        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", syncViewportHeight, {passive: true});
        }
    }

    syncViewportHeight();
}

export default {onApply};
