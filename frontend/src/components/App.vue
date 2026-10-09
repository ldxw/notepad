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
                      v-for="th in themeOptions"
                      :key="th.code"
                      :class="['seg-btn', {active: th.code === currentTheme}]"
                      :aria-pressed="th.code === currentTheme"
                      :title="t(th.labelKey)"
                      @click="setTheme(th.code)" v-html="themeIcon(th.code)"></button>
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
import {themes, theme, setTheme, themeIcon} from "../theme";

export default {
  components: {
    Home,
    Editor
  },
  data() {
    return {
      state: store.state,
      locales: availableLocales,
      themeOptions: themes
    }
  },
  computed: {
    // 页头名字跟着界面语言走（可用 SITE_NAME_ZH / SITE_NAME_EN 分别指定）
    siteName() {
        return siteNameFor(locale.value)
    },
    currentTheme() {
        return theme.value
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

        // 未登录时用主题色，跟着深浅色切换
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
    setTheme,
    themeIcon,
    goHome() {
      store.actions.reset();
    }
  }
}
</script>
