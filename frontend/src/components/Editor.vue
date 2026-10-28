<template>
  <div class="w-full max-w-screen-lg mx-auto flex flex-col flex-grow mt-5 px-1 lg:px-0">

    <div class="toolbar">
      <p>{{ t('editor.toolbar') }}</p>
    </div>

    <!-- 另一台设备改了这篇笔记，而我们这边正在输入：不动用户的字，只提醒 -->
    <div v-if="remotePending" class="sync-banner" role="status">
      <span class="sync-banner-text">{{ t('editor.remoteUpdate') }}</span>
      <span class="sync-banner-actions">
        <button type="button" class="sync-btn sync-btn-primary" @click="loadRemote">
          {{ t('editor.remoteApply') }}
        </button>
        <button type="button" class="sync-btn" @click="keepLocal">
          {{ t('editor.remoteKeep') }}
        </button>
      </span>
    </div>

    <div id="plain_text_not_ace" class="flex flex-col flex-grow">

      <textarea @keyup="textKeyUp" @keydown="textKeyDown" @select="textSelect" @mouseup="textSelect" v-model="text"
                :placeholder="t('editor.placeholder')" style="resize: none"
                class="flex-grow"></textarea>

      <div class="flex justify-between mt-2 mb-5">

        <div class="status-bar">
          {{ t('editor.words') }}: {{ wordCount }},
          {{ t('editor.characters') }}: <span v-if="selectedCharCount">{{ selectedCharCount }}/</span>{{ charCount }},
          {{ t('editor.lines') }}: {{ lineCount }}
        </div>

        <div>
          <a href="" @click.prevent="deleteForever" class="font-bold text-red-500">{{ t('editor.deleteForever') }}</a>
        </div>

      </div>

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

// https://github.com/reddit-archive/reddit/blob/753b17407e9a9dca09558526805922de24133d53/r2/r2/models/link.py#L149
const TEXT_MAX_LEN = 40000;

// 多设备同步的轮询间隔。3 秒是「另一端几乎立刻能看到」和「别把服务器打爆」之间的折中：
// 一个在线页面 = 每 3 秒一次 GET，命中时只有几百字节的密文。
const SYNC_INTERVAL_MS = 3000;

// 自动保存是 800ms debounce：用户只要停手不到一秒，本地就会把内容写回服务器，
// 「本地没有未保存改动」于是不再等价于「我是个纯旁观者」——我刚刚写回去的那一版，
// 很可能马上被另一台设备覆盖掉。在这段时间内看到远端内容变了，就不能静默替换
// 屏幕上的字（那正是"吞字"），而要按「另一台设备更新了」的路径交给用户决定。
// 5 秒 = debounce(0.8s) + 一个轮询周期(3s) + 一点余量；再长会把「只是看笔记的人」
// 也当成编辑者，一直弹提示，反而破坏了无缝刷新的体验。
const RECENT_WRITE_GRACE_MS = 5000;

export default {
  data() {
    return {
      isBusy: true,
      isWriting: false,
      // 每次写入成功 +1，用来识别「轮询请求在路上时本地又写了」的竞态
      writeSeq: 0,
      text: '',
      // ── 同步状态 ──────────────────────────────────────────────────────────
      // 屏幕上这份内容，被认为是「服务器上也是这份」的那个快照。
      // text !== syncedText 等价于「本地有还没写回服务器的改动」。
      syncedText: '',
      // 已知的远端版本标记（加密信封里的 timestamp）。用它判断远端有没有翻新，
      // 不能拿密文比 —— 每次加密的 IV 都是随机的，同一份明文密文也不同。
      lastVersion: null,
      // 远端有更新、但本地正在输入时暂存在这里，等用户决定
      remotePending: null,
      // 本端最近一次写回成功的时间戳。配合 RECENT_WRITE_GRACE_MS 判断
      // 「我这会儿其实还在写」—— 自动保存会把 text 拉回等于 syncedText，
      // 只看这两个字符串分不清「旁观者」和「刚写回、别人又改」。
      lastWriteAt: 0,
      // stats
      charCount: 0,
      selectedCharCount: 0,
      wordCount: 0,
      lineCount: 0
    }
  },
  computed: {
    // 本地是否还有没同步出去的改动
    hasLocalChanges() {
      return this.text !== this.syncedText;
    },
    authKey() {
      return store.state.authKey;
    },
    password() {
      return store.state.encryptionKey;
    }
  },
  methods: {
    t,

    /**
     * 把远端内容落到界面上，并把同步基线一起前移：
     * 之后 hasLocalChanges 为 false，轮询不会又把它当成一次远端更新。
     */
    applyRemote(remote) {
      this.text = remote.text;
      this.syncedText = remote.text;
      this.lastVersion = remote.version;
      this.remotePending = null;
      // 屏幕上这份就是远端那一版了，不再处于「我刚写回、可能被覆盖」的状态
      this.lastWriteAt = 0;
    },

    /**
     * 把本地内容写回服务器。
     *
     * @param {boolean} force 用户明确选择「保留我的」时为 true：跳过冲突检测直接覆盖。
     */
    writeNow: async function (force = false) {

      try {

        const text = this.text;
        const authKey = store.state.authKey;
        const password = store.state.encryptionKey;

        // 已经挂着「另一台设备更新了」的提示：在用户做出选择之前不再自动覆盖，
        // 否则提示条还没看清就被自己的自动保存抹平了。
        if (!force && this.remotePending) {
          return;
        }

        // 自动保存只在真有改动时才发请求：文本已经等于服务器上的那份，
        // 再写一遍只是白白多一次往返（还会把版本号往前推，制造假的「更新」）。
        if (!force && text === this.syncedText) {
          return;
        }

        this.isWriting = true;

        // 写之前先看一眼服务器。如果它在我上一次同步之后已经被别的设备改过，
        // 我这一版就是基于旧内容写的 —— 直接 POST 会把对方的改动整段抹掉，
        // 而对方那边看起来还是「我记得我改过」。所以这里不写，改成挂提示。
        // 这一步是冲突检测的关键：只靠轮询周期去发现，会因为 800ms 的自动保存
        // 先落地而错过窗口（那一刻本地「看起来很干净」）。
        if (!force) {

          const remote = await SecureStorage.pull(authKey, password);

          if (store.state.authKey !== authKey) {
            return;
          }

          if (remote.exists) {

            // 服务器上已经是这份内容（内容相同，只是时间戳不同）：不用再写一遍
            if (remote.text === text) {
              this.syncedText = text;
              this.lastVersion = remote.version;
              this.lastWriteAt = 0;
              this.remotePending = null;
              return;
            }

            // 服务器上是别的版本，而我在它之后没同步过 → 真冲突
            if (remote.text !== this.syncedText) {
              this.remotePending = remote;
              return;
            }
          }
        }

        // 拉取期间用户可能又敲了几个字：写最新的那份，别把这一秒的输入留到下个 debounce。
        // 基础是一致的（上面刚确认过服务器还是我这份），所以合并是安全的。
        const textToWrite = this.text;

        const version = await SecureStorage.write(authKey, textToWrite, password);

        // 基线前移：这份内容现在就在服务器上。
        // 基线不前移的话，下一轮轮询会把自己刚写的东西当成远端更新。
        this.syncedText = textToWrite;
        this.lastVersion = version;

        // 记下「我刚写回」的时刻，供 poll() 区分「旁观者」和「我的版本被别人覆盖」
        this.lastWriteAt = Date.now();

        // 写入成功计数器：poll() 用它识别「发请求的那一路上本地又写过一次」——
        // 那种响应已经过期，必须丢弃，否则会把刚打的字回滚掉。
        this.writeSeq++;

        // 本地这份已经写回服务器了，之前那条「另一台设备更新了」的提示失去意义
        this.remotePending = null;

      } catch (ex) {
        const errorString = ex?.message || ex;
        alert(t('editor.saveFailed') + errorString);
      } finally {
        this.isWriting = false;
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

    /**
     * 轮询：问服务器「有没有比我这一份更新的版本」。
     * 判定为「有更新」需要同时满足：版本标记变了，或者（版本标记不可用时）明文变了。
     *
     * 拿回来的内容怎么处理，取决于本地状态：
     *   - 本地没有未保存改动、最近也没写过 → 直接采纳（这就是用户要的「无缝刷新」）
     *   - 本地正在输入，或刚自动保存过（我的版本可能刚被覆盖） → 只挂提示，绝不动用户的字
     *   - 远端内容跟我屏幕上一模一样 → 只前移基线，不打扰用户
     */
    async poll() {

      const authKey = store.state.authKey;

      if (!authKey || this.isBusy || this.isWriting || this.remotePending) {
        return;
      }

      // 页面在后台就不用轮了（desktop/手机切到别的 app 时省电省流量），
      // 切回前台时 visibilitychange 会立刻补一次。
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      // 记下发请求这一刻的写入序号：响应回来时如果序号变了，
      // 说明本地在这期间又写过一次（用户还在打字），这一份响应已经过期。
      const seqAtStart = this.writeSeq;

      try {

        const remote = await SecureStorage.pull(authKey, store.state.encryptionKey);

        // 请求在路上时用户退出了 / 换了口令：这份响应不再属于当前文档
        if (store.state.authKey !== authKey) {
          return;
        }

        // 请求在路上时本地写过一次：基线已被写回的数据前移，这份响应是旧的，
        // 拿它去覆盖会把用户这两秒打的字回滚掉。
        if (seqAtStart !== this.writeSeq) {
          return;
        }

        // 远端没了（别的设备点了「永久删除」）：不擅自清空本地，交给用户
        if (!remote.exists) {
          return;
        }

        const versionChanged = remote.version !== this.lastVersion;
        const textChanged = remote.text !== this.syncedText;

        if (!versionChanged && !textChanged) {
          return;
        }

        // 远端内容跟我屏幕上的字一模一样（另一台设备写了相同内容，或者那本来就是
        // 我刚写回去的版本换了个时间戳）：什么都不用做，只把基线前移，别打扰用户。
        if (remote.text === this.text) {
          this.syncedText = remote.text;
          this.lastVersion = remote.version;
          this.remotePending = null;
          this.lastWriteAt = 0;
          return;
        }

        // 「本地干净」还不足以说明我是旁观者：自动保存刚把我的内容推上去，
        // 屏幕上这份就是我写的，此刻远端翻新意味着它被别的设备覆盖了。
        // 直接采纳会把我的字抹掉且不给任何提示（等于吞字），所以刚写回过的人的
        // 一律走提示路径。只有真的很久没动过（纯旁观）才无缝替换。
        const recentlyWrote = this.lastWriteAt && (Date.now() - this.lastWriteAt < RECENT_WRITE_GRACE_MS);

        if (this.text === this.syncedText && !recentlyWrote) {
          // 本地干净、且没在写 → 无缝采纳
          this.applyRemote(remote);
        } else {
          // 本地有输入 / 刚写回过 → 只提示
          this.remotePending = remote;
        }

      } catch (ex) {
        // 解密失败（口令不匹配 / 密文损坏）或网络抖动：
        // 轮询失败不该打断用户输入，静默跳过这一轮。
      }
    },

    /** 用户选择「载入最新」：重新拉一次，确保拿到的是此刻服务器上的版本（不是几秒前的快照） */
    async loadRemote() {

      const authKey = store.state.authKey;

      if (!authKey) {
        return;
      }

      try {
        const remote = await SecureStorage.pull(authKey, store.state.encryptionKey);
        this.applyRemote(remote);
      } catch (ex) {
        alert(t('editor.saveFailed') + (ex?.message || ex));
      }
    },

    /** 用户选择「保留我的」：把本地内容写回服务器，覆盖远端 */
    keepLocal() {
      this.remotePending = null;
      // force：这是用户自己的选择，跳过「写前先看一眼服务器」的冲突检测
      this.writeNow(true);
    },

    deleteForever() {

      if (confirm(t('editor.confirmDelete'))) {

            const key = store.state.authKey;

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
      this.remotePending = null;

      if (newValue) {
          const password = store.state.encryptionKey;

          try {
            const remote = await SecureStorage.pull(newValue, password);

            this.text = remote.text;
            // 打开笔记时的这一份就是同步基线
            this.syncedText = remote.text;
            this.lastVersion = remote.version;
          } catch (ex) {
            // 口令不匹配 / 密文损坏：不能让整页卡在 isBusy，
            // 显示空文档但不把基线设成空串 —— 否则下一次输入会把远端内容覆盖掉。
            this.text = '';
            this.syncedText = '';
            this.lastVersion = null;
            alert(t('editor.saveFailed') + (ex?.message || ex));
          }

      } else {
        this.text = '';
        this.syncedText = '';
        this.lastVersion = null;
      }

      this.isBusy = false;

    }, {
      immediate: true
    });

    const updateTextStats = debounce(() => {

      let str = this.text;

      if (str) {
        this.wordCount = TextUtil.wordCount(str);
        this.charCount = str.length;
        this.lineCount = TextUtil.lineCount(str);
      }

    }, 100)

    watch(() => this.text, function () {
      updateTextStats();
    }, {
      immediate: true
    });

    // 轮询。固定间隔而不是 setTimeout 递归，避免某次请求卡住后整条链断掉。
    this.syncTimer = setInterval(() => {
      this.poll();
    }, SYNC_INTERVAL_MS);

    // 从后台切回前台：立刻补一次，不用干等 3 秒
    this.onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        this.poll();
      }
    };

    document.addEventListener('visibilitychange', this.onVisibilityChange);

  },
  async beforeUnmount() {

    clearInterval(this.syncTimer);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}
</script>
