function sizeInBytes(str) {
    return new TextEncoder().encode(str).length;
}

function humanFileSize(size) {
    if (!size) {
        return "0 B";
    }
    var i = Math.floor(Math.log(size) / Math.log(1024));
    return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
}

/**
 * 明文按 AES-128-CBC + PKCS#7 补齐并转 hex、再套上 SecureStorage 那层 JSON 之后，
 * 发到 POST /api/notes/:id 的请求体有多大。
 *
 * 旧信封标的是 AES-256-CBC，但密钥一直是 32 hex（16 字节），实际算法就是 AES-128；
 * 标签已在写入侧修正，体积公式两种标签下相同。
 *
 * 不真的加密（输入时每次按键都加密太贵），只按同样的公式算体积。
 * iv 32 hex + 固定字段 + 13 位时间戳，合计常量开销。
 */
function encryptedPayloadSize(text) {

    const rawBytes = sizeInBytes(text || "");

    // PKCS#7：明文正好是 16 的整数倍时也要补一整块
    const paddedBytes = Math.floor(rawBytes / 16) * 16 + 16;

    // {"alg":"AES-128","iv":"<32>","cipherText":"<hex>","timestamp":<13>,"kdf":"v2","meta":{}}
    // 固定字段实测约 120 字节（含 kdf），取 128 留一点余量、少算不漏算。
    const JSON_OVERHEAD = 96 + 32;

    return paddedBytes * 2 + JSON_OVERHEAD;
}

export class TextUtil {

    static humanFileSize(size) {
        return humanFileSize(size);
    }

    static sizeInBytes(str) {
        return sizeInBytes(str);
    }

    static encryptedPayloadSize(text) {
        return encryptedPayloadSize(text);
    }

    static stringContainsIgnoreCase(haystack, needle) {
        return (haystack || '').toLowerCase().includes((needle || '').toLowerCase());
    }

    static wordCount(text) {

        if (!text) {
            return 0;
        }

        return text.split(/\s+/).filter(function (word) {
            return !!word;
        }).length;
    }

    static lineCount(text) {

        if (!text) {
            return 0;
        }

        return text.split(/\r?\n/).length;
    }
}
