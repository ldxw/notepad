# Notepad

**English** | [简体中文](README.zh.md)

![GitHub last commit](https://img.shields.io/github/last-commit/athlon1600/notepad)
![Docker Pulls](https://img.shields.io/docker/pulls/athlon1600/notepad)
![GitHub](https://img.shields.io/github/license/athlon1600/notepad)

A simple web-based notepad for writing and securely storing notes online.
Useful for easy sharing of text between people or devices.

- No registration process. You use a passphrase as your login.
- Fully encrypted at client-side. No one can read your notes, except you.
- The same note stays in step across all your devices — both open at once, both live
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

## :repeat: One note, several devices

Open the same passphrase on two devices (or two browser tabs) and both stay in step. There is no
account and no server-side session: each open editor polls its own encrypted note every **3 seconds**
and compares the `timestamp` inside the envelope. The ciphertext cannot be compared — every
encryption uses a fresh random IV, so the same text encrypts differently every time.

- **You are only reading** — the other device's edits land on their own, within about three seconds.
  Nothing to click.
- **You are typing and the other device saved first** — what is on your screen is never replaced
  silently. A bar appears above the editor: **Load newest** throws away your local copy, **Keep mine**
  writes yours back over the server's. Until you pick one, autosave stops sending, so your own typing
  cannot wipe the bar away.
- **You typed within the last 5 seconds** — that counts as "still writing". You get the same bar
  instead of a silent refresh, because the version you just autosaved may well be the one that was
  overwritten.

Before every automatic write the editor re-reads the note: if the server has moved on since the copy
you started from, it does not POST, it shows the bar. That check is what keeps a burst of fast typing
from flattening the other device's edit.

Last-writer-wins is still the rule underneath — there is no CRDT and no merge; the bar is what turns
a silent loss into a decision. Two people editing the same paragraph at the same second will still
end up with one of the two texts.

Polling pauses while the tab is hidden and fires again the moment it comes back. Reads are sent with
`Cache-Control: no-store`, so neither the browser nor a proxy can hand back a stale note.

### How big can a note be?

The limit is server-side and applies to the **encrypted envelope**, not to the characters you type:
`express.text({limit: "256kb"})` in `backend/src/Server.ts` (`NOTE_BODY_LIMIT`).

The figure the limit was sized against is `TEXT_MAX_LEN = 40000` characters in
`frontend/src/components/Editor.vue`. 40,000 CJK characters are 120,000 UTF-8 bytes, which hex-encode
to 240,000 characters of ciphertext plus the IV and JSON wrapping — about 240 KB. Hence 256kb. The UI
does not enforce `TEXT_MAX_LEN` itself; the textarea is unlimited and the server is what says no.

> Older builds capped the body at `10kb`, which returned `413 Note text limit reached` for anything
> past roughly 2,000 Chinese characters. If you put your own reverse proxy in front, its body limit
> has to be at least as large — the bundled `etc/Caddyfile` allows `1MB`.

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

Every supported variable (page metadata, `SITE_LANG`, `TZ`, `ARCHIVE_CRON`, `ARCHIVE_KEEP_DAYS`, `BACKUPS_DOWNLOAD`) is laid out and documented in
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
      SITE_TITLE: ${SITE_TITLE}
      SITE_DESCRIPTION: ${SITE_DESCRIPTION}
      SITE_KEYWORDS: ${SITE_KEYWORDS}
      SITE_AUTHOR: ${SITE_AUTHOR}
      SITE_LANG: ${SITE_LANG}
```

`SITE_LANG` sets the **default UI language** (`auto` = follow the browser, which is the default;
`zh` / `en` pin it). It is injected as `<meta name="default-locale">` and only applies to visitors
who have not picked a language yet — an explicit choice in the header is kept in `localStorage` and
always wins.

`backend/src/SiteMeta.ts` rewrites the served `index.html` once at boot (values are escaped), so the
overrides are present in the HTML itself — search engines see them too. Any variable left unset or
empty keeps the build-time default, and the boot log lists what was overridden.

The favicon follows the same rule: set `SITE_ICON` to a URL or a path (`/my.ico`) to replace the
built-in `favicon.ico`; leave it empty to keep the default icon.

### UI themes

The header carries theme controls next to the language switcher: three icons switch the **mode**
(follow system / light / dark), and the palette icon opens the **skin** picker. The two axes are
independent and combine freely.

To give first-time visitors a default theme, set two environment variables:

| Variable | Values | Meaning |
|---|---|---|
| `SITE_THEME` | `auto` (default) / `light` / `dark` | brightness; `auto` follows the visitor's system |
| `SITE_SKIN` | `classic` (default, modern teal) / `original` (upstream look) / `paper` / `ocean` / `forest` / `grape` / `sunset` / `mono` / `neon` / `bento` / `glass` / `fluid` | the whole palette; `bento` changes the layout, `glass` is glassmorphism, `fluid` adapts to the viewport. **The home page, the backups page and the 403 page all follow it** |

```bash
SITE_THEME="dark"
SITE_SKIN="paper"
```

They are injected as `<meta name="site-theme">` / `site-skin` and apply only to visitors who have
not picked a theme themselves — a visitor's own choice is stored in the browser and wins. An
unknown name falls back to the default theme (the backend validates the format only; the list
lives in the frontend), so a typo never renders an unstyled page.

### Theme gallery

Eleven themes, each in a light and a dark palette (22 looks in total). Real screenshots of the
running app:

| # | Name | Light | Dark |
|---|---|---|---|
| 1 | `classic` **Classic** — default: modern teal + orange action colour | ![classic light](docs/themes/classic-light.png) | ![classic dark](docs/themes/classic-dark.png) |
| 2 | `paper` **Paper** — warm paper tones, serif type, 6px corners | ![paper light](docs/themes/paper-light.png) | ![paper dark](docs/themes/paper-dark.png) |
| 3 | `ocean` **Ocean** — blue | ![ocean light](docs/themes/ocean-light.png) | ![ocean dark](docs/themes/ocean-dark.png) |
| 4 | `forest` **Forest** — green | ![forest light](docs/themes/forest-light.png) | ![forest dark](docs/themes/forest-dark.png) |
| 5 | `grape` **Grape** — purple | ![grape light](docs/themes/grape-light.png) | ![grape dark](docs/themes/grape-dark.png) |
| 6 | `sunset` **Sunset** — warm orange-red | ![sunset light](docs/themes/sunset-light.png) | ![sunset dark](docs/themes/sunset-dark.png) |
| 7 | `mono` **Mono** — no colour, monospace, 4px corners | ![mono light](docs/themes/mono-light.png) | ![mono dark](docs/themes/mono-dark.png) |
| 8 | `neon` **Neon** — high-contrast violet/cyan | ![neon light](docs/themes/neon-light.png) | ![neon dark](docs/themes/neon-dark.png) |
| 9 | `bento` **Bento** — changes the layout: tile grid, header shrinks on scroll | ![bento light](docs/themes/bento-light.png) | ![bento dark](docs/themes/bento-dark.png) |
| 10 | `glass` **Glass** — glassmorphism: gradient backdrop, star dots, frosted cards | ![glass light](docs/themes/glass-light.png) | ![glass dark](docs/themes/glass-dark.png) |
| 11 | `fluid` **Fluid** — fluid type, mobile bottom-sheet panel, safe-area aware | ![fluid light](docs/themes/fluid-light.png) | ![fluid dark](docs/themes/fluid-dark.png) |

(Full gallery and how to add a twelfth theme: [docs/themes/README.md](docs/themes/README.md).)

The palettes are data in the `skins` array of `frontend/src/theme.js`. Adding a twelfth theme is one
entry there (`id`, a label in every locale, and a light + dark token set) — the picker, the
preview swatches and `SITE_SKIN` pick it up automatically.

For a theme that also **changes the layout**, drop a module under `frontend/src/themes/`:
`<id>.css` (structural styles, every selector scoped under `html[data-skin="<id>"]`) plus
`<id>.js` (optional behaviour, exporting `onApply()`), then register one line in `THEME_HOOKS`
in `theme.js`. `themes/bento.{css,js}` is the working template.

### Per-language values

`SITE_TITLE`, `SITE_DESCRIPTION`, `SITE_KEYWORDS` and `SITE_NAME` all accept a `_ZH` / `_EN` suffix,
so one deployment can carry both languages:

```bash
SITE_NAME_ZH="我的记事本"    SITE_NAME_EN="My Notepad"
SITE_TITLE_ZH="在线记事本"    SITE_TITLE_EN="Online Notepad - store your notes securely online"
```

Switching the UI language then swaps the header name, `<title>` and the description / keywords
metas — no more Chinese text on an English page. A plain `SITE_TITLE=` without a suffix still works
as the fallback for every language. The static HTML (what a crawler sees without running JS) uses
the set matching `SITE_LANG`, or the `_EN` set when `SITE_LANG` is unset.

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
      ARCHIVE_KEEP_DAYS: ""      # keep only the last N days of dated archives; empty = keep every archive
```

The crontab is written at container start by `docker/setup-cron.sh`, and the job's output lands in
`/var/log/archive-cron.log` inside the container:

```bash
docker exec -it notepad tail -n 20 /var/log/archive-cron.log
docker exec -it notepad ls -lh backend/public/backups/
```

### Archive retention

One archive a day adds up. Cap it with `ARCHIVE_KEEP_DAYS`:

- **Unset (default)**: keep everything — nothing is ever deleted automatically;
- **A positive N**: keep only the `archive_YYYYMMDD.tar.gz` files from the last N days; older ones are
  removed by the archive job. `archive.tar.gz` (the "latest" copy) is always kept.
- An invalid value (say `abc`) is treated as "keep everything" with a warning — it never makes the
  archive job fail.

```bash
# run it once with "keep 7 days"
docker exec -it notepad env ARCHIVE_KEEP_DAYS=7 sh backend/bin/archive.sh
```

The pruning happens inside the archive job (03:30 daily by default), so either wait for the next run
or execute the command above once. The `/backups/` page footer shows the settings currently in effect.

### Browsing the backups

`backend/public/backups/` is listed at **`/backups/`** — the same idea as upstream's
`notepad.mx/backups/`: the page shows every archive with its size and date, and each one downloads
straight from there. Only encrypted blobs live in that directory, so exposing it is safe; the
homepage's download link points at it too.
Only `archive.tar.gz` and `archive_YYYYMMDD.tar.gz` are listed — anything else in the directory
(a stray `.gitignore`, for instance) is left out of the listing.

If the directory does not exist yet (a `backend/public` bind mount that started out empty, for
instance), the archive job creates it itself — `archive.sh` no longer exits with
"public directory … not found".

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
- use websockets instead of 3-second polling to make multi-device sync instant
- merge concurrent edits instead of last-writer-wins (a CRDT or a diff-based merge)
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
