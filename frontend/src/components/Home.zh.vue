<template>
    <div class="w-full max-w-screen-lg mx-auto px-1">

        <div style="max-width:700px; margin:3em auto;">

            <h1 class="text-center"> 🔑 使用唯一通行短语登录</h1>

            <input type="text" id="phrase" ref="query" placeholder="例如: note"
                   autocomplete="off"
                   autocapitalize="off" @keydown.enter="login" v-model="phrase" :disabled="isBusy">

            <div class="text-muted mt-2">可以尽可能简短，但为了增加他人猜测（或暴力破解）的难度，建议至少使用 4 个单词。
            </div>

            <p class="my-5">
                <small class="text-muted">字符数: {{ passLen }}
                    <span class="mx-2"></span> 单词数: {{ wordCount }}
                    <span class="mx-2"></span> 熵值: {{ entropy }} 比特
                </small>
            </p>

        </div>

        <hr>

        <div class="my-5">

            <p>这是一款简单的网络应用，用于安全在线编写和存储笔记。支持从任何设备、任何地点访问，旨在成为比 <strong>Simplenote</strong> 和 <strong>Evernote</strong> 更便携、更安全的替代方案。
            </p>

            <h2>功能特性</h2>

            <ul id="notepad_features">
                <li>🔑 <strong>以通行短语作为唯一登录凭证</strong>

                    - 无需创建账户，无需邮箱验证。
                    选择一组难以猜测的单词组合，即可作为你的唯一登录方式。
                </li>

                <li>🔐 <strong>全流程加密</strong> - 笔记在发送至服务器存储前，已在客户端完成加密。
                    任何人（包括管理方）都无法解密或查看笔记内容，
                    除非成功猜测你的通行短语。
                </li>

                <li>💻 <strong>开源透明</strong> - 可查看完整实现逻辑，也可在自有服务器上部署独立版本。
                </li>

                <li>💾 <strong>完全可导出</strong> - 支持下载所有笔记（加密状态），并轻松迁移至自有部署环境！
                    只要镜像副本存在，即使原服务器关闭，笔记也不会丢失。
                </li>

            </ul>

            <p class="my-4"></p>

            <p>
                支持所有带浏览器的设备/平台，体积小巧（约 100KB），运行快速，
                即使在低速网络环境下也能流畅使用。
            </p>


            <h2>🔐 安全性如何？</h2>

            <p>安全性完全取决于你的通行短语。若被猜测（或暴力破解），笔记将面临风险。</p>

            <p>除此之外，笔记在存储前会通过客户端加密（使用通行短语生成密钥），
                服务器仅存储密文。你可通过以下链接下载所有服务器存储的笔记：
                <br>
                <a href="https://notepad.mx/archive.tar.gz" target="_blank">https://notepad.mx/archive.tar.gz</a>
            </p>

            <p>
                下载后会得到一组加密文件，这些文件对非持有者无实际用途，
                除非你计划自行部署该应用。
            </p>

            <p>
                系统不记录用户名、邮箱或 IP 地址，仅存储无关联的加密文件，
                无密钥者无法解析内容。
            </p>

            <h2>忘记通行短语怎么办？</h2>

            <p>
                笔记将永久丢失。尽管数据仍存储在服务器，
                但加密特性决定了无密钥者（包括管理员）无法恢复内容。
            </p>

            <h2>💡 反馈与建议</h2>

            <p class="pb-12">
                项目完全开源，欢迎在 GitHub 页面参与讨论：

                <a href="https://github.com/Athlon1600/notepad"
                   target="_blank">https://github.com/Athlon1600/notepad</a>
            </p>

        </div>

    </div>
</template>

<script>

import {TextUtil} from "../classes/TextUtil";
import {Util} from "../classes/Util";

import {Security} from "../classes/Security";
import {APP_KEY} from "../config";
import store from "../store";

export default {
    data() {
        return {
            isBusy: false,
            phrase: '',
        }
    },
    computed: {
        wordCount: function () {
            return TextUtil.wordCount(this.phrase);
        },
        entropy: function () {
            // TODO: 不要假设字符集大小为26（多数短语包含[a-z]+空格）
            return Util.calcEntropy(26, this.phrase.length);
        },
        // 英语词典约有171,146个单词，攻击针对单词级别而非字母级别
        phraseEntropy() {
            return Util.calcEntropy(30000, this.wordCount);
        },
        passLen: function () {
            return this.phrase.length;
        }
    },
    methods: {
        async login() {
            if (this.phrase.trim().length >= 1) {
                this.isBusy = true;
                const val = this.phrase;
                console.time('scrypt');
                const hash = await Security.slowHash(val, APP_KEY);
                console.timeEnd('scrypt');
                this.isBusy = false;
                store.mutations.login(hash);
            }
        }
    },
    mounted() {
        this.$refs.query.focus();
    }
}
</script>
