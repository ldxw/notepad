import api from "../api";
import {Util} from "./Util";
import {Security} from "./Security";

// 进度分段：读取 = 下载 0..0.5、解密 0.5..1；写入 = 加密 0..0.8、上传 0.8..1。
// 纯文本笔记不解密，下载完直接报 1。
// 每一段带上阶段名（download / decrypt / encrypt / upload），进度条据此换文案。
function remap(from, to, onProgress, stage) {

    if (typeof onProgress !== 'function') {
        return null;
    }

    return function (fraction) {
        const f = fraction < 0 ? 0 : (fraction > 1 ? 1 : fraction);
        onProgress(from + (to - from) * f, stage);
    };
}

export class SecureStorage {

    /**
     *
     * @param authKey
     * @param password
     * @param {function(number, string)} [onProgress] 0..1，带阶段名
     * @return {Promise<String>}
     */
    static async read(authKey, password = '', onProgress) {

        const httpResponse = await api.get(authKey, remap(0, 0.5, onProgress, 'download'));

        if (httpResponse && Util.isJson(httpResponse)) {

            const json = Util.parseJsonQuietly(httpResponse);

            // 三种标签都接受：新信封标 AES-128（算法名），过渡期曾标 AES-128-CBC，
            // 旧信封标 AES-256-CBC（标签与密钥长度不符的历史遗留）。
            // 解密侧 Security.keyFor 会按标签把密钥截到对应长度。
            if (json?.alg === 'AES-128' || json?.alg === 'AES-128-CBC' || json?.alg === 'AES-256-CBC') {
                return await Security.decrypt(json, password, remap(0.5, 1, onProgress, 'decrypt'));
            }
        }

        // 纯文本笔记、未知 alg 的 JSON、空响应都原样返回：这里不能吞成空串
        if (typeof onProgress === 'function') onProgress(1, '');

        return httpResponse || "";
    }

    /**
     *
     * @param authKey
     * @param contents
     * @param password
     * @param {function(number, string)} [onProgress] 0..1，带阶段名
     * @param {'v1'|'v2'} [kdf] 写进信封的派生版本标记
     * @returns {Promise<String>}
     */
    static async write(authKey, contents, password = '', onProgress, kdf = 'v2') {

        // array including alg, iv, cipherText
        const encrypted = await Security.encrypt(contents, password, remap(0, 0.8, onProgress, 'encrypt'), kdf);
        const json = JSON.stringify(encrypted);

        return api.save(authKey, json, remap(0.8, 1, onProgress, 'upload'));
    }

    static async remove(authKey) {
        return api.delete(authKey);
    }
}
