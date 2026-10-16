import {createApp} from 'vue'
import App from './components/App.vue'

import './sass/app.scss';
import store from "./store";
import {EasyStorage} from "./classes/EasyStorage";
import {Util} from "./classes/Util";
import {applyDocumentLocale} from "./i18n";
import {initTheme, watchSystemTheme} from "./theme";

const STORAGE_SESSION_ID_KEY = 'session_id';

const bootSession = function () {

    let sid = EasyStorage.get(STORAGE_SESSION_ID_KEY);

    if (!sid) {
        sid = Util.randomInt();
        EasyStorage.save(STORAGE_SESSION_ID_KEY, sid);
    }

    store.mutations.setSessionId(sid);
}

bootSession();

// sync <html lang> and <title> with the locale picked at boot
applyDocumentLocale();

// 主题必须在挂载前应用：否则首帧会先闪一下默认配色。
// 再挂上系统主题的监听，这样 mode=auto 时系统切换能实时跟随。
initTheme();
watchSystemTheme();

const app = createApp(App).mount('#app')
