import api from "../api";
import {Util} from "./Util";
import {Security} from "./Security";

export class SecureStorage {

    /**
     * 读远端并解开信封，同时把「版本标记」带回来。
     *
     * 为什么要版本标记：Security.encrypt() 每次都用随机 IV（Security.js:93），
     * 同一份明文写两次，密文完全不同。所以不能用「密文变了没有」判断远端有没有更新，
     * 只能用密文里自带的 timestamp（写入时刻），或者退回用明文比对。
     *
     * @return {Promise<{text: string, version: string|null, exists: boolean}>}
     *   version 为 null 表示远端没有可用版本标记（老数据/明文内容），调用方应改用 text 比对
     *   exists 为 false 表示远端目前没有这篇笔记（可能被别的设备删了）
     */
    static async pull(authKey, password = '') {

        const httpResponse = await api.get(authKey);

        if (!httpResponse) {
            return {text: "", version: null, exists: false};
        }

        if (Util.isJson(httpResponse)) {

            const json = Util.parseJsonQuietly(httpResponse);

            if (json && json.alg === 'AES-256-CBC') {

                let text = '';

                try {
                    text = Security.decrypt(json, password);
                } catch (ex) {
                    // 口袋令不匹配（或密文损坏）：不要把乱码当成内容显示，
                    // 也不要覆盖它 —— 当成「无法读取」交给调用方处理
                    throw new Error('DECRYPT_FAILED');
                }

                const version = typeof json.timestamp === 'number' ? String(json.timestamp) : null;

                return {text, version, exists: true};
            }

            // 合法 JSON 但不是加密信封：当作原样文本保存的老数据
            return {text: httpResponse, version: null, exists: true};
        }

        return {text: httpResponse, version: null, exists: true};
    }

    /**
     * @param authKey
     * @param password
     * @return {Promise<String>}
     */
    static async read(authKey, password = '') {

        const httpResponse = await api.get(authKey);

        if (httpResponse && Util.isJson(httpResponse)) {

            const json = Util.parseJsonQuietly(httpResponse);
            const alg = json?.alg;

            if (alg === 'AES-256-CBC') {
                return Security.decrypt(json, password);
            }

            return httpResponse;
        }

        return "";
    }

    /**
     * 写入并返回这次写入产生的版本标记（就是 encrypt() 塞进信封里的 timestamp）。
     * 调用方拿它更新「已知的最新版本」，否则轮询会把自己刚写的东西当成远端更新。
     *
     * @param authKey
     * @param contents
     * @param password
     * @returns {Promise<String|null>}
     */
    static async write(authKey, contents, password = '') {

        // array including alg, iv, cipherText
        let encrypted = Security.encrypt(contents, password);
        const json = JSON.stringify(encrypted);

        const response = await api.save(authKey, json);

        // 后端只回 {"status":"OK"}；版本标记以本地信封里的 timestamp 为准
        return typeof encrypted.timestamp === 'number' ? String(encrypted.timestamp) : null;
    }

    static async remove(authKey) {
        return api.delete(authKey);
    }
}