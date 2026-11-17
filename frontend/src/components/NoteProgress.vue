<template>

  <!-- 页头下沿的细条 + 居中的百分比；只在一段读写真的超过 SHOW_DELAY 时出现。
       保存完成态是常驻的（直到用户再次输入/切笔记才收起），样式切到 is-done。 -->
  <Transition name="note-progress">
    <div class="note-progress" :class="{'is-failed': progress.failed, 'is-done': isDone}" v-if="progress.visible">

      <div class="note-progress-track">
        <div class="note-progress-fill" :style="{width: percent + '%'}"></div>
      </div>

      <!-- 失败/完成时它不再是「正在推进」，改成状态播报，避免读屏器念一个停住的百分比 -->
      <span class="note-progress-label"
            :role="isDone || progress.failed ? 'status' : 'progressbar'"
            :aria-valuenow="isDone || progress.failed ? null : percent"
            :aria-valuemin="isDone || progress.failed ? null : 0"
            :aria-valuemax="isDone || progress.failed ? null : 100"
            :aria-valuetext="label"
            :aria-busy="busy"><span v-if="isDone" class="note-progress-check" aria-hidden="true">✓</span>{{ label }}</span>

    </div>
  </Transition>

</template>

<script>
import store from "../store";
import {t} from "../i18n";

export default {
  name: "NoteProgress",
  computed: {
    progress() {
      return store.state.progress;
    },
    percent() {
      const v = this.progress.value;
      return Math.round((v > 1 ? 1 : (v < 0 ? 0 : v)) * 100);
    },
    label() {
      const saving = this.progress.phase === 'save';

      if (this.progress.failed) {
        return t(saving ? 'editor.saveFailedShort' : 'editor.loadFailedShort');
      }

      // done 由 Progress 在推到 100% 收尾时置位：保存完成态常驻期间一直是它
      if (this.isDone) {
        return t(saving ? 'editor.saved' : 'editor.loaded');
      }

      // 阶段只是文案细分：没给 stage（或给了不认识的值）就回落到「保存中 / 加载中」
      const stage = this.progress.stage || '';

      let key = saving ? 'editor.saving' : 'editor.loading';

      if (saving) {
        if (stage === 'encrypt') {
          key = 'editor.encrypting';
        } else if (stage === 'upload') {
          key = 'editor.uploading';
        }
      } else if (stage === 'download') {
        key = 'editor.downloading';
      } else if (stage === 'decrypt') {
        key = 'editor.decrypting';
      }

      return t(key, {percent: this.percent});
    },
    isDone() {
      return this.progress.done && !this.progress.failed;
    },
    busy() {
      // 完成/失败后操作已经结束，不再对读屏器报告「仍在进行」
      return !this.progress.failed && !this.isDone && this.percent < 100;
    }
  }
};
</script>
