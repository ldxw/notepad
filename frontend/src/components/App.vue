<template>

  <div class="header" :style="{'--note-color': noteColor}">

    <h1>
        <span class="brand-icon" v-html="brandIcon"></span>
        <a href="/" @click.prevent="goHome" class="brand">{{ siteName }}</a>
        <template v-if="documentIdShort">
            <span>&ndash;</span><span class="doc-id">#{{ documentIdShort }}</span>
        </template>
    </h1>

    <div class="hidden md:block flex-grow text-center items-center mb-0" v-html="banner"></div>

      <!-- 语言切换：按钮只显示当前语言，点开下拉再选；移动端也直接显示，不折叠 -->
      <div class="lang-switch header-lang" ref="langWrap">

              <button type="button"
                      class="lang-current"
                      :class="{open: langMenuOpen}"
                      :title="t('lang.switch')"
                      :aria-label="t('lang.label')"
                      aria-haspopup="listbox"
                      :aria-expanded="langMenuOpen ? 'true' : 'false'"
                      @click.stop="toggleLangMenu()">
                  <span class="lang-text">{{ currentLocaleLabel }}</span>
                  <span class="lang-caret" aria-hidden="true" v-html="caretIcon"></span>
              </button>

              <!-- 语言面板：与主题面板同一套外观（标题 + 列表），展开在按钮正下方 -->
              <div class="theme-panel lang-panel" v-if="langMenuOpen">
                  <div class="theme-panel-title">{{ t('lang.switch') }}</div>
                  <ul class="lang-list" role="listbox" :aria-label="t('lang.label')">
                      <li v-for="l in locales" :key="l.code" role="none">
                          <button type="button"
                                  class="lang-option"
                                  role="option"
                                  :class="{active: l.code === currentLocale}"
                                  :aria-selected="l.code === currentLocale ? 'true' : 'false'"
                                  @click="pickLocale(l.code)">
                              <span>{{ l.label }}</span>
                              <span class="lang-check" aria-hidden="true" v-html="l.code === currentLocale ? checkIcon : ''"></span>
                          </button>
                      </li>
                  </ul>
              </div>
          </div>

      <button type="button"
              class="header-toggle"
              :class="{active: headerMenuOpen}"
              :aria-expanded="headerMenuOpen ? 'true' : 'false'"
              aria-haspopup="true"
              :title="t('app.settings')"
              :aria-label="t('app.settings')"
              @click.stop="toggleHeaderMenu()"
              v-html="toggleIcon"></button>

      <div class="flex items-center shrink-0 ml-auto header-actions" :class="{open: headerMenuOpen}">
          <!-- 主题：明暗模式（跟随系统 / 浅色 / 深色）—— 与语言切换同一套分段控件观感 -->
          <div class="seg" :title="t('theme.label')" :aria-label="t('theme.label')">
              <button type="button"
                      v-for="m in themeModes"
                      :key="m.id"
                      :class="['seg-btn', {active: m.id === themeMode}]"
                      :title="t(m.labelKey)"
                      :aria-label="t(m.labelKey)"
                      :aria-pressed="m.id === themeMode"
                      @click="pickMode(m.id)"
                      v-html="m.icon"></button>
          </div>

          <!-- 主题：整套皮肤选择（点击展开面板） -->
          <div class="seg theme-wrap" ref="themeWrap">
              <button type="button"
                      class="seg-btn"
                      :title="t('theme.pick')"
                      :aria-label="t('theme.pick')"
                      aria-haspopup="true"
                      :aria-expanded="themePanelOpen ? 'true' : 'false'"
                      @click.stop="toggleThemePanel()"
                      v-html="paletteIcon"></button>

              <div v-if="themePanelOpen" class="theme-panel">
                  <div class="theme-panel-title">{{ t('theme.pick') }}</div>
                  <div class="theme-grid">
                      <button type="button"
                              class="theme-card"
                              v-for="s in skinList"
                              :key="s.id"
                              :class="{active: s.id === themeSkin}"
                              :aria-pressed="s.id === themeSkin"
                              @click="pickSkin(s.id)">
                          <span class="theme-swatch" :style="swatchStyle(s.id)"><i></i></span>
                          <span class="theme-name">{{ t(s.labelKey) }}</span>
                      </button>
                  </div>
              </div>
          </div>
      </div>

  </div>

    <Backups v-if="isBackups"></Backups>
    <Editor v-else-if="state.authKey"></Editor>
    <Home v-else></Home>

    <!-- 站点页脚：首页可见；进编辑页后不显示（编辑页要占满屏幕） -->
    <footer class="site-footer" v-if="!state.authKey || isBackups">
        <p>© {{ year }} {{ siteName }} · <span v-html="t('app.footerCredit')"></span></p>
    </footer>

</template>

<script>
import Editor from "./Editor.vue";
import Home from "./Home.vue";
import Backups from "./Backups.vue";

import store from "../store";
import {t, locale, setLocale, availableLocales, siteNameFor} from "../i18n";
import {currentTheme, setMode, setSkin, skins, swatchFor, isDark} from "../theme";

// 图标用内联 svg，跟着 currentColor 走，不依赖字体
const ICON_AUTO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/></svg>';
const ICON_LIGHT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const ICON_DARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const ICON_SLIDERS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>';
const ICON_CARET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
const ICON_PALETTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.7 0 2.5-1 2.5-2s-.8-2-2.5-2h-1.2a1.8 1.8 0 0 1 0-3.6H14A7 7 0 0 0 21 6.4C20.3 4.4 16.6 3 12 3z"/><circle cx="7.6" cy="10.4" r="1.1" fill="currentColor" stroke="none"/><circle cx="11.4" cy="7.2" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.2" cy="9.2" r="1.1" fill="currentColor" stroke="none"/></svg>';
// 品牌图标用线性 SVG（不用 emoji：不同系统渲染差异大，且无法跟随主题色）
const ICON_BRAND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>';

export default {
  components: {
    Home,
    Editor,
    Backups
  },
  data() {

    const now = currentTheme();

    return {
      state: store.state,
      locales: availableLocales,
      themeMode: now.mode,
      themeSkin: now.skin,
      themePanelOpen: false,
      themeModes: [
        {id: "auto", labelKey: "theme.auto", icon: ICON_AUTO},
        {id: "light", labelKey: "theme.light", icon: ICON_LIGHT},
        {id: "dark", labelKey: "theme.dark", icon: ICON_DARK}
      ],
      skinList: skins,
      paletteIcon: ICON_PALETTE,
      caretIcon: ICON_CARET,
      checkIcon: ICON_CHECK,
      toggleIcon: ICON_SLIDERS,
      brandIcon: ICON_BRAND,
      // 语言下拉：默认收起
      langMenuOpen: false,
      // 移动端页头控件面板：默认收起
      headerMenuOpen: false
    }
  },
  computed: {
    // 页头名字跟着界面语言走（可用 SITE_NAME_ZH / SITE_NAME_EN 分别指定）
    siteName() {
        return siteNameFor(locale.value)
    },
    error() {
      return store.state.error
    },
    banner() {
        return t('app.banner')
    },
    currentLocale() {
        return locale.value
    },
    // 按钮上显示的是“当前语言”的名字，选择后跟着变
    currentLocaleLabel() {
        const found = this.locales.find((one) => one.code === this.currentLocale);
        return found ? found.label : this.currentLocale;
    },
    // /backups/ 由前端渲染，页头页尾就是这一份，服务端不再单独写一遍
    isBackups() {
        return /^\/backups\/?$/.test(window.location.pathname);
    },
    year() {
        return new Date().getFullYear()
    },
    // 打开笔记时，页头顶部一条细线用笔记自己的颜色；没打开则不加线
    noteColor(){
        if (store.state.authKey) {
            const hex = (store.state.authKey || "").substring(0, 8);
            return '#' + hex;
        }

        return 'transparent';
    },
    documentIdShort() {

      if (store.state.authKey) {
        return (store.state.authKey || "").substring(0, 8);
      }

      return null;
    }
  },
  methods: {
    t,
    setLocale,
    pickLocale(code) {
      setLocale(code);
      this.langMenuOpen = false;
    },
    toggleLangMenu() {
      this.langMenuOpen = !this.langMenuOpen;

      // 两个浮层互斥：开一个就收起另一个，避免叠在一起
      if (this.langMenuOpen) {
        this.themePanelOpen = false;
      }
    },
    toggleThemePanel() {
      this.themePanelOpen = !this.themePanelOpen;

      if (this.themePanelOpen) {
        this.langMenuOpen = false;
      }
    },
    pickMode(id) {
      setMode(id);
      this.themeMode = id;
    },
    pickSkin(id) {
      setSkin(id);
      this.themeSkin = id;
      this.themePanelOpen = false;
    },
    // 预览色块用与主题同一份调色板数据算，不手写颜色
    swatchStyle(id) {
      return swatchFor(id, isDark());
    },
    onDocumentClick(event) {
      const wrap = this.$refs.themeWrap;
      if (this.themePanelOpen && wrap && !wrap.contains(event.target)) {
        this.themePanelOpen = false;
      }

      // 语言下拉：点外面就收起（展开按钮自己 stop 掉了）
      const langWrap = this.$refs.langWrap;
      if (this.langMenuOpen && langWrap && !langWrap.contains(event.target)) {
        this.langMenuOpen = false;
      }

      // 移动端控件面板：点面板外面就收起（按钮自己 stop 掉了）
      if (this.headerMenuOpen) {
        const actions = document.querySelector('.header-actions');
        const toggle = document.querySelector('.header-toggle');
        if (actions && !actions.contains(event.target) && toggle && !toggle.contains(event.target)) {
          this.headerMenuOpen = false;
          this.themePanelOpen = false;
        }
      }
    },
    onDocumentKeydown(event) {
      if (event.key === 'Escape') {
        this.themePanelOpen = false;
        this.headerMenuOpen = false;
        this.langMenuOpen = false;
      }
    },
    goHome() {
      store.actions.reset();

      // 不在首页（比如 /backups/）时，单纯 reset 不会离开当前页面，得真的跳回 /
      if (window.location.pathname !== "/") {
        window.location.assign("/");
      }
    },
    toggleHeaderMenu() {
      this.headerMenuOpen = !this.headerMenuOpen;

      if (this.headerMenuOpen) {
        this.langMenuOpen = false;
      } else {
        this.themePanelOpen = false;
      }
    }
  },
  mounted() {
    document.addEventListener('click', this.onDocumentClick);
    document.addEventListener('keydown', this.onDocumentKeydown);
  },
  unmounted() {
    document.removeEventListener('click', this.onDocumentClick);
    document.removeEventListener('keydown', this.onDocumentKeydown);
  }
}
</script>
