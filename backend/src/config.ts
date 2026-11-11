require('dotenv').config();

/**
 * 单篇笔记的硬上限。express 会先把整个请求体读进内存再交给路由，
 * 所以这个值直接决定单个请求最坏占多少内存；Node 本身能撑到几百 MB，
 * 但放进容器里会把内存吃光，设一个明确的天花板。
 *
 * 默认就用这个上限：不配 NOTE_MAX_BYTES 时单篇笔记能存到 32MB 密文
 * （约 530 万汉字 / 1600 万英文字符）。想收紧就显式配一个小一点的值。
 */
const HARD_MAX_NOTE_BYTES = 32 * 1024 * 1024;

const DEFAULT_NOTE_MAX_BYTES = HARD_MAX_NOTE_BYTES;

/**
 * 把 "480kb" / "2m" / "1048576" 这类写法解析成字节数。
 * 认 k / kb / m / mb（大小写不敏感，1024 进制）；解析不了就用 fallback 并打一条警告。
 */
export function parseByteSize(value: string | undefined, fallback: number): number {

    if (value === undefined || value === null || String(value).trim() === '') {
        return fallback;
    }

    const raw = String(value).trim().toLowerCase();

    const match = /^([0-9]*\.?[0-9]+)\s*(b|k|kb|m|mb|g|gb)?$/.exec(raw);

    if (!match) {
        console.warn(`[config] 无法解析的字节数 "${value}"，改用默认值 ${fallback}`);
        return fallback;
    }

    const unit = match[2] || 'b';

    const scale: {[key: string]: number} = {
        b: 1,
        k: 1024,
        kb: 1024,
        m: 1024 * 1024,
        mb: 1024 * 1024,
        g: 1024 * 1024 * 1024,
        gb: 1024 * 1024 * 1024
    };

    const bytes = Math.round(parseFloat(match[1]) * scale[unit]);

    if (!isFinite(bytes) || bytes <= 0) {
        console.warn(`[config] 字节数 "${value}" 不是正数，改用默认值 ${fallback}`);
        return fallback;
    }

    return bytes;
}

type ConfigType = {
    port: number,
    environment: string,
    noteMaxBytes: number,
    noteMaxBytesHardCap: number
}

/** 把配置值夹到硬上限内，超了就警告并截断 */
function clampNoteMaxBytes(requested: number): number {

    if (requested <= HARD_MAX_NOTE_BYTES) {
        return requested;
    }

    console.warn(`[config] NOTE_MAX_BYTES=${requested} 超过硬上限 ${HARD_MAX_NOTE_BYTES}（32MB），已按硬上限处理`);

    return HARD_MAX_NOTE_BYTES;
}

export const Config: ConfigType = {
    port: process.env['PORT'] ? +process.env['PORT'] : 3000,
    environment: process.env['NODE_ENV'] || 'development',
    // 单篇笔记的上限，按加密后的请求体字节数算（见 Server.enablePost 的说明）。
    // 运行时变量 NOTE_MAX_BYTES 可覆盖，改完重启容器生效，不需要重新构建镜像。
    noteMaxBytes: clampNoteMaxBytes(parseByteSize(process.env['NOTE_MAX_BYTES'], DEFAULT_NOTE_MAX_BYTES)),
    noteMaxBytesHardCap: HARD_MAX_NOTE_BYTES
}
