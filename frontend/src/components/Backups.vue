<template>
    <div class="backups-page">

        <h1 class="backups-title">{{ t("backups.title") }}</h1>

        <p class="backups-summary" v-if="data && data.total">{{ t("backups.count", {n: data.total}) }}</p>
        <p class="backups-summary muted" v-if="data && data.latestAt">{{ t("backups.latestAt", {time: timeLabel(data.latestAt)}) }}</p>

        <div class="backups-empty" v-if="data && !data.total">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 7a2 2 0 0 1 2-2h3.4l2 2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>
            </svg>
            <p>{{ t("backups.empty") }}</p>
            <p class="muted">{{ t("backups.emptyHint") }}</p>
        </div>

        <section class="backups-notes" v-if="data">
            <p>{{ data.keepDays ? t("backups.keep", {days: data.keepDays}) : t("backups.keepAll") }}</p>
            <p>{{ t("backups.hint") }}</p>
        </section>

    </div>
</template>

<script>
import {ref, onMounted, watch} from "vue";
import {t, locale} from "../i18n";

export default {
    name: "Backups",

    setup() {

        const data = ref(null);

        const load = async function () {
            try {
                const response = await fetch("/api/backups", {headers: {"Accept": "application/json"}});
                data.value = await response.json();
            } catch (ex) {
                data.value = {keepDays: 0, latestAt: null, total: 0};
            }
        };

        onMounted(load);

        // 切换语言只影响文案，不重新拉数据
        watch(locale, () => {
            document.title = t("backups.title");
        });

        // 归档的文件名、时间戳不再进入匿名页面，只显示数量与最新归档时间
        function timeLabel(iso) {
            const date = new Date(iso);
            if (isNaN(date.getTime())) return "";
            const pad = (n) => String(n).padStart(2, "0");
            return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
                + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
        }

        return {t, data, timeLabel};
    }
};
</script>
