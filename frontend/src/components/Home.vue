<template>
    <div class="w-full max-w-screen-lg mx-auto px-1">

        <div class="login-box">

            <h1 class="text-center"> {{ t('home.loginTitle') }}</h1>

            <input type="text" id="phrase" ref="query" :placeholder="t('home.phrasePlaceholder')"
                   autocomplete="off"
                   autocapitalize="off" @keydown.enter="login" v-model="phrase" :disabled="isBusy">

            <div class="text-muted mt-2">{{ t('home.phraseHint') }}
            </div>

            <p class="my-5">
                <small class="text-muted">{{ t('home.characters') }}: {{ passLen }}
                    <span class="mx-2"></span> {{ t('home.words') }}: {{ wordCount }}
                    <span class="mx-2"></span> {{ t('home.entropy') }}: {{ entropy }} {{ t('home.bits') }}
                </small>
            </p>

        </div>

        <div class="notes-root">

            <section class="note-card">
                <p v-html="t('home.description')"></p>
            </section>

            <section class="note-card">
                <h2>{{ t('home.featuresTitle') }}</h2>

                <ul id="notepad_features">
                    <li v-html="t('home.feature1')"></li>

                    <li v-html="t('home.feature2')"></li>

                    <li v-html="t('home.feature3')"></li>

                    <li v-html="t('home.feature4')"></li>
                </ul>

                <p v-html="t('home.portable')"></p>
            </section>

            <section class="note-card">
                <h2>{{ t('home.securityTitle') }}</h2>

                <p v-html="t('home.securityP1')"></p>

                <p v-html="t('home.securityP2')"></p>

                <p class="backup-row">
                    <a class="backup-link" href="/backups/" target="_blank" rel="noopener noreferrer">
                        <svg class="backup-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
                             aria-hidden="true">
                            <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h9A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/>
                        </svg>
                        <span>/backups/</span>
                    </a>
                    <span class="backup-note" v-html="t('home.securityP3')"></span>
                </p>

                <p v-html="t('home.securityP4')"></p>
            </section>

            <section class="note-card">
                <h2>{{ t('home.forgotTitle') }}</h2>

                <p v-html="t('home.forgotP')"></p>
            </section>

        </div>

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
