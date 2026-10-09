# Notepad

**English** | [简体中文](README.zh.md)

![GitHub last commit](https://img.shields.io/github/last-commit/athlon1600/notepad)
![Docker Pulls](https://img.shields.io/docker/pulls/athlon1600/notepad)
![GitHub](https://img.shields.io/github/license/athlon1600/notepad)

A simple web-based notepad for writing and securely storing notes online.
Useful for easy sharing of text between people or devices.

- No registration process. You use a passphrase as your login.
- Fully encrypted at client-side. No one can read your notes, except you.
- Extremely minimal and lightweight

## :star: Demo

Exact version of this application:

- https://notepad.mx

## :whale2: Deploy using Docker

Rent a server for free at [linode.com](https://www.linode.com/lp/refer/?r=cee8aa429cd4cbb5a6e6d1ebfd8986f661d8ef4e)

Install Docker 19+ on your new server:

```shell
curl -sSL https://get.docker.com/ | sh
```

and then run:

```shell
git clone https://github.com/Athlon1600/notepad.git
cd notepad
docker compose up -d
```

:heavy_check_mark: Application will be running on port 3000

## :hammer: Deployment to Production (manual)

Rent a server for free at [linode.com](https://www.linode.com/lp/refer/?r=cee8aa429cd4cbb5a6e6d1ebfd8986f661d8ef4e)

Deploy this whole thing to production in three lines:

```shell
git clone https://github.com/Athlon1600/notepad.git
cd notepad
npm run build && npm run start
```

This will build Vue frontend first, and then move the resulting bundle to the `/public` directory
of the backend application from which the frontend will be served from.

:heavy_check_mark: Application will then be available on port 3000

## :globe_with_meridians: Caddy Server

If you want HTTPS support out of the box, you should install Caddy:

```shell
wget -qO- https://raw.githubusercontent.com/Athlon1600/useful/master/caddy/caddy_linux_amd64.sh | bash
```

Be sure to modify `etc/Caddyfile` replacing `notepad.mx` with your own domain,
and then run:

```shell
caddy start --config ./etc/Caddyfile 
```

## :closed_lock_with_key: How it works

- You login using a passphrase which produces a hash value of 32 bytes (or 64 characters in hex)
- First 16 bytes is your **authentication key**  used in API calls when sending data back and forth
- Next 16 bytes is your **encryption key** used to encrypt that text data
- Encryption key never leaves your browser.
- All the notes are stored as encrypted files inside `storage/{storage_key}` where storage_key = `md5(authentication_key)`

See the drawing below:

![scrypt](https://github.com/Athlon1600/notepad/assets/1063088/aed67aae-bd10-4917-a149-fc2db0ad1d17)

This makes it so that no one besides you know the contents of your notes, or where they are stored on the server.

![storage](https://i.imgur.com/cXgoRLX.png)

## :arrows_counterclockwise: Sharing Notes between instances

Notes created on one server are compatible with all other deployments of this application,
as long as passphrases are hashed using the same salt (`notepad.mx` by default, defined as
`APP_KEY` in `frontend/src/config.js`).

The salt is settable at runtime with **`SITE_SALT`** — no rebuild: give your instance its own
value and its notes live in their own namespace. Note that changing it later makes notes created
under the old salt unreachable from the UI, so back up first.

This makes it possible to import notes from one server to another, or host a backup mirror instance in case the main
instance gets shut down.

You can download all the notes created on the main **notepad.mx** instance here:

- https://notepad.mx/backups/archive.tar.gz

extract everything to `backend/storage`, and now everyone using your application has access to those notes too.

There is also a command that does all that for you automatically:

```shell
docker exec -it notepad sh -c "sh backend/bin/sync.sh"
```

You may also do your own backups periodically by running this command (typically via cron):

```shell
docker exec -it notepad sh -c "sh backend/bin/archive.sh"
```

## :globe_with_meridians: Languages / 多语言

The UI ships with **English** and **简体中文**. A language switcher (English / 中文) sits in the
header on every page — including the homepage — and the choice is remembered in `localStorage`.
On a first visit the app auto-detects the browser language (`zh*` → Chinese, everything else → English).

All copy lives in `frontend/src/i18n.js`, a tiny hand-rolled i18n module (no extra dependency):

```js
import {t, setLocale, locale} from "../i18n";

t("home.loginTitle");   // translate a key for the active locale
setLocale("zh");        // switch language (persists + updates <html lang> and <title>)
```

Missing keys fall back to English and then to the key itself, so a partial translation is safe.

### Adding another language

1. Copy the `en` block inside `messages` in `frontend/src/i18n.js` and translate the values.
2. Add `{code: "...", label: "..."}` to `availableLocales` in the same file.

That is all — the switcher picks it up automatically.

## :label: Page metadata (runtime variables)

`<title>`, `<meta name="description">`, `<meta name="keywords">` and `<meta name="author">` get their
defaults baked into the built `index.html` from `frontend/site.config.js` (build time). They can then be
overridden **at container start** — no rebuild needed — with environment variables.

Every supported variable (page metadata, `SITE_LANG`, `TZ`, `ARCHIVE_CRON`) is laid out and documented in
**`.env.example`** — copy it next to `docker-compose.yml` and edit:

```shell
cp .env.example .env
docker compose up -d
```

```bash
docker run -d -p 3000:3000 \
  -e SITE_TITLE="My Notepad" \
  -e SITE_DESCRIPTION="Notes, stored securely online" \
  -e SITE_KEYWORDS="notepad,encrypted notes" \
  -e SITE_AUTHOR="me" \
  -e SITE_LANG="en" \
  ldxw/notepad
```

Or via `docker-compose.yml` / a `.env` file next to it:

```yaml
    environment:
      SITE_TITLE: ${SITE_TITLE:-}
      SITE_DESCRIPTION: ${SITE_DESCRIPTION:-}
      SITE_KEYWORDS: ${SITE_KEYWORDS:-}
      SITE_AUTHOR: ${SITE_AUTHOR:-}
      SITE_LANG: ${SITE_LANG:-}
```

`SITE_LANG` sets the **default UI language** (`auto` = follow the browser, which is the default;
`zh` / `en` pin it). It is injected as `<meta name="default-locale">` and only applies to visitors
who have not picked a language yet — an explicit choice in the header is kept in `localStorage` and
always wins.

`backend/src/SiteMeta.ts` rewrites the served `index.html` once at boot (values are escaped), so the
overrides are present in the HTML itself — search engines see them too. Any variable left unset or
empty keeps the build-time default, and the boot log lists what was overridden.

## :alarm_clock: Automatic backups (in-container cron)

The image runs the archive job once a day, so you do not have to wire up your own cron:

```bash
docker exec -it notepad sh -c "sh backend/bin/archive.sh"   # what the job runs
```

`backend/storage` is packed into `backend/public/backups/` (both are host-mounted volumes, so the
archives survive container restarts) every day at **03:30**.

Both the schedule and the timezone are environment variables - no rebuild needed:

```yaml
    environment:
      TZ: Asia/Shanghai          # the hour below is interpreted in this timezone (container default is UTC)
      ARCHIVE_CRON: "30 3 * * *" # standard 5-field cron; "off" disables the job
```

The crontab is written at container start by `docker/setup-cron.sh`, and the job's output lands in
`/var/log/archive-cron.log` inside the container:

```bash
docker exec -it notepad tail -n 20 /var/log/archive-cron.log
docker exec -it notepad ls -lh backend/public/backups/
```

## Troubleshooting

### Prerendering

`npm run build` prerenders the homepage into static HTML right after webpack, using the official
Chrome for Testing `chrome-headless-shell` and `--dump-dom` (`frontend/scripts/prerender.mjs`).
Both x64 and arm64 work: the Dockerfile downloads the build matching `TARGETARCH` and runs
`chrome-headless-shell --version` to prove it starts.

The old puppeteer-based plugin is gone - puppeteer@1.20 ships only an x86_64 Chromium, so the arm64
leg of a multi-arch build could never launch it.

Outside Docker, point `CHROME_BIN` at any Chrome/Chromium binary to prerender locally; if no browser
is found the step is skipped with a warning, so a plain `npm run build` still succeeds.

> ERROR in [prerender-spa-plugin] Unable to prerender all routes!  
> ERROR in Failed to launch chrome!  
> error while loading shared libraries: libX11-xcb.so.1: cannot open shared object file: No such file or directory

Make sure your system has all the necessary dependencies installed. See this link:
- https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#chrome-doesnt-launch-on-linux

## To-do list

- rewrite frontend to use TypeScript
- use websockets to better support multiple sessions editing same document scenarios
- add option to use Redis for storing notes
- ability to use this app via command line
- update the editor to allow subdivision of long text into multiple subsections via linebreaks

## Versions

If you want to continue using v1, go here:  
https://github.com/Athlon1600/notepad/tree/v1.0.0-rc.1

## External Links

- https://hub.docker.com/r/athlon1600/notepad
- https://ricmoo.github.io/scrypt-js/
- https://www.proxynova.com/tools/brute-force-calculator
