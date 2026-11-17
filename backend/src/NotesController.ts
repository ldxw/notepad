import {Request, Response} from "express";
import {Database} from "./Database";
import {Config} from "./config";
import {isHexString, NO_STORE} from "./Util";

const validateKey = (key: string) => {
    return isHexString(key) && key.length === 32;
}

/**
 * P1-2：信封结构校验。服务端仍然零知识 —— 只检查加密外壳的形状（算法标签、
 * hex 的 iv 与密文块），不解密、也不接触任何明文。
 * 返回 null 表示合法；否则返回一句问题描述。
 */
const validateEnvelope = (body: Buffer): string | null => {

    if (body.length === 0) {
        return 'empty body';
    }

    let json: any;
    try {
        json = JSON.parse(body.toString('utf8'));
    } catch (ex) {
        return 'body is not valid JSON';
    }

    if (json === null || typeof json !== 'object' || Array.isArray(json)) {
        return 'envelope must be a JSON object';
    }

    // 写入侧现在标的是 AES-128（实际密钥长度）；旧信封标 AES-256-CBC。
    // 两者都放行：服务端只做形状校验，不据此判断密钥长度。
    if (typeof json.alg !== 'string' || !/^AES-(128|256)(-CBC)?$/.test(json.alg)) {
        return 'alg must be AES-128 or AES-256-CBC';
    }

    if (typeof json.iv !== 'string' || !/^[0-9a-fA-F]{32}$/.test(json.iv)) {
        return 'iv must be 32 hex characters (a 16-byte block)';
    }

    if (typeof json.cipherText !== 'string' || !/^[0-9a-fA-F]+$/.test(json.cipherText) || json.cipherText.length % 32 !== 0) {
        return 'cipherText must be hex whose length is a multiple of 32 characters (16-byte blocks)';
    }

    if (typeof json.timestamp !== 'number') {
        return 'timestamp must be a number';
    }

    if (json.kdf !== undefined && json.kdf !== 'v1' && json.kdf !== 'v2') {
        return 'kdf must be "v1" or "v2"';
    }

    if (json.meta !== undefined && (json.meta === null || typeof json.meta !== 'object' || Array.isArray(json.meta))) {
        return 'meta must be an object';
    }

    return null;
}

export class NotesController {
    
    static index(req: Request, res: Response): void {

        res.json({
            message: 'Send POST/DELETE to /notes/:key to manage notes'
        });
    }

    static read(req: Request, res: Response): void {

        const {id} = req.params;

        const contents = Database.get(id);

        // P1-3：存在性 oracle 的缓解（不是修复 —— 按 key 寻址天然会暴露「这个 key
        // 有没有笔记」，真正的防线是 P1-1 的派生修复与口令强度）。
        // 这里只做两件事：不存在的 key 返回 404 空体（不再伪装成 200 空笔记），
        // 且两种分支都带 no-store，避免 CDN / 代理把响应缓存后给第三方复用。
        // Database.get 的语义：null = 文件不存在，"" = 空笔记。
        res.setHeader('Cache-Control', NO_STORE);

        if (contents === null) {
            res.status(404).setHeader('content-type', 'text/plain').send("");
            return;
        }

        res.setHeader('content-type', 'text/plain').send(contents);
    }

    static write(req: Request, res: Response): void {

        const {id} = req.params;

        if (!validateKey(id)) {
            res.status(400).send({
                error: 'Invalid key. Must be a lowercase hex string exactly 32 characters in length'
            });

            return;
        }

        // Server.enablePost 已把 /api/notes 的请求体统一接成 Buffer；没接成的
        // （比如被 urlencoded 先解析掉的表单）维持旧版 400 行为。
        if (!Buffer.isBuffer(req.body)) {
            res.status(400).json({
                error: 'Invalid data. Expecting type: text/plain'
            });

            return;
        }

        const text = req.body.toString('utf8');

        const problem = validateEnvelope(req.body);

        if (problem) {

            if (Config.envelopeEnforce) {
                res.status(400).json({
                    error: `Invalid note envelope: ${problem}`
                });

                return;
            }

            // 影子模式（默认）：只告警不拦截，观察一段时间后再切 enforce。
            console.warn(`[envelope] key=${id} bytes=${req.body.length} 校验未通过（影子模式照常保存）：${problem}`);
        }

        Database.save(id, text);

        res.status(200).json({
            status: 'OK'
        });
    }

    static delete(req: Request, res: Response): void {

        const {id} = req.params;

        res.setHeader('Cache-Control', NO_STORE);

        if (id) {
            Database.remove(id);
        }

        res.status(200).send("");
    }
}