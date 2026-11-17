<template>
    <div class="backups-page">

        <h1 class="backups-title">{{ t("backups.title") }}</h1>

        <p class="backups-summary">{{ summary }}</p>

        <div class="backups-notice" v-if="data && !data.downloadable">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="4" y="10.5" width="16" height="10" rx="2"/>
                <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>
            </svg>
            <span>{{ t("backups.notice") }}</span>
        </div>

        <div class="backups-list" v-if="data && data.files.length">
            <a v-for="file in data.files"
               :key="file.name"
               class="backup-card"
               :class="{static: !data.downloadable}"
               :href="data.downloadable ? file.url : undefined"
               :download="data.downloadable ? file.name : undefined">
                <svg class="backup-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/>
                    <rect x="2" y="3" width="20" height="5" rx="1.5"/>
                    <path d="M10 12h4"/>
                </svg>
                <span class="backup-meta">
                    <span class="backup-name">{{ file.name }}<span class="backup-badge" v-if="file.latest">{{ t("backups.latest") }}</span></span>
                    <span class="backup-sub">{{ sizeLabel(file.size) }} · {{ timeLabel(file.time) }}</span>
                </span>
                <span class="backup-dl" :class="{off: !data.downloadable}">
                    {{ data.downloadable ? t("backups.download") : t("backups.off") }}
                    <template v-if="data.downloadable"> ↓</template>
                </span>
            </a>
        </div>

        <div class="backups-empty" v-else-if="data">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 7a2 2 0 0 1 2-2h3.4l2 2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>
            </svg>
            <p>{{ t("backups.empty") }}</p>
            <p class="muted">{{ t("backups.emptyHint") }}</p>
        </div>

        <section class="backups-notes" v-if="data">
            <p>{{ data.downloadable ? t("backups.introOn") : t("backups.introOff") }}</p>
            <p>{{ data.keepDays ? t("backups.keep", {days: data.keepDays}) : t("backups.keepAll") }}</p>
            <p>{{ t("backups.hint") }}</p>
        </section>

    </div>
</template>

<script>
import {ref, computed, onMounted, watch} from "vue";
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
                data.value = {downloadable: false, keepDays: 0, total: 0, totalSize: 0, files: []};
            }
        };

        onMounted(load);

        // 切换语言只影响文案，不重新拉清单
        watch(locale, () => {
            document.title = t("backups.title");
        });

        const summary = computed(() => {
            if (!data.value) return "";
            if (!data.value.files.length) return t("backups.allOnly");
            return t("backups.count", {n: data.value.files.length, size: sizeLabel(data.value.totalSize)});
        });

        const units = ["B", "KB", "MB", "GB"];

        function sizeLabel(bytes) {
            let value = Number(bytes) || 0;
            let index = 0;
            while (value >= 1024 && index < units.length - 1) {
                value = value / 1024;
                index++;
            }
            const text = index === 0 ? String(value) : value.toFixed(value >= 10 ? 0 : 1);
            return text + " " + units[index];
        }

        function timeLabel(iso) {
            const date = new Date(iso);
            if (isNaN(date.getTime())) return "";
            const pad = (n) => String(n).padStart(2, "0");
            return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
                + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
        }

        return {t, data, summary, sizeLabel, timeLabel};
    }
};
</script>
