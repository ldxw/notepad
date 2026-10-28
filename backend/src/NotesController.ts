import {Request, Response} from "express";
import {Database} from "./Database";
import {isHexString} from "./Util";

const validateKey = (key: string) => {
    return isHexString(key) && key.length === 32;
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

        // 客户端每 3 秒轮询一次这个地址。任何一层（浏览器、CDN、反向代理）缓存了
        // 这份响应，另一端就永远看不到新内容，所以这里必须显式禁掉缓存。
        // ETag 也关掉：Express 默认会按内容算 ETag 并发 304，而这里要的就是每次都读全文。
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('content-type', 'text/plain').send(contents || "");
    }

    static write(req: Request, res: Response): void {

        const {id} = req.params;

        if (!validateKey(id)) {
            res.status(400).send({
                error: 'Invalid key. Must be a lowercase hex string exactly 32 characters in length'
            });

            return;
        }

        if (typeof req.body === 'string') {
            Database.save(id, req.body.toString());

            res.status(200).json({
                status: 'OK'
            });

        } else {
            res.status(400).json({
                error: 'Invalid data. Expecting type: text/plain'
            });
        }
    }

    static delete(req: Request, res: Response): void {

        const {id} = req.params;

        if (id) {
            Database.remove(id);
        }

        res.status(200).send("");
    }
}