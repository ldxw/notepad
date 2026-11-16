const apiBaseUri = '';

// fetch 拿不到传输进度（上传/下载都只有终点），这里统一用 XHR。
// 进度回调只在 lengthComputable 且 total > 0 时上报，避免 chunked 响应给出假的 0。
function makeXhrRequest(method, url, options) {

    const opts = options || {};
    const body = typeof opts.body === 'undefined' ? null : opts.body;
    const contentType = opts.contentType || null;
    const onUploadProgress = typeof opts.onUploadProgress === 'function' ? opts.onUploadProgress : null;
    const onDownloadProgress = typeof opts.onDownloadProgress === 'function' ? opts.onDownloadProgress : null;
    const checkOk = !!opts.checkOk;

    return new Promise(function (resolve, reject) {

        const xhr = new XMLHttpRequest();
        xhr.open(method, url, true);

        if (contentType) {
            xhr.setRequestHeader('Content-Type', contentType);
        }

        if (onUploadProgress && xhr.upload) {
            xhr.upload.onprogress = function (event) {
                if (event.lengthComputable && event.total > 0) {
                    onUploadProgress(event.loaded / event.total);
                }
            };
        }

        if (onDownloadProgress) {
            xhr.onprogress = function (event) {
                if (event.lengthComputable && event.total > 0) {
                    onDownloadProgress(event.loaded / event.total);
                }
            };
        }

        xhr.onload = function () {

            if (checkOk && !(xhr.status >= 200 && xhr.status < 300)) {
                console.log(xhr.status, xhr.statusText);
                reject(new Error(xhr.statusText || ('HTTP ' + xhr.status)));
                return;
            }

            if (onUploadProgress) onUploadProgress(1);
            if (onDownloadProgress) onDownloadProgress(1);

            resolve(xhr.responseText);
        };

        xhr.onerror = function () {
            reject(new Error('Network error'));
        };

        xhr.ontimeout = function () {
            reject(new Error('Request timed out'));
        };

        xhr.send(body);
    });
}

class Api {

    /**
     * @param {string} code
     * @param {function(number)} [onProgress] 0..1，下载进度
     * @return {Promise<string>}
     */
    async get(code, onProgress) {

        return makeXhrRequest('GET', '/api/notes/' + code, {
            onDownloadProgress: onProgress
        });
    }

    /**
     *
     * @param code
     * @param contents
     * @param {function(number)} [onProgress] 0..1，上传进度
     * @returns {Promise<string>}
     */
    async save(code, contents, onProgress) {

        return makeXhrRequest('POST', '/api/notes/' + code, {
            body: contents,
            contentType: 'text/plain',
            checkOk: true,
            onUploadProgress: onProgress
        });
    }

    async delete(code) {

        return makeXhrRequest('DELETE', '/api/notes/' + code, {});
    }
}


export default new Api();
