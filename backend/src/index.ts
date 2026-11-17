import {NextFunction, Request, RequestHandler, Response, Router} from "express";
import {Database} from "./Database";
import {Server} from "./Server";
import {Config} from "./config";
import {urlKeyFromAuthKey, NO_STORE} from "./Util";
import {NotesController} from "./NotesController";

const server = new Server();

const safeHandler = function (fn: RequestHandler) {
    return function (req: Request, res: Response, next: NextFunction) {
        return Promise.resolve(fn(req, res, next)).catch(next);
    };
};

const apiRouter = Router();

apiRouter.get('/', function (req: Request, res: Response) {

    res.json({
        message: 'API index'
    });

});

server.app.use('/api', apiRouter);

const notesRouter = Router();
notesRouter.get('/', NotesController.index);
notesRouter.get('/:id', NotesController.read);
notesRouter.post('/:id', NotesController.write);
notesRouter.delete('/:id', NotesController.delete);

server.app.use('/api/notes', notesRouter);

server.app.get('/notes/:id', function (req: Request, res: Response) {

    const uid = req.params['id'];

    const authKey = urlKeyFromAuthKey(uid);

    const contents = Database.get(authKey);

    // P1-3：与 /api/notes/:id 同样的处理 —— 不存在一律 404 空体 + no-store，
    // 不再用 JSON 错误体区分「不存在」与「存在但内容为空」。
    res.setHeader('Cache-Control', NO_STORE);

    if (contents === null) {
        res.status(404).setHeader('content-type', 'text/plain').send("");
        return;
    }

    res.setHeader('content-type', 'text/plain');
    res.send(contents);

})

const port: number = Config.port;

server.start(port);