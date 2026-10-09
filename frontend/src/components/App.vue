<template>

  <div class="header" :style="{'background-image': `linear-gradient(to right, var(--header-bg), var(--header-bg), ${noteColor})`}">

    <h1 class="mb-0">
        <svg class="hidden md:inline-block mr-1" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent);vertical-align:-2px" aria-hidden="true"><path d="M14 3v5h5"/><path d="M18 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2Z"/><path d="M9 13h6M9 17h4"/></svg>
        <a href="/" @click.prevent="goHome" class="brand">{{ siteName }}</a>
        <template v-if="documentIdShort">
            <span class="mx-2">&ndash;</span>#{{ documentIdShort }}
        </template>
    </h1>

    <div class="header-banner" v-html="banner"></div>

      <div class="flex items-center shrink-0">
          <nav class="nav-links hidden md:flex">
              <a href="https://github.com/Athlon1600/notepad" target="_blank" rel="nofollow noopener noreferrer">{{ t('app.githubRepo') }}</a>
          </nav>

          <div class="seg" :title="t('lang.switch')" :aria-label="t('lang.label')">
              <button type="button"
                      v-for="l in locales"
                      :key="l.code"
                      :class="['seg-btn', {active: l.code === currentLocale}]"
                      :aria-pressed="l.code === currentLocale"
                      @click="setLocale(l.code)">{{ l.label }}</button>
          </div>

          <div class="seg" :title="t('theme.label')" :aria-label="t('theme.label')">
              <button type="button"
                      v-for="m in themeOptions"
                      :key="m.code"
                      :class="['seg-btn', {active: m.code === currentMode}]"
                      :aria-pressed="m.code === currentMode"
                      :title="t(m.labelKey)"
                      @click="setMode(m.code)" v-html="themeIcon(m.code)"></button>
          </div>

          <div class="seg theme-wrap" ref="themeWrap">
              <button type="button"
                      class="seg-btn"
                      :title="t('theme.pick')"
                      :aria-label="t('theme.pick')"
                      aria-haspopup="true"
                      :aria-expanded="themePanelOpen ? 'true' : 'false'"
                      :class="{active: themePanelOpen}"
                      @click.stop="themePanelOpen = !themePanelOpen"
                      v-html="paletteIcon"></button>

              <div v-if="themePanelOpen" class="theme-panel">
                  <div class="theme-panel-title">{{ t('theme.pick') }}</div>
                  <div class="theme-grid">
                      <button type="button"
                              class="theme-card"
                              v-for="s in skinList"
                              :key="s.id"
                              :class="{active: s.id === currentSkin}"
                              :aria-pressed="s.id === currentSkin"
                              @click="pickSkin(s.id)">
                          <span class="theme-swatch" :style="swatchStyle(s.id)"><i></i></span>
                          <span class="theme-name">{{ t(s.labelKey) }}</span>
                      </button>
                  </div>
              </div>
          </div>
      </div>

  </div>

    <Editor v-if="state.authKey"></Editor>
    <Home v-else></Home>

</template>

<script>
import Editor from "./Editor.vue";
import Home from "./Home.vue";

import store from "../store";
import {t, locale, setLocale, availableLocales, siteNameFor} from "../i18n";
import {modes, mode, setMode, themeIcon, PALETTE_ICON, skins, skin, setSkin, swatchFor, isDark} from "../theme";

export default {
  components: {
    Home,
    Editor
  },
  data() {
    return {
      state: store.state,
      locales: availableLocales,
      themeOptions: modes,
      skinList: skins,
      paletteIcon: PALETTE_ICON,
      themePanelOpen: false
    }
  },
  computed: {
    // 页头名字跟着界面语言走（可用 SITE_NAME_ZH / SITE_NAME_EN 分别指定）
    siteName() {
        return siteNameFor(locale.value)
    },
    currentMode() {
        return mode.value
    },
    currentSkin() {
        return skin.value
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
    noteColor(){
        if (store.state.authKey) {
            const hex = (store.state.authKey || "").substring(0, 8);
            return '#' + hex;
        }

        // 未登录时用主题底色，跟着皮肤/深浅色切换
        return 'var(--header-bg)';
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
    setMode,
    themeIcon,
    pickSkin(id) {
      setSkin(id);
      this.themePanelOpen = false;
    },
    // 面板里的预览色块用「当前明暗」下的那套色板
    swatchStyle(id) {
      return swatchFor(id, isDark());
    },
    onDocumentClick(e) {
      const wrap = this.$refs.themeWrap;

      if (wrap && !wrap.contains(e.target)) {
        this.themePanelOpen = false;
      }
    },
    onDocumentKeydown(e) {
      if (e.key === 'Escape') {
        this.themePanelOpen = false;
      }
    },
    goHome() {
      store.actions.reset();
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
