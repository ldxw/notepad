import {computed, reactive, readonly, watch} from "vue";
import {Security} from "./classes/Security";

const _state = reactive({
    // switching between keys
    isBusy: false,

    // 读取 / 保存进度：由 classes/Progress.js 写、NoteProgress.vue 读
    progress: {
        visible: false,
        value: 0,
        phase: '',
        stage: '',
        failed: false,
        // 操作成功跑完（100%）：完成态常驻时组件用它切「✓ 已保存」样式
        done: false
    },

    // any app error - invalid URL, invalid auth, etc..
    error: '',
    sessionId: null,

    key: sessionStorage.getItem('vue-key'),

    // v1（旧派生参数）兜底键：存量笔记（尤其非 ASCII 口令的）都存放在旧派生地址上，
    // v2 地址读不到时用它兜底重查
    keyV1: sessionStorage.getItem('vue-key-v1'),

    // 当前生效的派生版本：默认 v2；v1 兜底命中后粘住 v1，读写都用 v1 地址，
    // 避免同一篇笔记在两个派生地址之间分叉
    activeKdf: 'v2',

    // first 32 bits we use for authentication
    authKey: computed(() => {
        return _state.key ? (_state.key || []).slice(0, 32) : null;
    }),

    // next 32 bits = encryption key
    encryptionKey: computed(() => {
        return _state.key ? (_state.key || []).slice(32, 64) : null;
    }),
    urlKey: '',

    authKeyV1: computed(() => {
        return _state.keyV1 ? _state.keyV1.slice(0, 32) : null;
    }),

    encryptionKeyV1: computed(() => {
        return _state.keyV1 ? _state.keyV1.slice(32, 64) : null;
    }),

    // 写入 / 删除用的「生效」键：跟随 activeKdf 切换，不改 _state.key，
    // Editor 的读取 watch（监听 authKey）不会被重新触发
    activeAuthKey: computed(() => {
        if (_state.activeKdf === 'v1') {
            return _state.keyV1 ? _state.keyV1.slice(0, 32) : null;
        }
        return _state.key ? (_state.key || []).slice(0, 32) : null;
    }),

    activeEncryptionKey: computed(() => {
        if (_state.activeKdf === 'v1') {
            return _state.keyV1 ? _state.keyV1.slice(32, 64) : null;
        }
        return _state.key ? (_state.key || []).slice(32, 64) : null;
    }),

});

watch(() => _state.key, (newValue) => {
    sessionStorage.setItem('vue-key', newValue);
});

watch(() => _state.keyV1, (newValue) => {
    sessionStorage.setItem('vue-key-v1', newValue || '');
});

const mutations = {
    setSessionId: (id) => {
        _state.sessionId = id
    },

    /**
     * 合并写入进度状态。state 对外是 readonly，只能从这里改。
     * @param {{visible?: boolean, value?: number, phase?: string, stage?: string, failed?: boolean, done?: boolean}} patch
     */
    setProgress: (patch) => {
        Object.assign(_state.progress, patch || {});
    },

    /**
     *
     * @param {Uint8Array} hash v2 派生结果（登录后读写的主地址）
     * @param {Uint8Array} [hashV1] v1 旧参数派生结果（打开存量笔记的兜底地址）
     */
    login: (hash, hashV1) => {

        console.log(hash);

        const hex = Security.byteArrayToHexString(hash);

        _state.key = hex;
        _state.urlKey = Security.base62(hash.slice(0, 16));
        _state.keyV1 = hashV1 ? Security.byteArrayToHexString(hashV1) : '';
        _state.activeKdf = 'v2';
    },

    /**
     * v1 兜底命中后粘住 v1：之后读写都用 v1 地址，信封 kdf 也记 v1。
     * 只改 activeKdf 不动 _state.key，Editor 的读取 watch 不会因此重触发。
     */
    setActiveKdf: (kdf) => {
        _state.activeKdf = kdf === 'v1' ? 'v1' : 'v2';
    }
}

const getters = {

    get test() {
        return "test";
    }
}

const actions = {

    reset() {
        _state.key = '';
        _state.keyV1 = '';
        _state.activeKdf = 'v2';
    }
}

export default {
    state: readonly(_state),
    getters: getters,
    mutations,
    actions: actions
}
