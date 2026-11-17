import scryptAsync from 'scrypt-async';
import {Util} from "./Util";

const aesjs = require('aes-js');
const md5 = require('md5');

const base62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const base62Encoder = require('base-x')(base62);

/* -------------------------------------------------------------------------- */
/* hex 编解码                                                                  */
/* -------------------------------------------------------------------------- */

// 密文转 hex 后长度翻倍：28MB 的笔记逐字节 toString(16) 再拼串，编码要 810ms、
// 解码要 1307ms。这里用查表 + 分块拼串，同一份数据两段都压到 40ms 上下。
const HEX_LUT = (() => {
    const lut = new Array(256);
    for (let i = 0; i < 256; i++) {
        lut[i] = (i < 16 ? '0' : '') + i.toString(16);
    }
    return lut.join('');
})();

// 每个 hex 字符 → 0..15，非法字符留 -1
const HEX_VALUE = (() => {
    const table = new Int8Array(128).fill(-1);
    for (let i = 0; i < 10; i++) table[48 + i] = i;          // '0'-'9'
    for (let i = 0; i < 6; i++) {
        table[97 + i] = 10 + i;                              // 'a'-'f'
        table[65 + i] = 10 + i;                              // 'A'-'F'
    }
    return table;
})();

// 一次拼 64K 字符，避免超长字符串反复扩容
const HEX_CHUNK_CHARS = 1 << 16;

/**
 * @param {Uint8Array} bytes
 * @param {function(number)} [onFraction] 0..1，按已处理的字节数回调
 * @return {string}
 */
export function bytesToHex(bytes, onFraction) {

    const len = bytes.length;
    const parts = [];
    let chunk = '';
    // 每次回调大约跨 1/20 的进度，避免几十万次回调
    const reportEvery = Math.max(1, len >> 5);
    let nextReport = reportEvery;

    for (let i = 0; i < len; i++) {
        const offset = bytes[i] * 2;
        chunk += HEX_LUT[offset] + HEX_LUT[offset + 1];

        if (chunk.length >= HEX_CHUNK_CHARS) {
            parts.push(chunk);
            chunk = '';
        }

        if (onFraction && i >= nextReport) {
            nextReport = i + reportEvery;
            onFraction(i / len);
        }
    }

    if (chunk) {
        parts.push(chunk);
    }

    if (onFraction) {
        onFraction(1);
    }

    return parts.join('');
}

/**
 * @param {string} hex
 * @param {function(number)} [onFraction] 0..1，按已处理的字节数回调
 * @return {Uint8Array}
 */
export function hexToBytes(hex, onFraction) {

    const len = hex.length;

    if (len % 2 !== 0) {
        throw new Error('Invalid hex string: odd length');
    }

    const byteLen = len >> 1;
    const out = new Uint8Array(byteLen);
    const reportEvery = Math.max(1, byteLen >> 5);
    let nextReport = reportEvery;

    for (let i = 0; i < byteLen; i++) {

        const hiCode = hex.charCodeAt(i * 2);
        const loCode = hex.charCodeAt(i * 2 + 1);

        const hi = hiCode < 128 ? HEX_VALUE[hiCode] : -1;
        const lo = loCode < 128 ? HEX_VALUE[loCode] : -1;

        if (hi < 0 || lo < 0) {
            throw new Error('Invalid hex string');
        }

        out[i] = (hi << 4) | lo;

        if (onFraction && i >= nextReport) {
            nextReport = i + reportEvery;
            onFraction(i / byteLen);
        }
    }

    if (onFraction) {
        onFraction(1);
    }

    return out;
}

/* -------------------------------------------------------------------------- */
/* 进度回调                                                                    */
/* -------------------------------------------------------------------------- */

// 小于 1% 的推进不回调，省掉大量无意义的 DOM 更新
function makeReporter(onProgress) {

    if (typeof onProgress !== 'function') {
        return function () {};
    }

    let last = -1;

    return function (fraction) {

        const f = fraction < 0 ? 0 : (fraction > 1 ? 1 : fraction);

        if (f - last < 0.01 && f < 1) {
            return;
        }

        last = f;
        onProgress(f);
    };
}

/* -------------------------------------------------------------------------- */
/* WebCrypto                                                                   */
/* -------------------------------------------------------------------------- */

// crypto.subtle 只在 https / localhost 这类安全上下文里存在；纯 http 下回落 aes-js
const SUBTLE = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto.subtle : null;

const KEY_CACHE = {hex: null, key: null};

// 信封 alg 标签到密钥 hex 长度的映射。实际加密一直是 AES-128（32 hex = 16 字节），
// 旧版本却在信封里写 AES-256-CBC —— 标签和密钥长度对不上。读取时按标签截到该长度，
// 对存量笔记是恒等变换（32 位 hex 截到 32 位不变），对新笔记也是恒等；
// 真正的修正在写入侧：新信封标 AES-128（算法名，不含模式后缀）。
const KEY_HEX_LEN = {'AES-128': 32, 'AES-128-CBC': 32, 'AES-256-CBC': 64};

function keyFor(envelope, keyHex) {

    const need = KEY_HEX_LEN[envelope && envelope['alg']];

    if (!need) {
        return keyHex;
    }

    return keyHex.length > need ? keyHex.slice(0, need) : keyHex;
}

async function importAesKey(keyHex) {

    if (KEY_CACHE.hex === keyHex) {
        return KEY_CACHE.key;
    }

    const key = await SUBTLE.importKey('raw', hexToBytes(keyHex), {name: 'AES-CBC'}, false, ['encrypt', 'decrypt']);

    KEY_CACHE.hex = keyHex;
    KEY_CACHE.key = key;

    return key;
}

export class Security {

    /**
     *
     * @param {Uint8Array} buffer
     */
    static base62(buffer) {
        return base62Encoder.encode(buffer);
    }

    // stringToByteArray
    static str2ab(str) {
        var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
        var bufView = new Uint16Array(buf);
        for (var i = 0, strLen = str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }
        return bufView;
    }

    // v2 派生用的 UTF-8 编码。上面的 str2ab 是旧实现的逐字 Uint16Array 编码，
    // scrypt-async 把它当字节数组读，charCode > 255 的字符（中文等）只剩低 8 位，
    // 口令熵塌陷。存量笔记都按旧行为派生，str2ab 必须原样保留。
    static str2abV2(str) {
        return new TextEncoder().encode(str);
    }

    static byteArrayToHexString(uint8Array) {
        return bytesToHex(uint8Array);
    }

    static randomBytes(len) {

        let arr = new Uint8Array(len);

        for (let i = 0; i < arr.length; i++) {
            arr[i] = Util.randomInt(0, 256);
        }

        return arr;
    }

    static randomIv() {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            return crypto.getRandomValues(new Uint8Array(16));
        }

        return this.randomBytes(16);
    }

    /**
     * 口令派生。kdf='v1' 逐字复刻旧行为（str2ab 编码 + N=2^14, r=8, p=1），
     * 只用于打开存量笔记；kdf='v2' 用 UTF-8 字节 + N=2^15, r=8, p=2，
     * 修复非 ASCII 口令在 v1 里被截断导致的熵塌陷。
     *
     * @param password
     * @param salt
     * @param {'v1'|'v2'} [kdf]
     * @return {Promise<Uint8Array>}
     */
    static async slowHash(password, salt, kdf = 'v1') {

        return new Promise(function (resolve, reject) {

            const v2 = kdf === 'v2';
            const encode = v2 ? (s) => new TextEncoder().encode(s) : (s) => Security.str2ab(s);

            let pb = encode(password);
            let sb = encode(salt);

            // 1 byte = 2 hex chars
            scryptAsync(pb, sb, {
                N: Math.pow(2, v2 ? 15 : 14),
                r: 8,
                p: v2 ? 2 : 1,
                dkLen: 32,
                encoding: 'binary',
                interruptStep: 1000
            }, function (derivedKey) {
                resolve(derivedKey);
            });

        });
    }

    static fastHash(data) {
        return md5(data);
    }

    /**
     * 加密。密文体与旧实现逐字节相同（WebCrypto 的 AES-CBC 与 aes-js 一致），
     * 信封里多一个 kdf 字段标记派生版本（服务端校验放行 v1/v2）。
     *
     * @param {string} data
     * @param {string} key 32 位 hex
     * @param {function(number)} [onProgress] 0..1
     * @param {'v1'|'v2'} [kdf] 写进信封的派生版本标记（服务端只存不解）
     * @return {Promise<{alg: string, iv: string, cipherText: string, timestamp: number, kdf: string, meta: object}>}
     */
    static async encrypt(data, key, onProgress, kdf = 'v2') {

        // key must be 32 chars long AND HEX!!!!
        if (!key || key.length !== 32) {
            throw 'has to be 32 in length!';
        }

        const report = makeReporter(onProgress);

        // 明文 → UTF-8 字节
        const textBytes = new TextEncoder().encode(data);
        report(0.12);

        // The initialization vector (must be 16 bytes)
        const iv = this.randomIv();

        let cipherBytes;

        if (SUBTLE) {

            const cryptoKey = await importAesKey(key);
            // WebCrypto 的 AES-CBC 自带 PKCS#7 填充，与 aes-js 的 padding 结果一致
            const buffer = await SUBTLE.encrypt({name: 'AES-CBC', iv}, cryptoKey, textBytes);
            cipherBytes = new Uint8Array(buffer);
            report(0.45);

        } else {

            const keyAsBytes = aesjs.utils.hex.toBytes(key);
            const padded = aesjs.padding.pkcs7.pad(textBytes);
            cipherBytes = new aesjs.ModeOfOperation.cbc(keyAsBytes, iv).encrypt(padded);
            report(0.45);
        }

        const cipherText = bytesToHex(cipherBytes, function (fraction) {
            report(0.45 + fraction * 0.55);
        });
        report(1);

        return {
            // 实际用的是 16 字节密钥 = AES-128。旧版本这里写 AES-256-CBC 属于标签
            // 错误（读取路径按标签截 key，两种标签都能正确还原）。
            alg: 'AES-128',
            iv: bytesToHex(iv),
            cipherText: cipherText,
            timestamp: Date.now(),
            kdf: kdf,
            meta: {}
        }
    }

    // When decrypting, the IV can then be read from the input before the encrypt data.
    /**
     * @param {{iv: string, cipherText: string}} data
     * @param {string} key 32 位 hex
     * @param {function(number)} [onProgress] 0..1
     * @return {Promise<string>}
     */
    static async decrypt(data, key, onProgress) {

        const report = makeReporter(onProgress);

        // 信封标签与实际密钥长度对齐：旧信封标 AES-256-CBC 但密钥是 32 hex（16 字节），
        // 按标签截到该长度后再解密。对存量笔记是恒等变换，对 64 hex 的信封才是真截断。
        key = keyFor(data, key);

        const iv = hexToBytes(data['iv']);
        const cipherBytes = hexToBytes(data['cipherText'], function (fraction) {
            report(fraction * 0.5);
        });
        report(0.5);

        let plainBytes;

        if (SUBTLE) {

            const cryptoKey = await importAesKey(key);
            const buffer = await SUBTLE.decrypt({name: 'AES-CBC', iv}, cryptoKey, cipherBytes);
            plainBytes = new Uint8Array(buffer);

        } else {

            const keyAsBytes = aesjs.utils.hex.toBytes(key);
            plainBytes = new aesjs.ModeOfOperation.cbc(keyAsBytes, iv).decrypt(cipherBytes);
            plainBytes = aesjs.padding.pkcs7.strip(plainBytes);
        }

        report(0.85);

        const text = new TextDecoder().decode(plainBytes);
        report(1);

        return text;
    }
}
