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
        failed: false
    },

    // any app error - invalid URL, invalid auth, etc..
    error: '',
    sessionId: null,

    key: sessionStorage.getItem('vue-key'),

    // first 32 bits we use for authentication
    authKey: computed(() => {
        return _state.key ? (_state.key || []).slice(0, 32) : null;
    }),

    // next 32 bits = encryption key
    encryptionKey: computed(() => {
        return _state.key ? (_state.key || []).slice(32, 64) : null;
    }),
    urlKey: '',

});

watch(() => _state.key, (newValue) => {
    sessionStorage.setItem('vue-key', newValue);
});

const mutations = {
    setSessionId: (id) => {
        _state.sessionId = id
    },

    /**
     * 合并写入进度状态。state 对外是 readonly，只能从这里改。
     * @param {{visible?: boolean, value?: number, phase?: string, stage?: string, failed?: boolean}} patch
     */
    setProgress: (patch) => {
        Object.assign(_state.progress, patch || {});
    },

    /**
     *
     * @param {Uint8Array} hash
     */
    login: (hash) => {

        console.log(hash);

        const hex = Security.byteArrayToHexString(hash);

        _state.key = hex;
        _state.urlKey = Security.base62(hash.slice(0, 16));
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
    }
}

export default {
    state: readonly(_state),
    getters: getters,
    mutations,
    actions: actions
}
