# Hermes Agent War Room

A mobile-oriented command center for an autonomous agent stack: a React SPA served
by a single Express process that also exposes the API it talks to. The UI covers
telemetry, task and agent management, tactical self-correction, a Termux-style
shell, a stylus scratchpad, and a reconnaissance tab that maps the local subnet.

## Quick start

Node 22 or newer. `.nvmrc` pins the exact intended version (`nvm use`), and
`package.json` enforces the floor with `engines`.

```bash
npm ci            # install exactly what the lockfile pins
npm run dev       # Express + Vite middleware on http://localhost:3000
```

`npm run dev` serves the API and the SPA from one port; edit a file and Vite
reloads the UI. For a production-style run, build once and start the bundled
server:

```bash
npm run build     # dist/ (SPA assets + dist/server.cjs)
npm start         # serves dist/ and the API on http://localhost:3000
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Runs `server.ts` directly via `tsx` with Vite in middleware mode. |
| `npm run build` | Vite build for the SPA, then esbuild bundles `server.ts` to `dist/server.cjs`. |
| `npm start` | Runs the built server (serves `dist/`, no Vite). |
| `npm run lint` | `tsc --noEmit` over the whole project, including `test/`. |
| `npm test` | Unit and integration tests via Node's built-in test runner. |
| `npm run test:browser` | Playwright check of the recon panel in real chromium. |
| `npm run clean` | Removes `dist/`. |

## Configuration

Copy `.env.example` to `.env` and fill in what you need. Nothing is required to
start the app.

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Enables the Gemini-backed agent engine. Without it, the server falls back to a local simulated reasoning engine. |
| `APP_URL` | Public URL of this deployment, used for self-referential links. |
| `PORT` | Port for the Express server. Defaults to `3000`. |

## Architecture

Everything runs from one Node process (`server.ts`, ~2000 lines): it registers the
`/api/*` routes, then either mounts Vite's middleware (development) or serves
`dist/` (production).

```
server.ts                  Express app, in-memory state, ~30 /api routes
index.html                 SPA entry; Vite mounts src/main.tsx
src/App.tsx                Shell: tab routing, polling, and all shared state
src/components/*View.tsx   One component per tab
src/types.ts               Shared domain types
src/utils/*.ts             Pure, DOM-free logic (see below)
test/                      Unit, integration and browser tests
```

Tabs are rendered from a single `activeTab` value in `App.tsx` and declared in
`NavigationDock.tsx`; the `WarRoomTab` union in `src/types.ts` is the source of
truth for their ids.

### API areas

`/api/health`, `/api/telemetry/live`, `/api/analytics/realtime`,
`/api/termux/exec`, `/api/agent/prompt`, `/api/agents*`, `/api/tasks*`,
`/api/comms*`, `/api/tuning`, `/api/tactical-corrections*`, `/api/stylus/analyze`,
and `/api/recon/*`.

Server state (agents, tasks, memories, corrections, comms) lives in memory and
resets whenever the process restarts.

### What is real vs. simulated

Worth knowing before reading the UI as ground truth:

- **Real:** reconnaissance TCP probing and host OS facts (`net`, `os`), the
  recon watch-list scheduler, the favicon/build pipeline, and the Gemini call when
  a key is present.
- **Simulated:** agent reasoning, task execution, telemetry history, comms
  throughput, and most Termux command output. `/api/termux/exec` returns realistic
  but synthetic output for a Termux/aarch64 device; it does not execute the
  commands you type.

## The reconnaissance tab

The only part of the app built on real measurement, and the focus of the test
suite. Open RECON and it runs one `network-map` scan automatically so the map is
populated without a click.

- Scan types: `network`, `port`, `process`, `network-map` (also keys `1`–`4`;
  `Enter`/`Space` runs the selected scan, `T` toggles the map).
- `POST /api/recon/scan` probes the local subnet with real TCP connect checks and
  returns `{ scanType, results, hosts, localAddresses, timestamp, executionTimeMs, status }`.
  `hosts` is what the topology map draws; `localAddresses` come from
  `os.networkInterfaces()` so the scanning device is marked as the local node.
- Only the `network-map` scan owns the map. Narrower scans probe a handful of
  hosts (a port scan touches one) and would otherwise shrink a discovered subnet
  to that handful.
- Before any scan reports hosts, the map draws a labelled **baseline** profile
  through the same layout path, so the two views stay visually consistent.
- `POST /api/recon/probe` re-probes just the watch list. It is bounded: at most
  16 hosts per request, IPv4 dotted-quads only, so a request can never target a
  hostname, and it deduplicates.
- The watch list polls every 15 s **only while the tab is open**, and is persisted
  to `localStorage`; so are the last 50 scan history entries.
- Exports: a JSON payload (current scan + topology + history) and a plain-text
  report with a host table and a watch-list section.

### Layout notes

Map nodes are positioned as percentages of the container width, while the link
lines live in a separate SVG stretched with `preserveAspectRatio="none"`. That
split is deliberate: a uniformly scaled SVG gets letterboxed on a wide container
and the lines drift toward the centre. Node positions derive from their icon
centre so the DOM offset and the viewBox endpoint can never disagree.

## Testing

Two layers, no third-party test framework — `node:test` with the existing `tsx`
loader, plus `react-dom/server` for render assertions.

```bash
npm test              # 122 unit + integration tests, ~10s
npm run test:browser  # 71 assertions in real chromium, ~90s
```

| File | Covers |
| --- | --- |
| `test/reconHistory.test.ts` | History persistence: corrupt payloads, trimming, rejecting storage. |
| `test/topology.test.ts` | Host role classification and map geometry (bounds, spacing, link endpoints). |
| `test/watchList.test.ts` | Watch-list validation, capacity, and status merging. |
| `test/reconExport.test.ts` | Export payload shape and the text report's sections. |
| `test/ReconView.test.tsx` | Render contract: busy state, real scan output, watch markers, baseline fallback. |
| `test/reconEndpoint.test.ts` | Boots the real server and asserts the HTTP contract of the recon endpoints. |
| `test/views.test.tsx` | Render coverage for every tab component: props in, expected visible contract out, plus the accessible-name and focusability invariants. |
| `test/shell.test.tsx` | The header and nav dock: exposed toggle state, the current section, and badge names. |
| `test/a11y.test.ts` | Keyboard activation rules shared by controls that cannot be a native button. |
| `test/browser/reconMap.mjs` | Real-browser check of the panel, map geometry, a11y and exports. |
| `test/fixtures.ts` | Shared typed fixtures for the view tests (not a suite itself). |
| `test/a11y-helpers.ts` | Markup assertions shared by the render suites (not a suite itself). |

### Browser check

`npm run test:browser` boots the dev server itself (so it always tests current
source, never a stale `dist/`), drives it in chromium, and asserts what static
markup cannot: node bounds, overlaps, whether link endpoints land on their nodes,
keyboard activation, and accessible names.

- Override the port with `BROWSER_CHECK_PORT` (default `3482`).
- Chromium is resolved from `PLAYWRIGHT_CHROMIUM_PATH` / `CHROME_PATH`, then
  playwright's default, then the newest cached `~/.cache/ms-playwright/chromium-*`
  build. If none is found: `npx playwright install chromium`.
- Failure screenshots are written to `test/browser/artifacts/` (gitignored).
- Elements the check depends on carry `data-testid` hooks (`recon-panel`,
  `topology-map`, `watch-halo`).

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests, as two
parallel jobs: **checks** (`npm ci` → lint → test → build) and **browser**
(`npm ci` → install chromium → `npm run test:browser`, uploading failure
screenshots as an artifact).

Both jobs take the Node version from `.nvmrc` via `node-version-file`, so CI
cannot drift from the runtime you pin locally. The suites need no network
transport step to pass: the endpoint tests bind a local port and the browser
check boots its own dev server.

## Commits

One logical change per commit, so a regression can be reverted or bisected
without dragging unrelated work along:

- Imperative subject, roughly 72 characters or less.
- A body that explains *why* the change is needed, not a restatement of the diff.
- Keep formatting-only or dependency-only churn in its own commit.
- Don't mix a bug fix with a feature; land the fix first when a feature depends on it.

The earliest commits in this repository predate the convention and bundle several
concerns; new work should follow it.

## Package manager

**npm.** `package-lock.json` is the single source of truth and must stay
committed — `npm ci` fails without it. The repository previously also carried a
`bun.lock`, but it predated several dependencies (`playwright-core`,
`@types/react`) and would have resolved stale versions, so it was removed.

To switch to bun instead: run `bun install` to regenerate a `bun.lock`, commit
it, and replace the npm steps in the CI workflow with
`bun install --frozen-lockfile` and `bun run <script>`.
