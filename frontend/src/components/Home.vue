<template>
    <div class="home">

        <section class="hero">
            <h1>{{ t('home.loginTitle') }}</h1>

            <input type="text" id="phrase" ref="query" :placeholder="t('home.phrasePlaceholder')"
                   autocomplete="off"
                   autocapitalize="off" @keydown.enter="login" v-model="phrase" :disabled="isBusy">

            <div class="strength" aria-hidden="true">
                <span :style="{width: strengthPct + '%', backgroundColor: strengthColor}"></span>
            </div>

            <p class="phrase-hint">{{ t('home.phraseHint') }}</p>

            <p class="stats">
                {{ t('home.characters') }}: <b>{{ passLen }}</b>
                <span class="sep">·</span>
                {{ t('home.words') }}: <b>{{ wordCount }}</b>
                <span class="sep">·</span>
                {{ t('home.entropy') }}: <b>{{ entropy }}</b> {{ t('home.bits') }}
            </p>
        </section>

        <section class="section">
            <p v-html="t('home.description')"></p>

            <h2>{{ t('home.featuresTitle') }}</h2>

            <ul id="notepad_features">
                <li v-html="t('home.feature1')"></li>

                <li v-html="t('home.feature2')"></li>

                <li v-html="t('home.feature3')"></li>

                <li v-html="t('home.feature4')"></li>
            </ul>

            <p v-html="t('home.portable')"></p>
        </section>

        <section class="section">
            <h2>{{ t('home.securityTitle') }}</h2>

            <p v-html="t('home.securityP1')"></p>

            <p v-html="t('home.securityP2')"></p>

            <p>
                <a class="backups-link" href="/backups/" target="_blank">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/><rect x="2" y="3" width="20" height="5" rx="1.5"/><path d="M10 12h4"/></svg>
                    /backups/
                </a>
            </p>

            <p v-html="t('home.securityP3')"></p>

            <p v-html="t('home.securityP4')"></p>
        </section>

        <section class="section">
            <h2>{{ t('home.forgotTitle') }}</h2>

            <p v-html="t('home.forgotP')"></p>
        </section>

        <section class="section">
            <h2>{{ t('home.feedbackTitle') }}</h2>

            <p class="pb-12">
                {{ t('home.feedbackP') }}

                <a href="https://github.com/Athlon1600/notepad"
                   target="_blank">https://github.com/Athlon1600/notepad</a>
            </p>
        </section>

    </div>
</template>

<script>

import {TextUtil} from "../classes/TextUtil";
import {Util} from "../classes/Util";

import {Security} from "../classes/Security";
import {APP_KEY} from "../config";
import store from "../store";
import {t} from "../i18n";

export default {
    data() {
        return {
            isBusy: false,
            phrase: '',
        }
    },
    computed: {
        wordCount: function () {
            return TextUtil.wordCount(this.phrase);
        },
        entropy: function () {
            // TODO: do not assume charset size of 26 as most phrases will be [a-z] + space
            return Util.calcEntropy(26, this.phrase.length);
        },
        // words in english dictionary; 171,146 words
        // attacked not at the letter level but at the word level.
        phraseEntropy() {
            return Util.calcEntropy(30000, this.wordCount);
        },
        passLen: function () {
            return this.phrase.length;
        },
        // 熵 0~128 bit 映射到进度条 0~100%
        strengthPct: function () {
            return Math.max(0, Math.min(100, Math.round((this.entropy / 128) * 100)));
        },
        strengthColor: function () {
            if (!this.phrase.length) {
                return 'transparent';
            }

            const pct = this.strengthPct;

            if (pct < 35) {
                return '#e5484d';
            }

            if (pct < 65) {
                return '#f5a623';
            }

            return '#2fa84f';
        }
    },
    methods: {
        t,
        async login() {

            if (this.phrase.length >= 1) {

                this.isBusy = true;

                const val = this.phrase;

                console.time('scrypt');

                const hash = await Security.slowHash(val, APP_KEY);

                console.timeEnd('scrypt');

                this.isBusy = false;

                store.mutations.login(hash);
            }
        }
    },
    mounted() {
        this.$refs.query.focus();
    }
}
</script>
