import store from "../store";

/* -------------------------------------------------------------------------- */
/* 读取 / 保存进度控制器                                                       */
/* -------------------------------------------------------------------------- */

// 自动保存走 800ms 防抖，小笔记往往几十毫秒就存完；这种一闪而过的进度条
// 比不显示更烦。低于这个时长的操作直接不显示。
const SHOW_DELAY = 120;

// 一旦显示出来就至少停留这么久，否则条子刚出现就消失，看不出走到哪了。
const MIN_VISIBLE = 400;

// 出错时停留更久：这是用户唯一能察觉保存没成功的信号，一闪而过等于没有。
const FAIL_VISIBLE = 1200;

// 读取完成的停留时间：完成态是常驻的（不受 MIN_VISIBLE 收条），直到用户
// 再次输入、切换笔记或离开编辑页才收起；这里只控制收起前最短停留。
const READ_DONE_MIN_VISIBLE = 900;

// 保存完成的停留时间：同样常驻，只是最短停留比读取长一点（保存更值得确认）。
const SAVE_DONE_MIN_VISIBLE = 1400;

// 单次推进的上限：加密收尾到上传完成之间常常是一个大跳（小笔记一下从 80% 到 100%），
// 直接把宽度改成 100% 看着像卡住后瞬间完成。超过这个幅度就用 rAF 补一段动画。
const SMOOTH_MIN_JUMP = 0.15;
const SMOOTH_DURATION = 180;

// 当前接管进度条的任务；同一时间只有一条进度条，读和写谁后开始谁接管。
let current = null;
let showTimer = 0;
let hideTimer = 0;
let shownAt = 0;

// 正在跑的平滑动画；同一时间只有一个。
let smoothCtx = null;

function now() {
    if (typeof performance !== 'undefined' && performance.now) {
        return performance.now();
    }
    return Date.now();
}

function set(patch) {
    store.mutations.setProgress(patch);
}

/**
 * 测试观测通道：页面里注入 window.____progressTrace 时才记录。
 *
 * 记的是「Progress 收到了什么」，和渲染帧无关 —— 加密/解密把主线程占满时
 * requestAnimationFrame 一帧都跑不了，靠采样连续帧去验证阶段文案会误判成
 * 文案没生效。生产页面没有这个数组，这里直接返回，不产生任何副作用。
 *
 * @param {string} kind
 * @param {object} [payload]
 */
function trace(kind, payload) {

    if (typeof window === 'undefined') {
        return;
    }

    const sink = window.____progressTrace;

    if (!sink || typeof sink.push !== 'function') {
        return;
    }

    sink.push(Object.assign({kind: kind, at: now()}, payload || {}));
}

function nextFrame(ctx, fn) {
    cancelFrame(ctx);
    if (typeof requestAnimationFrame === 'function') {
        ctx.raf = true;
        ctx.handle = requestAnimationFrame(fn);
    } else {
        ctx.raf = false;
        ctx.handle = setTimeout(fn, 16);
    }
}

function cancelFrame(ctx) {
    if (!ctx || !ctx.handle) {
        return;
    }
    if (ctx.raf) {
        cancelAnimationFrame(ctx.handle);
    } else {
        clearTimeout(ctx.handle);
    }
    ctx.handle = 0;
}

function cancelSmooth() {
    if (!smoothCtx) {
        return;
    }
    cancelFrame(smoothCtx);
    smoothCtx = null;
}

/**
 * 从当前显示值补到目标值。只动显示值，不动 task.value（那是「真实进度、只前进」）。
 *
 * @param {object} task
 * @param {number} to
 * @param {Function} [onDone]
 */
function smoothTo(task, to, onDone) {

    cancelSmooth();

    const from = typeof task.display === 'number' ? task.display : 0;
    const target = to > 1 ? 1 : (to < 0 ? 0 : to);

    if (target - from < 0.001) {
        task.display = target;
        if (onDone) {
            onDone();
        }
        return;
    }

    const start = now();
    const ctx = {handle: 0, raf: false};
    smoothCtx = ctx;

    const paint = function (value) {
        if (current !== task || !task.shown) {
            return;
        }
        set({
            visible: true,
            value: value,
            phase: task.phase,
            stage: task.stage || '',
            failed: false,
            done: false
        });
    };

    const tick = function () {
        if (smoothCtx !== ctx) {
            return;
        }

        ctx.handle = 0;

        let t = SMOOTH_DURATION > 0 ? (now() - start) / SMOOTH_DURATION : 1;
        if (t > 1) {
            t = 1;
        }

        // ease-out：快结束时减速，落点更稳
        const eased = 1 - Math.pow(1 - t, 3);
        const value = from + (target - from) * eased;

        task.display = value;
        paint(value);

        if (t >= 1) {
            smoothCtx = null;
            task.display = target;
            paint(target);
            if (onDone) {
                onDone();
            }
            return;
        }

        nextFrame(ctx, tick);
    };

    nextFrame(ctx, tick);
}

function hideAfterMinVisible(task, minVisible) {

    const stay = minVisible || MIN_VISIBLE;

    clearTimeout(hideTimer);

    const elapsed = shownAt ? now() - shownAt : stay;
    const wait = Math.max(0, stay - elapsed);

    hideTimer = setTimeout(function () {
        hideTimer = 0;
        if (current !== task) {
            return;
        }

        // 保存完成/保存失败是常驻的：到点只把「可离开」标记翻开，不真的收条；
        // 真正收起交给 dismiss()（用户再次输入/切笔记/离开编辑页时调用）。
        // 读取成功态同样常驻（「✓ 加载完成」）；读取失败仍按 FAIL_VISIBLE 自动收起，
        // 失败态不需要长期占着版面。
        if (task.phase === 'save' || (task.phase === 'read' && !task.failed)) {
            task.doneSticky = true;
            return;
        }

        current = null;
        set({visible: false, value: 0, phase: '', stage: '', failed: false, done: false});
    }, wait);
}

/**
 * 收起常驻的完成态（载入完成 / 保存完成）。由编辑器在「用户又开始输入 /
 * 切换笔记 / 卸载」时调用；没有常驻条时是空操作，不会打断正在进行的读写。
 */
export function dismiss() {

    // 任务还没跑完时不收：dismiss 只负责收起常驻完成态/已结束的条子，
    // 不能把进行中的保存进度静默吞掉。
    if (current && !current.done) {
        return;
    }

    clearTimeout(hideTimer);
    hideTimer = 0;
    cancelSmooth();
    current = null;
    set({visible: false, value: 0, phase: '', stage: '', failed: false, done: false});
}

/**
 * 开始一段操作，返回任务句柄。传 'read' 或 'save'。
 *
 * @param {string} phase
 * @return {{phase: string, stage: string, value: number, display: number, done: boolean, shown: boolean}}
 */
export function begin(phase) {

    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    showTimer = 0;
    hideTimer = 0;
    cancelSmooth();

    // 新操作开始意味着常驻的保存完成态结束：已完成的旧条不算「进行中」，
    // 不参与接管，新一轮重新等 SHOW_DELAY 再显示；旧条要么被新条到点
    // 替换，要么在新操作很快结束（finish 的未显示路径）时被一并收起。
    const takeover = !!(current && current.shown && !current.done);

    const task = {
        phase: phase || '',
        stage: '',
        value: 0,
        display: 0,
        done: false,
        shown: takeover
    };

    current = task;

    trace('begin', {phase: task.phase, stage: '', takeover: takeover});

    if (takeover) {
        shownAt = now();
        set({visible: true, value: 0, phase: task.phase, stage: '', failed: false, done: false});
        return task;
    }

    showTimer = setTimeout(function () {
        showTimer = 0;
        if (current !== task || task.done) {
            return;
        }
        task.shown = true;
        shownAt = now();
        set({visible: true, value: task.display, phase: task.phase, stage: task.stage || '', failed: false, done: false});
    }, SHOW_DELAY);

    return task;
}

/**
 * 上报 0..1。只前进不后退，避免合成进度和真实字节来回抖。
 * stage 是可选的细分阶段（download / decrypt / encrypt / upload），只影响文案。
 *
 * @param {object} task
 * @param {number} fraction
 * @param {string} [stage]
 */
export function update(task, fraction, stage) {

    if (!task) {
        return;
    }

    const nextStage = stage || task.stage || '';
    const stageChanged = nextStage !== (task.stage || '');
    task.stage = nextStage;

    // 入口就记，不受下面 shown / 接管判断和渲染阻塞影响
    trace('update', {phase: task.phase, stage: nextStage, fraction: fraction});

    let f = Number(fraction);
    let advanced = false;

    if (isFinite(f)) {
        if (f < 0) {
            f = 0;
        } else if (f > 1) {
            f = 1;
        }
        if (f > task.value) {
            task.value = f;
            advanced = true;
        }
    }

    if (current !== task || !task.shown) {
        return;
    }

    if (advanced) {
        const shown = typeof task.display === 'number' ? task.display : 0;

        if (f - shown > SMOOTH_MIN_JUMP) {
            smoothTo(task, f);
            return;
        }

        cancelSmooth();
        task.display = f;
        set({visible: true, value: f, phase: task.phase, stage: nextStage, failed: false, done: false});
        return;
    }

    // 进度没动、只换了阶段名：文案也要立刻跟上（下载完切到解密时就是这种）
    if (stageChanged) {
        const shown = typeof task.display === 'number' ? task.display : task.value;
        set({visible: true, value: shown, phase: task.phase, stage: nextStage, failed: false, done: false});
    }
}

/**
 * 正常结束：推到 100% 进入完成态。读写完成态都是常驻的（「✓ 加载完成」/
 * 「✓ 保存完成」），直到用户再次输入 / 切笔记 / 离开编辑页才收起。
 *
 * @param {object} task
 */
export function finish(task) {

    if (!task) {
        return;
    }

    task.done = true;

    if (task !== current) {
        return;
    }

    trace('finish', {phase: task.phase, stage: task.stage || '', value: task.value});

    clearTimeout(showTimer);
    showTimer = 0;

    if (!task.shown) {
        // 读写通常几十毫秒就结束，进度条还没来得及显示（SHOW_DELAY=120ms）。
        // 但「载入完成 / 保存完成」是用户要的明确反馈，哪怕没显示过进度条
        // 也要给一次确认：直接置成完成态并常驻，等用户输入/切笔记时再收起。
        // 小笔记几乎总走这条路，没有它就等于保存从来没反馈过。
        if (task.phase === 'read') {
            task.shown = true;
            shownAt = now();
            task.value = 1;
            task.display = 1;
            task.stage = '';
            task.doneSticky = false;
            set({visible: true, value: 1, phase: task.phase, stage: '', failed: false, done: true});
            hideAfterMinVisible(task, READ_DONE_MIN_VISIBLE);
            return;
        }

        cancelSmooth();
        current = null;
        set({visible: false, value: 0, phase: '', stage: '', failed: false, done: false});
        return;
    }

    task.value = 1;

    const shown = typeof task.display === 'number' ? task.display : 0;

    // 操作已经结束，收尾这一段不再属于某个阶段，用通用文案，避免
    // 「上传中 100%」下一秒变成「保存中 100%」的文字跳变。
    task.stage = '';
    task.doneSticky = false;

    const finalize = function () {
        if (current !== task) {
            return;
        }
        task.display = 1;
        set({visible: true, value: 1, phase: task.phase, stage: '', failed: false, done: true});
        hideAfterMinVisible(task, task.phase === 'save' ? SAVE_DONE_MIN_VISIBLE : READ_DONE_MIN_VISIBLE);
    };

    if (shown >= 1) {
        cancelSmooth();
        finalize();
        return;
    }

    // 等补间补到 1 再收尾：立刻推 1 会把中间帧吞掉，小笔记 80%→100% 还是会一跳
    smoothTo(task, 1, finalize);
}

/**
 * 出错结束：不推到 100%，把失败态写进 store 让条子变色，并停留更久。
 *
 * @param {object} task
 */
export function fail(task) {

    if (!task) {
        return;
    }

    task.done = true;
    task.failed = true;

    if (task !== current) {
        return;
    }

    clearTimeout(showTimer);
    showTimer = 0;
    cancelSmooth();

    const display = typeof task.display === 'number' ? task.display : 0;
    const value = display > 0 ? display : (task.value || 0);

    trace('fail', {phase: task.phase, stage: task.stage || '', shown: task.shown, value: value});

    // 快失败（低于 SHOW_DELAY 就出错）原本会被静默吞掉，用户完全不知道保存没成功。
    // 这里把这条任务提升成可见的失败态，并从头计满失败停留时间。
    if (!task.shown) {
        task.shown = true;
        shownAt = now();
    }

    set({visible: true, value: value, phase: task.phase, stage: '', failed: true, done: false});
    hideAfterMinVisible(task, FAIL_VISIBLE);
}
