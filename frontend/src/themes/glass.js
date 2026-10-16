/**
 * Glass 主题：本身只需要一份 CSS（玻璃拟态的观感全在样式里），
 * 这里负责把样式引进来，并保持与其它主题一致的 onApply() 出口。
 */

import "./glass.css";

export function onApply() {
    // 玻璃拟态不需要额外行为；留这个出口是为了让主题模块的形状统一
}

export default {onApply};
