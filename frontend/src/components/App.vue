<template>

  <div class="header" :style="{'background-image': `linear-gradient(to right, cornsilk, cornsilk, ${noteColor})`}">

    <h1 class="mb-0">
        <span class="hidden md:inline mr-1">&#x1F4C3;</span>
        <a href="/" @click.prevent="goHome" class="brand">notepad.mx</a>
        <template v-if="documentIdShort">
            <span class="mx-2">&ndash;</span>#{{ documentIdShort }}
        </template>
    </h1>

    <div class="hidden md:block flex-grow text-center items-center mb-0" v-html="banner"></div>

      <div class="flex items-center shrink-0">
          <nav class="nav-links hidden md:flex">
              <a href="https://github.com/Athlon1600/notepad" target="_blank" rel="nofollow noopener noreferrer">{{ t('app.githubRepo') }}</a>
          </nav>

          <div class="lang-switch" :title="t('lang.switch')" :aria-label="t('lang.label')">
              <button type="button"
                      v-for="l in locales"
                      :key="l.code"
                      :class="['lang-btn', {active: l.code === currentLocale}]"
                      :aria-pressed="l.code === currentLocale"
                      @click="setLocale(l.code)">{{ l.label }}</button>
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
import {t, locale, setLocale, availableLocales} from "../i18n";

export default {
  components: {
    Home,
    Editor
  },
  data() {
    return {
      state: store.state,
      locales: availableLocales
    }
  },
  computed: {
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

        return 'cornsilk';
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
    goHome() {
      store.actions.reset();
    }
  }
}
</script>
