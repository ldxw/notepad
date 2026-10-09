<template>
    <div class="w-full max-w-screen-lg mx-auto px-1">

        <div style="max-width:700px; margin:3em auto;">

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

        <hr>

        <div class="my-5">

            <p v-html="t('home.description')"></p>

            <h2>{{ t('home.featuresTitle') }}</h2>

            <ul id="notepad_features">
                <li v-html="t('home.feature1')"></li>

                <li v-html="t('home.feature2')"></li>

                <li v-html="t('home.feature3')"></li>

                <li v-html="t('home.feature4')"></li>

            </ul>

            <p class="my-4"></p>

            <p v-html="t('home.portable')"></p>


            <h2>{{ t('home.securityTitle') }}</h2>

            <p v-html="t('home.securityP1')"></p>

            <p v-html="t('home.securityP2')"></p>

            <p>
                <a href="https://notepad.mx/backups/" target="_blank">https://notepad.mx/backups/</a>
                <br>
                <span v-html="t('home.securityP3')"></span>
            </p>

            <p v-html="t('home.securityP4')"></p>

            <h2>{{ t('home.forgotTitle') }}</h2>

            <p v-html="t('home.forgotP')"></p>

            <h2>{{ t('home.feedbackTitle') }}</h2>

            <p class="pb-12">
                {{ t('home.feedbackP') }}

                <a href="https://github.com/Athlon1600/notepad"
                   target="_blank">https://github.com/Athlon1600/notepad</a>
            </p>

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
