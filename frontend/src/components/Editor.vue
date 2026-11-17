<template>
  <div class="w-full max-w-screen-lg mx-auto flex flex-col flex-grow mt-5 px-1 lg:px-0">

    <div class="toolbar">
      <p>{{ t('editor.toolbar') }}</p>
    </div>

    <div id="plain_text_not_ace" class="flex flex-col flex-grow">

      <textarea @keyup="textKeyUp" @keydown="textKeyDown" @select="textSelect" @mouseup="textSelect" v-model="text"
                :placeholder="t('editor.placeholder')" style="resize: none"
                class="flex-grow"></textarea>

      <div class="flex justify-between mt-2 mb-5">

        <div class="status-bar">
          {{ t('editor.words') }}: <span class="stat-num">{{ wordCount }}</span>
          · {{ t('editor.characters') }}: <span class="stat-num"><span v-if="selectedCharCount">{{ selectedCharCount }}/</span>{{ charCount }}</span>
          · {{ t('editor.lines') }}: <span class="stat-num">{{ lineCount }}</span>
          <span class="size-bar" :class="{'size-bar-full': isTooLong}">
            · {{ t('editor.sizeOf', {size: payloadSizeText, max: maxPayloadText}) }}
          </span>
        </div>

        <div>
          <a href="" @click.prevent="deleteForever" class="font-bold text-red-500">{{ t('editor.deleteForever') }}</a>
        </div>

      </div>

      <p v-if="isTooLong" class="limit-warning" role="alert">
        {{ t('editor.tooLong', {max: maxPayloadText}) }}
      </p>

    </div>

  </div>
</template>

<script>
import {watch} from "vue";

import {TextUtil} from "../classes/TextUtil";
import debounce from "debounce";
import store from "../store";
import {SecureStorage} from "../classes/SecureStorage";
import {t} from "../i18n";
import {NOTE_MAX_BYTES} from "../config";
import {begin, update, finish, fail, dismiss} from "../classes/Progress";

export default {
  data() {
    return {
      isBusy: true,
      text: '',
      // stats
      charCount: 0,
      selectedCharCount: 0,
      wordCount: 0,
      lineCount: 0,
      // 加密后发到服务端的请求体体积，与后端 express.text 的上限对照
      payloadSize: 0,
      maxPayload: NOTE_MAX_BYTES
    }
  },
  computed: {
    isTooLong() {
      return this.payloadSize > this.maxPayload;
    },
    payloadSizeText() {
      return TextUtil.humanFileSize(this.payloadSize);
    },
    maxPayloadText() {
      return TextUtil.humanFileSize(this.maxPayload);
    }
  },
  watch: {
    // nothing
  },
  methods: {
    t,
    writeNow: async function () {

      // 超限时不发请求：服务端会回 413，弹窗比状态栏里那行红字更打断人。
      // 文本还在编辑框里，删掉一些字就会恢复自动保存。
      if (this.isTooLong) {
        return;
      }

      try {

        const text = this.text;
        // activeKdf 命中 v1 兜底后，读写都粘在 v1 地址上
        const authKey = store.state.activeAuthKey;
        const password = store.state.activeEncryptionKey;

        const task = begin('save');

        try {
          await SecureStorage.write(authKey, text, password, (f, stage) => update(task, f, stage), store.state.activeKdf);
          finish(task);
        } catch (ex) {
          fail(task);
          throw ex;
        }

      } catch (ex) {
        // 失败已经由进度条的内联红字提示过了，这里只留一条控制台记录，
        // 避免弹窗和进度条重复报同一个错。
        console.warn('[notepad] save failed', ex);
      }

    },
    writeLater: debounce(async function () {
      await this.writeNow();
    }, 800),
    textKeyDown(event) {

      if (event.ctrlKey || event.metaKey) {
        switch (String.fromCharCode(event.which).toLowerCase()) {
          case 's':
            event.preventDefault();
            break;
        }
      }
    },
    async textKeyUp() {
      // 常驻的「✓ 保存完成」在用户再次输入时收起（只收已完成态，不影响进行中的保存）
      dismiss();
      this.writeLater();
    },
    textSelect(event) {

      const target = event.target;

      let val = target.value;
      let start = target.selectionStart;
      let end = target.selectionEnd;

      if (start === end) {
        this.selectedCharCount = 0;
      } else {

        let selected = val.substring(start, end);
        this.selectedCharCount = selected.length;
      }

    },
    deleteForever() {

      if (confirm(t('editor.confirmDelete'))) {

            const key = store.state.activeAuthKey;

            SecureStorage.remove(key).then(() => {
                store.actions.reset();
            }).catch(() => {
                alert(t('editor.deleteFailed'));
            });
      }

    }
  },
  mounted() {

    // Logged in as new user!
    watch(() => store.state.authKey, async (newValue, oldValue) => {

      this.isBusy = true;

      // 切换笔记/口令：上一条常驻的保存完成态到此结束
      dismiss();

      const task = begin('read');

      try {

        if (newValue) {
            const password = store.state.encryptionKey;
            let text = await SecureStorage.read(newValue, password, (f, stage) => update(task, f, stage));

            // v2 地址为空 → 换 v1 兜底键再查一次。存量笔记（尤其非 ASCII 口令的）
            // 都存放在旧派生参数的 v1 地址上；命中后粘住 v1，写入也走 v1 地址，
            // 避免同一篇笔记在两个派生地址之间分叉。兜底命中会重放一遍进度。
            if (!text && store.state.authKeyV1) {
                text = await SecureStorage.read(store.state.authKeyV1, store.state.encryptionKeyV1, (f, stage) => update(task, f, stage));

                if (text) {
                    store.mutations.setActiveKdf('v1');
                }
            }

            this.text = text;

            // 大文本写进 textarea（Vue patch 时就地赋值）往往比下载+解密还慢，
            // 等 DOM 更新完再把进度推到 100%，否则条子停在末尾不动反而像卡住。
            await this.$nextTick();
            update(task, 1);

        } else {
          this.text = '';
        }

        finish(task);

      } catch (ex) {
        // 读失败只体现在进度条的红字上；在 watch 回调里 rethrow 会变成
        // 没人接的 unhandled rejection，控制台里凭空多一条报错。
        fail(task);
        console.warn('[notepad] load failed', ex);
      } finally {
        this.isBusy = false;
      }

    }, {
      immediate: true
    });

    const updateTextStats = debounce(() => {

      let str = this.text;

      this.payloadSize = TextUtil.encryptedPayloadSize(str);

      if (str) {
        this.wordCount = TextUtil.wordCount(str);
        this.charCount = str.length;
        this.lineCount = TextUtil.lineCount(str);
      } else {
        this.wordCount = 0;
        this.charCount = 0;
        this.lineCount = 0;
      }

    }, 100)

    watch(() => this.text, function () {
      updateTextStats();
    }, {
      immediate: true
    });

  },
  async beforeUnmount() {
    // 离开编辑页：收起可能还挂着的保存完成态
    dismiss();
  }
}
</script>
