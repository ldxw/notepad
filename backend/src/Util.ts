const base64url = require('base64-url');

const base62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
// base-x 5.x 的 CJS 入口把默认导出放在 .default 上（4.x 是直接导出函数），两种都兼容
const baseX = require('base-x');
const base62Encoder = (baseX.default || baseX)(base62);

// misc functions that don't fit anywhere else

export const hexStringToByteArray = (hexString: string): Uint8Array => {
    // Remove any spaces or other characters that might be present
    hexString = hexString.replace(/\s/g, '');

    // Ensure the input is a valid hexadecimal string
    if (!/^[0-9a-fA-F]+$/.test(hexString)) {
        throw new Error('Invalid hexadecimal string');
    }

    // Create a Uint8Array to store the result
    const byteArray = new Uint8Array(hexString.length / 2);

    // Parse each pair of hexadecimal characters and convert to bytes
    for (let i = 0; i < hexString.length; i += 2) {
        byteArray[i / 2] = parseInt(hexString.slice(i, i + 2), 16);
    }

    return byteArray;
}

const stringToByteArray = (text: string): Uint8Array => {
    const encoder = new TextEncoder();
    return encoder.encode(text);
}

const byteArrayToHexString = (uint8Array: Uint8Array) => {
    let hexString = '';
    for (let i = 0; i < uint8Array.length; i++) {
        const hex = uint8Array[i].toString(16).padStart(2, '0');
        hexString += hex;
    }
    return hexString;
}

export const urlKeyFromAuthKey = function (key: string): string {
    const buffer = base62Encoder.decode(key);
    return byteArrayToHexString(buffer);
}

// inclusive, exclusive
export const randomInteger = (min?: number, max?: number): number => {

    if (typeof min == 'undefined') {
        min = 0;
    }

    if (typeof max === 'undefined') {
        max = Number.MAX_SAFE_INTEGER;
    }

    return Math.floor(
        Math.random() * (max - min) + min
    )
}

// must contain only: contain 0-9a-f
export const isHexString = (str: string): boolean => {
    return str.replace(/[a-f0-9]/ig, '').length === 0;
}

/**
 * P2-3：/api 与 /notes/:id 下所有响应的缓存策略。
 * 笔记按 key 寻址，响应一旦被 CDN / 共享代理缓存，第三方就可能读到别人的内容；
 * no-store 压住持久缓存，no-cache + must-revalidate 压住复用，private 排除共享缓存。
 */
export const NO_STORE = 'no-store, no-cache, must-revalidate, private';
