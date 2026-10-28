const apiBaseUri = '';

class Api {

    async get(code) {

        const options = {
            method: 'GET',
            // 轮询读取：任何中间层都不许缓存，否则会一直拿到旧密文。
            // 后端也会发 Cache-Control: no-store，这里再兜一层（某些代理只看请求头）。
            cache: 'no-store'
        }

        return fetch('/api/notes/' + code, options)
            .then(response => response.text());
    }

    /**
     *
     * @param code
     * @param contents
     * @returns {Promise<string>}
     */
    async save(code, contents) {

        const options = {
            method: 'POST',
            headers: {
                "Content-Type": "text/plain"
            },
            body: contents
        };

        return fetch('/api/notes/' + code, options)
            .then(response => {

                if (!response.ok) {
                    console.log(response);
                    throw new Error(response.statusText);
                }

                return response.text();
            });
    }

    async delete(code) {

        const options = {
            method: 'DELETE'
        };

        return fetch('/api/notes/' + code, options)
            .then(response => response.text());
    }
}


export default new Api();