import {createApp} from 'vue'
import App from './components/App.vue'

import './sass/app.scss';
import store from "./store";
import {EasyStorage} from "./classes/EasyStorage";
import {Util} from "./classes/Util";
import {applyDocumentLocale} from "./i18n";
import {applyTheme} from "./theme";

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

// 主题（auto / light / dark）在挂载前应用，避免切换时闪一下
applyTheme();


const app = createApp(App).mount('#app')
