// Browser check for the recon panel and its topology map.
//
// Run with: npm run test:browser
//
// Boots the dev server (so it exercises the current source, never a stale
// dist/), drives it in real chromium, and asserts the layout geometry that
// static markup tests cannot see: node bounds, overlaps, and whether the
// stretched SVG link endpoints actually land on their nodes.
//
// Browser resolution order:
//   1. PLAYWRIGHT_CHROMIUM_PATH / CHROME_PATH
//   2. whatever playwright-core resolves by default
//   3. the newest cached ~/.cache/ms-playwright/chromium-* build
// If none is found, run `npx playwright install chromium`.

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.BROWSER_CHECK_PORT || 3482);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ARTIFACT_DIR = path.join(__dirname, 'artifacts');

const failures = [];
let page = null;

// Every page the run opens. A phone-layout regression is invisible in a desktop
// screenshot, so failures are captured per page rather than on one of them.
const openPages = [];
let failureCaptured = false;
let pendingCapture = null;

function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) {
    failures.push(`${label}${detail ? ` (${detail})` : ''}`);

    // Captured on the first failure, not at the end. The sweep navigates through
    // every tab, so a screenshot taken after the run would show whatever screen
    // happened to be last rather than the one that broke.
    if (!failureCaptured && page) {
      failureCaptured = true;
      pendingCapture = captureFailureArtifacts('failure-1');
    }
  }
  return ok;
}

function resolveBrowser() {
  const fromEnv = process.env.PLAYWRIGHT_CHROMIUM_PATH || process.env.CHROME_PATH;
  if (fromEnv) return fromEnv;

  try {
    const resolved = chromium.executablePath();
    if (resolved && fs.existsSync(resolved)) return resolved;
  } catch {
    // Fall through to the cache scan below.
  }

  const cacheRoot = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (fs.existsSync(cacheRoot)) {
    const candidates = fs
      .readdirSync(cacheRoot)
      .filter((entry) => /^chromium(_headless_shell)?-\d+$/.test(entry))
      .sort((a, b) => Number(b.split('-').pop()) - Number(a.split('-').pop()));

    const layouts = [
      ['chrome-linux', 'chrome'],
      ['chrome-linux-arm64', 'chrome'],
      ['chrome-linux', 'headless_shell'],
      ['chrome-linux-arm64', 'headless_shell'],
    ];

    for (const dir of candidates) {
      for (const parts of layouts) {
        const candidate = path.join(cacheRoot, dir, ...parts);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }

  return null;
}

async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`dev server did not start within ${timeoutMs}ms`);
}

/** Measure the rendered topology: node boxes, icon centres and link endpoints. */
function measureTopology() {
  return page.evaluate(() => {
    // Scoped to the map: other charts on the page (recharts sparklines) also
    // render SVG with preserveAspectRatio="none".
    const container = document.querySelector('[data-testid="topology-map"]');
    if (!container) return null;

    const svg = container.querySelector('svg[preserveAspectRatio="none"]');
    if (!svg) return null;

    const mapRect = container.getBoundingClientRect();
    const matrix = svg.getScreenCTM();
    const round = (value) => Math.round(value * 10) / 10;

    const nodes = [...container.querySelectorAll(':scope > div[title]')].map((el) => {
      const rect = el.getBoundingClientRect();
      // Pick the wrapper child that actually holds the glyph, so decorations
      // layered into the icon wrapper cannot be mistaken for the icon.
      const iconWrapper = el.querySelector('div.relative');
      const icon = iconWrapper
        ? [...iconWrapper.children].find((child) => child.querySelector('svg'))
        : null;
      const iconRect = icon?.getBoundingClientRect();
      return {
        title: el.getAttribute('title'),
        text: el.textContent,
        left: round(rect.left - mapRect.left),
        right: round(rect.right - mapRect.left),
        top: round(rect.top - mapRect.top),
        bottom: round(rect.bottom - mapRect.top),
        iconCenterX: iconRect ? iconRect.left + iconRect.width / 2 : null,
        iconCenterY: iconRect ? iconRect.top + iconRect.height / 2 : null,
      };
    });

    const links = [...svg.querySelectorAll('line')].map((line) => {
      const point = svg.createSVGPoint();
      point.x = line.x2.baseVal.value;
      point.y = line.y2.baseVal.value;
      const screen = point.matrixTransform(matrix);
      return { x: round(screen.x), y: round(screen.y) };
    });

    return {
      width: round(mapRect.width),
      height: round(mapRect.height),
      nodes,
      links,
    };
  });
}

function checkTopology(label, topology) {
  if (!check(`${label}: topology rendered`, topology && topology.nodes.length > 0)) return;

  console.log(`  info  ${label}: ${topology.nodes.length} nodes, ${topology.links.length} links, map ${topology.width}x${topology.height}px`);

  const outsideBounds = topology.nodes.filter(
    (node) =>
      node.left < -1 ||
      node.right > topology.width + 1 ||
      node.top < -1 ||
      node.bottom > topology.height + 1
  );
  check(`${label}: every node is inside the map bounds`, outsideBounds.length === 0, outsideBounds.map((n) => n.title).join(', '));

  const overlaps = [];
  for (let i = 0; i < topology.nodes.length; i++) {
    for (let j = i + 1; j < topology.nodes.length; j++) {
      const a = topology.nodes[i];
      const b = topology.nodes[j];
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
        overlaps.push(`${a.title} ~ ${b.title}`);
      }
    }
  }
  check(`${label}: no two nodes overlap`, overlaps.length === 0, overlaps.join(', '));

  // Identify the gateway by its role badge rather than its label: the .1 host is
  // still named "GATEWAY" when it fails to answer, so a text match would lie.
  const gatewayNodes = topology.nodes.filter((node) => node.text.includes('ONLINE // GATEWAY'));
  check(
    `${label}: exactly one link per ring node`,
    topology.links.length === topology.nodes.length - gatewayNodes.length,
    `links=${topology.links.length} nodes=${topology.nodes.length} gateways=${gatewayNodes.length}`
  );

  // The whole point of the stretched link layer: endpoints must sit on the
  // icons rather than drifting toward the middle of a wide container.
  const drifts = topology.nodes
    .filter((node) => node.iconCenterX !== null && !node.text.includes('ONLINE // GATEWAY'))
    .map((node) => {
      const nearest = topology.links.reduce(
        (best, link) => Math.min(best, Math.hypot(link.x - node.iconCenterX, link.y - node.iconCenterY)),
        Number.POSITIVE_INFINITY
      );
      return { title: node.title, drift: Math.round(nearest * 10) / 10 };
    });

  const worst = drifts.reduce((max, entry) => Math.max(max, entry.drift), 0);
  check(`${label}: links land on their nodes (<= 2px)`, worst <= 2, `worst ${worst}px`);
}

async function captureFailureArtifacts(name) {
  try {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  } catch (error) {
    console.log(`  info  could not create test/browser/artifacts: ${error.message}`);
    return;
  }

  // Every screenshot is started in the same tick. Awaiting them one at a time
  // lets a page be torn down in between — the phone page closes at the end of its
  // own section, which is exactly where its checks fail.
  const writes = [];
  for (const { target, label } of openPages) {
    if (target.isClosed()) continue;
    const file = `${name}-${label}.png`;
    writes.push(
      target
        .screenshot({ path: path.join(ARTIFACT_DIR, file), fullPage: false })
        .then(() => console.log(`  info  screenshot written to test/browser/artifacts/${file}`))
        .catch((error) => console.log(`  info  could not capture the ${label} page: ${error.message}`))
    );
  }

  await Promise.all(writes);
}

async function main() {
  const executablePath = resolveBrowser();
  if (!executablePath) {
    console.error(
      'No chromium found. Run `npx playwright install chromium`, or point PLAYWRIGHT_CHROMIUM_PATH at an existing binary.'
    );
    process.exit(1);
  }
  console.log(`browser: ${executablePath}`);

  const tsxCli = path.join(PROJECT_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const server = spawn(process.execPath, [tsxCli, 'server.ts'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  server.stdout.on('data', (chunk) => (serverLog += chunk.toString()));
  server.stderr.on('data', (chunk) => (serverLog += chunk.toString()));

  const browser = await chromium.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const consoleErrors = [];
  const pageErrors = [];
  const badResponses = [];
  /** Bodies of every recon scan the page requested, to prove what ran unprompted. */
  const scanRequests = [];

  try {
    console.log('\n== server ==');
    await waitForServer();
    check('dev server is up', true, `${BASE_URL} (pid ${server.pid})`);

    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    openPages.push({ target: page, label: 'desktop' });
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      consoleErrors.push({ text: msg.text(), url: msg.location()?.url ?? '' });
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
    });
    page.on('request', (request) => {
      if (request.url().includes('/api/recon/scan')) scanRequests.push(request.postData() ?? '');
    });

    console.log('\n== load ==');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.waitForSelector('#nav-tab-recon', { timeout: 60_000 });
    check('app shell rendered', await page.locator('#nav-tab-recon').isVisible());

    console.log('\n== auto-scan on first open of RECON ==');
    await page.click('#nav-tab-recon');
    await page.waitForSelector('text=TACTICAL RECONNAISSANCE', { timeout: 30_000 });
    check('recon panel mounts', true);

    check('favicon is served (no 404 fallback)', !badResponses.some((entry) => entry.includes('favicon')));

    await page.waitForSelector('text=LIVE SCAN OUTPUT // NETWORK-MAP', { timeout: 90_000 });
    check('auto-scan output is rendered', true);

    // Asserted from the request the page made rather than the transient
    // "SCANNING" text, which a fast scan can outrun.
    const automaticScans = scanRequests.filter((body) => body.includes('network-map'));
    check(
      'opening RECON starts a network-map scan without any click',
      automaticScans.length >= 1,
      `${automaticScans.length} automatic scan request(s)`
    );

    await page.locator('[data-testid="recon-panel"] button', { hasText: /^NET MAP/ }).first().click();
    await page.waitForTimeout(300);
    check('topology switched to live discovery', (await page.locator('[data-testid="recon-panel"] >> text=LIVE DISCOVERY').count()) > 0);

    console.log('\n== topology geometry (live) ==');
    checkTopology('live map', await measureTopology());

    console.log('\n== watch list ==');
    const firstStar = page.locator('[data-testid="recon-panel"] [aria-label^="Watch "]').first();
    const starCount = await page.locator('[data-testid="recon-panel"] [aria-label^="Watch "], [data-testid="recon-panel"] [aria-label^="Stop watching "]').count();
    check('every map node has a star control', starCount > 0, `${starCount} controls`);

    const watchedAddress = await firstStar.getAttribute('aria-label');
    await firstStar.click();
    await page.waitForSelector('text=/WATCH LIST \\(1\\/16\\)/', { timeout: 15_000 });
    check('starring a node adds it to the watch list', true, watchedAddress);

    // The first probe fires immediately on mount of the watch list.
    await page
      .locator('text=/PENDING/')
      .first()
      .waitFor({ state: 'detached', timeout: 60_000 })
      .catch(() => {});
    const pendingLeft = await page.locator('text=/PENDING/').count();
    check('watched host is probed promptly (no lingering PENDING)', pendingLeft === 0);
    check('watch list shows a probe result', (await page.locator('text=/NO RESPONSE|tcp/').count()) > 0);

    const haloCount = await page.locator('[data-testid="recon-panel"] [data-testid="watch-halo"]').count();
    check('watched host is marked on the map', haloCount === 1, `${haloCount} halos`);
    check('map legend explains the watch marker', (await page.locator('text=WATCHED').count()) > 0);

    console.log('\n== watch list survives a reload ==');
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('#nav-tab-recon');
    await page.waitForSelector('text=TACTICAL RECONNAISSANCE', { timeout: 30_000 });
    await page.waitForSelector('text=/WATCH LIST \\(1\\/16\\)/', { timeout: 15_000 });
    check('watch list is restored from storage after a reload', true);
    check(
      'the persisted host is still listed',
      (await page.locator('text=192.168.1.1').count()) > 0
    );

    await page.locator('[data-testid="recon-panel"] button[title^="Remove "]').first().click();
    await page.waitForSelector('text=/WATCH LIST \\(0\\/16\\)/', { timeout: 15_000 });
    check('removing a watched host empties the list', true);

    // Clearing must also persist, otherwise the removal comes back on reload.
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('#nav-tab-recon');
    await page.waitForSelector('text=/WATCH LIST \\(0\\/16\\)/', { timeout: 30_000 });
    check('emptying the watch list persists too', true);

    console.log('\n== manual scan ==');
    await page.locator('[data-testid="recon-panel"] button', { hasText: /^PORT MAP/ }).first().click();
    // The card reads "PORT MAP" but the scan id is `port`, so the button says "EXECUTE PORT SCAN".
    const scanButton = page.locator('[data-testid="recon-panel"] button', { hasText: /EXECUTE PORT SCAN/ }).first();
    await scanButton.click();
    // The disabled state lands on the next render, so poll for it rather than
    // sampling the DOM in the same tick as the click.
    const lockedOut = await page
      .waitForFunction(
        () => {
          const button = [...document.querySelectorAll('button')].find((element) =>
            /SCANNING PORT/.test(element.textContent || '')
          );
          return Boolean(button && button.disabled);
        },
        { timeout: 10_000 }
      )
      .then(() => true)
      .catch(() => false);
    check('scan button is disabled while scanning', lockedOut);
    check(
      'scan progress is announced to assistive tech',
      (await page.locator('[role="status"][aria-live="polite"]').count()) > 0
    );

    await page.waitForSelector('text=LIVE SCAN OUTPUT // PORT', { timeout: 90_000 });
    check('busy state clears once the scan finishes', (await page.locator('text=/SCANNING PORT/').count()) === 0);
    check('scan button is usable again', await scanButton.isEnabled());
    check('scan history recorded the scans', (await page.locator('text=/SCAN HISTORY \\([2-9]\\)/').count()) > 0);

    console.log('\n== a narrower scan must not shrink the subnet map ==');
    await page.locator('[data-testid="recon-panel"] button', { hasText: /^NET MAP/ }).first().click();
    await page.waitForTimeout(400);
    const afterNarrowScan = await measureTopology();
    check(
      'port scan leaves the discovered subnet intact',
      (afterNarrowScan?.nodes.length ?? 0) >= 4,
      `${afterNarrowScan?.nodes.length ?? 0} nodes`
    );

    console.log('\n== exports ==');
    const jsonWait = page.waitForEvent('download');
    await page.locator('[data-testid="recon-panel"] button[title="Export scan results as JSON"]').click();
    const jsonDownload = await jsonWait;
    const jsonPath = path.join(os.tmpdir(), `dl-${jsonDownload.suggestedFilename()}`);
    await jsonDownload.saveAs(jsonPath);
    check('json export downloads', /^recon-export-.*\.json$/.test(jsonDownload.suggestedFilename()), jsonDownload.suggestedFilename());

    const reportWait = page.waitForEvent('download');
    await page.locator('[data-testid="recon-panel"] button[title="Export recon report (topology + raw output)"]').click();
    const reportDownload = await reportWait;
    const reportPath = path.join(os.tmpdir(), `dl-${reportDownload.suggestedFilename()}`);
    await reportDownload.saveAs(reportPath);
    check('report export downloads', /^recon-report-.*\.txt$/.test(reportDownload.suggestedFilename()), reportDownload.suggestedFilename());

    const exported = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    check('export carries the discovered subnet', exported.topology?.hosts?.length >= 4, `${exported.topology?.hosts?.length} hosts`);
    check('export carries scan history', exported.history?.length > 0, `${exported.history?.length} entries`);

    const report = fs.readFileSync(reportPath, 'utf8');
    check('report is complete', /HERMES TACTICAL RECON REPORT/.test(report) && /END OF REPORT/.test(report));

    console.log('\n== accessibility ==');
    const a11y = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="recon-panel"]');
      if (!panel) return null;
      const buttons = [...panel.querySelectorAll('button')];
      return {
        buttons: buttons.length,
        unnamed: buttons
          .filter((button) => {
            const name = button.getAttribute('aria-label') || button.textContent?.trim() || button.getAttribute('title');
            return !name;
          })
          .map((button) => button.outerHTML.slice(0, 90)),
        pressed: panel.querySelectorAll('button[aria-pressed]').length,
        decorativeSvgs: [...panel.querySelectorAll('svg')].filter(
          (svg) => svg.getAttribute('aria-hidden') === 'true'
        ).length,
        liveRegion: panel.querySelectorAll('[role="status"][aria-live="polite"]').length,
      };
    });

    if (check('recon panel exposes its controls', a11y && a11y.buttons > 0, `${a11y?.buttons} buttons`)) {
      check('every control has an accessible name', a11y.unnamed.length === 0, a11y.unnamed.join(' | '));
      check('selection state is exposed via aria-pressed', a11y.pressed >= 2, `${a11y.pressed} pressed controls`);
      check('map overlays are hidden from assistive tech', a11y.decorativeSvgs >= 2, `${a11y.decorativeSvgs} hidden svgs`);
    }

    console.log('\n== keyboard activation must not double-fire ==');
    const historyCount = async () => {
      const text = await page.locator('text=/SCAN HISTORY \\(/').first().innerText();
      return Number(/\((\d+)\)/.exec(text)?.[1] ?? 0);
    };

    await page.locator('[data-testid="recon-panel"] button', { hasText: /^PROCESS/ }).first().click();
    await page.locator('[data-testid="recon-panel"] button', { hasText: /EXECUTE PROCESS SCAN/ }).first().focus();
    const beforeKeyboard = await historyCount();
    await page.keyboard.press('Space');
    await page.waitForTimeout(4000);
    const afterKeyboard = await historyCount();
    check(
      'activating the scan button with Space runs exactly one scan',
      afterKeyboard - beforeKeyboard === 1,
      `${beforeKeyboard} -> ${afterKeyboard} scans`
    );

    await page.keyboard.press('Digit4');
    check(
      'numeric shortcuts still switch scan type',
      (await page.locator('[data-testid="recon-panel"] button', { hasText: /EXECUTE NETWORK-MAP SCAN/ }).count()) > 0
    );

    console.log('\n== previously broken tab still renders ==');
    await page.click('#nav-tab-terminus');
    const terminalVisible = await page
      .locator('text=TERMUX // aarch64 MOTO G5')
      .first()
      .isVisible({ timeout: 15_000 })
      .catch(() => false);
    check('TERMUX CLI tab renders its terminal', terminalVisible);

    console.log('\n== other tabs: keyboard operability ==');
    // The channel cards and transition rows are styled containers rather than
    // native buttons, so whether they respond to a keyboard can only be settled
    // in a browser: a click handler is never serialized into markup, which is
    // why test/views.test.tsx can only assert the attributes they advertise.

    /** Every element claiming to be a button must also be focusable. */
    const auditButtonClaims = () =>
      page.evaluate(() => {
        const claimed = [...document.querySelectorAll('[role="button"]')];
        return {
          claimed: claimed.length,
          unfocusable: claimed
            .filter((element) => element.getAttribute('tabindex') !== '0')
            .map((element) => element.outerHTML.slice(0, 80)),
        };
      });

    await page.click('#nav-tab-comms');
    await page.waitForTimeout(800);

    const commsAudit = await auditButtonClaims();
    check('channel cards claim button semantics', commsAudit.claimed >= 3, `${commsAudit.claimed} role=button elements`);
    check(
      'every channel card can take focus',
      commsAudit.unfocusable.length === 0,
      commsAudit.unfocusable.join(' | ')
    );

    const unselectedCards = page.locator('main [role="button"][aria-pressed="false"]');
    if ((await unselectedCards.count()) > 0) {
      // Selection is single-select, so the total pressed count stays at one
      // while it moves. Track the focused card itself rather than the tally.
      const card = unselectedCards.first();
      const cardHandle = await card.elementHandle();
      await card.focus();
      check(
        'a channel card is reachable with the keyboard',
        await page.evaluate(() => document.activeElement?.getAttribute('role') === 'button')
      );

      await page.keyboard.press('Space');
      await page.waitForTimeout(400);
      const pressedState = await cardHandle.evaluate((element) => element.getAttribute('aria-pressed'));
      const selectedTotal = await page.locator('main [role="button"][aria-pressed="true"]').count();
      check('Space selects the focused channel card', pressedState === 'true', `aria-pressed=${pressedState}`);
      check('selection stays single-select', selectedTotal === 1, `${selectedTotal} cards selected`);
    } else {
      console.log('  info  every channel card was already selected; Space path not exercised');
    }

    await page.click('#nav-tab-telemetry');
    await page.waitForTimeout(1200);

    const dashboardAudit = await auditButtonClaims();
    check(
      'every dashboard control claiming to be a button can take focus',
      dashboardAudit.unfocusable.length === 0,
      dashboardAudit.unfocusable.join(' | ')
    );

    const collapsedRows = page.locator('main [role="button"][aria-expanded="false"]');
    if ((await collapsedRows.count()) > 0) {
      await collapsedRows.first().focus();
      const expandedBefore = await page.locator('main [role="button"][aria-expanded="true"]').count();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      const expandedAfter = await page.locator('main [role="button"][aria-expanded="true"]').count();
      check(
        'Enter expands the focused state-transition row',
        expandedAfter === expandedBefore + 1,
        `${expandedBefore} -> ${expandedAfter} expanded`
      );
    } else {
      console.log('  info  no collapsed transition row to exercise');
    }

    console.log('\n== shell: nav and header state ==');
    // aria-current and the toggle states only change on interaction, so they are
    // checked here; the render tests pin the attributes themselves.

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.waitForSelector('#nav-tab-recon', { timeout: 60_000 });

    const currentTabId = () =>
      page.evaluate(() => document.querySelector('[aria-current="page"]')?.id ?? null);

    await page.click('#nav-tab-comms');
    await page.waitForTimeout(400);
    const afterComms = await currentTabId();
    await page.click('#nav-tab-matrix');
    await page.waitForTimeout(400);
    const afterMatrix = await currentTabId();

    check('the dock marks the selected section as current', afterComms === 'nav-tab-comms', String(afterComms));
    check('the current marker follows the selection', afterMatrix === 'nav-tab-matrix', String(afterMatrix));
    const currentCount = await page.locator('[aria-current="page"]').count();
    check('exactly one section is current at a time', currentCount === 1, `${currentCount} marked`);

    const soundButton = page.locator('#btn-toggle-sound');
    const pressedBefore = await soundButton.getAttribute('aria-pressed');
    await soundButton.click();
    await page.waitForTimeout(300);
    const pressedAfter = await soundButton.getAttribute('aria-pressed');
    check(
      'the sound control flips its pressed state',
      pressedBefore !== null && pressedAfter !== null && pressedBefore !== pressedAfter,
      `${pressedBefore} -> ${pressedAfter}`
    );
    await soundButton.click(); // restore audio for the rest of the run
    await page.waitForTimeout(200);

    const heartbeat = page.locator('#tactical-heartbeat-monitor');
    const expandedBefore = await heartbeat.getAttribute('aria-expanded');
    await heartbeat.click();
    await page.waitForTimeout(400);
    const expandedAfter = await heartbeat.getAttribute('aria-expanded');
    const controls = await heartbeat.getAttribute('aria-controls');
    check(
      'the heartbeat monitor flips its expanded state',
      expandedBefore === 'false' && expandedAfter === 'true',
      `${expandedBefore} -> ${expandedAfter}`
    );
    check(
      'the expanded monitor points at the panel it revealed',
      controls === 'heartbeat-diagnostics' && (await page.locator('#heartbeat-diagnostics').count()) === 1,
      String(controls)
    );
    await heartbeat.click(); // collapse it again
    await page.waitForTimeout(300);

    console.log('\n== dialogs: names and labels behind the modals ==');
    // The deploy, hot-swap and create-task forms exist only while their modal is
    // open, so a static render can never reach them. (The voice-directives guide
    // is not covered here: its opener appears only during an active Web Speech
    // session, which headless chromium cannot start.)

    /** Unnamed buttons, unlabeled controls and mouse-only clickables on screen. */
    const auditInteractive = () =>
      page.evaluate(() => {
        const visible = (element) => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && box.height > 0;
        };
        const name = (element) =>
          element.getAttribute('aria-label') ||
          element.getAttribute('aria-labelledby') ||
          element.getAttribute('title') ||
          (element.textContent || '').replace(/\s+/g, ' ').trim();
        const describe = (element) =>
          `${element.tagName.toLowerCase()}${element.id ? '#' + element.id : ''} [${name(element).slice(0, 32)}]`;
        const all = [...document.querySelectorAll('*')].filter(visible);

        const semantic = 'button, a[href], input, select, textarea, label, [role="button"], [tabindex="0"]';
        const mouseOnly = (element) =>
          getComputedStyle(element).cursor === 'pointer' &&
          !element.closest(semantic) &&
          !element.hasAttribute('disabled');

        return {
          unnamed: all.filter((element) => element.tagName === 'BUTTON' && !name(element)).map(describe),
          unlabeled: all
            .filter((element) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName))
            .filter(
              (element) =>
                !element.getAttribute('aria-label') &&
                !element.getAttribute('aria-labelledby') &&
                !element.getAttribute('title') &&
                !element.closest('label') &&
                !(element.id && document.querySelector(`label[for="${CSS.escape(element.id)}"]`))
            )
            .map((element) => `${element.tagName.toLowerCase()}${element.type ? '[' + element.type + ']' : ''}`),
          mouseOnly: all
            .filter(mouseOnly)
            .filter((element) => !(element.parentElement && mouseOnly(element.parentElement)))
            .map(describe),
        };
      });

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.waitForSelector('#nav-tab-recon', { timeout: 60_000 });

    // Guard the guard: a sweep that reports nothing because it is broken looks
    // exactly like a clean page, so prove it flags a known-bad element.
    const cleanBaseline = await auditInteractive();
    await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.id = 'a11y-detector-probe';
      probe.style.cssText = 'cursor:pointer;width:40px;height:20px;position:fixed;top:0;left:0';
      probe.onclick = () => {};
      document.body.appendChild(probe);
    });
    const probed = await auditInteractive();
    check(
      'the interactive sweep detects a known mouse-only control',
      probed.mouseOnly.length === cleanBaseline.mouseOnly.length + 1,
      `${cleanBaseline.mouseOnly.length} -> ${probed.mouseOnly.length} flagged`
    );

    const modals = [
      ['agents', 'button:has-text("DEPLOY NEW AGENT")', 'deploy agent dialog', ['Agent Name', '#deploy-agent-name']],
      ['tasks', 'button:has-text("CREATE AUTONOMOUS TASK")', 'create task dialog', ['Task Directive Title', '#task-title']],
      ['agents', 'button:has-text("CONFIG MODEL")', 'model hot-swap dialog', null],
    ];

    for (const [tab, opener, label, field] of modals) {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 90_000 });
      await page.waitForSelector('#nav-tab-recon', { timeout: 60_000 });
      await page.click(`#nav-tab-${tab}`);
      await page.waitForTimeout(900);

      const trigger = page.locator(opener).first();
      if ((await trigger.count()) === 0) {
        check(`${label} can be opened`, false, `opener ${opener} not found`);
        continue;
      }
      await trigger.click();
      await page.waitForTimeout(800);

      // The close button exists only inside the modal, so finding it proves the
      // dialog actually opened and the checks below are not inspecting a
      // closed page.
      const closeButton = page.locator('button[aria-label^="Close "]');
      check(
        `${label} opens with a named close button`,
        (await closeButton.count()) > 0,
        `${await closeButton.count()} named close button(s)`
      );

      const audit = await auditInteractive();
      check(`${label}: no unnamed buttons`, audit.unnamed.length === 0, audit.unnamed.join(' | '));
      check(`${label}: every field has a label`, audit.unlabeled.length === 0, audit.unlabeled.join(' | '));
      check(`${label}: no mouse-only controls`, audit.mouseOnly.length === 0, audit.mouseOnly.join(' | '));

      if (field) {
        const [labelText, selector] = field;
        check(
          `${label}: fields resolve by their visible label`,
          (await page.getByLabel(labelText, { exact: false }).count()) === 1 &&
            (await page.locator(selector).count()) === 1,
          `getByLabel("${labelText}")`
        );
      }
    }

    console.log('\n== dialog focus ==');
    // The dialogs render as siblings of the shell, so the nav dock and header
    // stay in the tab order while they are open. Whether focus actually stays
    // inside, and comes back afterwards, is only observable in a real browser.

    const focusDialogs = [
      ['agents', 'button:has-text("DEPLOY NEW AGENT")', 'deploy agent dialog'],
      ['tasks', 'button:has-text("CREATE AUTONOMOUS TASK")', 'create task dialog'],
      ['agents', 'button:has-text("CONFIG MODEL")', 'model hot-swap dialog'],
    ];

    for (const [tab, opener, label] of focusDialogs) {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 90_000 });
      await page.waitForSelector('#nav-tab-recon', { timeout: 60_000 });
      await page.click(`#nav-tab-${tab}`);
      await page.waitForTimeout(900);

      const trigger = page.locator(opener).first();
      if ((await trigger.count()) === 0) {
        check(`${label}: focus can be tested`, false, `opener ${opener} not found`);
        continue;
      }

      // Tagged before opening so the element that gets focus back can be
      // identified exactly, rather than by matching its text.
      await trigger.evaluate((element) => element.setAttribute('data-focus-opener', 'yes'));
      await trigger.click();
      await page.waitForTimeout(700);

      const dialog = page.locator('[role="dialog"][aria-modal="true"]');
      const dialogs = await dialog.count();
      check(`${label}: opens as a modal dialog`, dialogs === 1, `${dialogs} modal dialog(s)`);
      if (dialogs !== 1) continue;

      const semantics = await page.evaluate(() => {
        const node = document.querySelector('[role="dialog"][aria-modal="true"]');
        const labelledby = node?.getAttribute('aria-labelledby');
        const named = labelledby ? document.getElementById(labelledby) : null;
        const heading = node?.querySelector('h3');
        const text = (element) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
        return {
          focusable: node?.getAttribute('tabindex') ?? null,
          name: text(named),
          heading: text(heading),
          focusedSelf: node === document.activeElement,
        };
      });

      check(
        `${label}: named by its visible heading`,
        semantics.name !== '' && semantics.name === semantics.heading,
        `aria-labelledby gives "${semantics.name}", heading reads "${semantics.heading}"`
      );
      check(`${label}: is focusable as a container`, semantics.focusable === '-1', `tabindex=${semantics.focusable}`);
      check(
        `${label}: focus moves into the dialog on open`,
        semantics.focusedSelf,
        'the dialog itself holds focus, so it is announced rather than silent'
      );

      const controls = await page
        .locator(
          '[role="dialog"] button:not([disabled]), [role="dialog"] input:not([disabled]), [role="dialog"] select:not([disabled]), [role="dialog"] textarea:not([disabled]), [role="dialog"] a[href]'
        )
        .count();

      // More presses than controls: without a trap, focus reaches the nav dock.
      const escapes = [];
      for (let press = 0; press < controls + 4; press += 1) {
        await page.keyboard.press('Tab');
        const inside = await page.evaluate(() => {
          const node = document.querySelector('[role="dialog"][aria-modal="true"]');
          return Boolean(node?.contains(document.activeElement));
        });
        if (!inside) escapes.push(press + 1);
      }
      check(
        `${label}: Tab never leaves the dialog`,
        escapes.length === 0,
        `${escapes.length} escape(s) out of ${controls + 4} presses on ${controls} controls`
      );

      for (let press = 0; press < controls + 4; press += 1) {
        await page.keyboard.press('Shift+Tab');
      }
      const afterShiftTab = await page.evaluate(() => {
        const node = document.querySelector('[role="dialog"][aria-modal="true"]');
        return Boolean(node?.contains(document.activeElement));
      });
      check(`${label}: Shift+Tab never leaves the dialog`, afterShiftTab, `after ${controls + 4} backwards presses`);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const stillOpen = await page.locator('[role="dialog"]').count();
      check(`${label}: Escape closes it`, stillOpen === 0, `${stillOpen} dialog(s) open after Escape`);

      const restored = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active || active === document.body) return 'nothing (focus fell to the body)';
        const text = (active.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
        return `${active.tagName.toLowerCase()}:${text}${active.getAttribute('data-focus-opener') === 'yes' ? ' (the opener)' : ''}`;
      });
      check(`${label}: focus returns to the button that opened it`, restored.endsWith('(the opener)'), `focus is on ${restored}`);
    }

    console.log('\n== phone viewport ==');
    // The app is mobile-oriented, and a control that is comfortable at 1280px
    // can be a 16px dot on a phone. Swept at 390x844 with touch emulation.

    const phoneTabs = ['command', 'telemetry', 'tasks', 'corrections', 'agents', 'comms', 'tuning', 'terminus', 'recon', 'stylus', 'matrix'];
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    openPages.push({ target: phone, label: 'phone' });

    try {
      await phone.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 90_000 });
      await phone.waitForSelector('#nav-tab-recon', { timeout: 60_000 });
      await phone.waitForTimeout(1200);

      /** Layout health for the current screen at phone width. */
      const phoneSweep = () =>
        phone.evaluate((viewportWidth) => {
          const visible = (element) => {
            const box = element.getBoundingClientRect();
            return box.width > 0 && box.height > 0;
          };
          const inScroller = (element) => {
            for (let node = element.parentElement; node; node = node.parentElement) {
              const overflowX = getComputedStyle(node).overflowX;
              if (overflowX === 'auto' || overflowX === 'scroll') return true;
            }
            return false;
          };
          const all = [...document.querySelectorAll('*')].filter(visible);

          const overflowing = all
            .filter((element) => !inScroller(element))
            .filter((element) => {
              const box = element.getBoundingClientRect();
              return box.right > viewportWidth + 1 || box.left < -1;
            }).length;

          // A control inside its <label> is tapped through the label.
          const targets = [
            ...new Set(
              all
                .filter((element) => ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName))
                .map((element) => element.closest('label') ?? element)
            ),
          ];
          const small = targets
            .filter((element) => {
              const box = element.getBoundingClientRect();
              return box.height < 24 || box.width < 24;
            })
            .map((element) => {
              const box = element.getBoundingClientRect();
              return `${element.tagName.toLowerCase()}${element.id ? '#' + element.id : ''} ${Math.round(box.width)}x${Math.round(box.height)}`;
            });

          const doc = document.documentElement;
          return {
            sideways: doc.scrollWidth > doc.clientWidth ? `${doc.scrollWidth} > ${doc.clientWidth}` : null,
            overflowing,
            small,
          };
        }, 390);

      const sideways = [];
      const overflowed = [];
      const undersized = [];
      for (const tab of phoneTabs) {
        await phone.click(`#nav-tab-${tab}`);
        await phone.waitForTimeout(700);
        const result = await phoneSweep();
        if (result.sideways) sideways.push(`${tab}: ${result.sideways}`);
        if (result.overflowing > 0) overflowed.push(`${tab}: ${result.overflowing} element(s)`);
        result.small.forEach((entry) => undersized.push(`${tab}: ${entry}`));
      }

      check('no tab scrolls sideways at 390px', sideways.length === 0, sideways.join(' | '));
      check('no tab overflows the phone viewport', overflowed.length === 0, overflowed.join(' | '));
      check(
        'every control is at least 24px on a phone',
        undersized.length === 0,
        undersized.slice(0, 4).join(' | ')
      );

      // The dialogs hold the densest forms in the app, so they get the same sweep.
      const phoneDialogs = [
        ['agents', 'button:has-text("DEPLOY NEW AGENT")', 'deploy dialog'],
        ['tasks', 'button:has-text("CREATE AUTONOMOUS TASK")', 'create task dialog'],
        ['agents', 'button:has-text("CONFIG MODEL")', 'model hot-swap dialog'],
      ];
      const dialogProblems = [];
      for (const [tab, opener, label] of phoneDialogs) {
        await phone.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 90_000 });
        await phone.waitForSelector('#nav-tab-recon', { timeout: 60_000 });
        await phone.click(`#nav-tab-${tab}`);
        await phone.waitForTimeout(800);
        const trigger = phone.locator(opener).first();
        if ((await trigger.count()) === 0) {
          dialogProblems.push(`${label}: opener not found`);
          continue;
        }
        await trigger.click();
        await phone.waitForTimeout(700);
        const result = await phoneSweep();
        if (result.sideways) dialogProblems.push(`${label} scrolls sideways`);
        if (result.overflowing > 0) dialogProblems.push(`${label}: ${result.overflowing} overflowing`);
        result.small.forEach((entry) => dialogProblems.push(`${label}: ${entry}`));
      }
      check(
        'the dialogs fit a phone and stay tappable',
        dialogProblems.length === 0,
        dialogProblems.slice(0, 4).join(' | ')
      );

      await phone.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 90_000 });
      await phone.waitForSelector('#nav-tab-recon', { timeout: 60_000 });
      await phone.click('#nav-tab-tuning');
      await phone.waitForTimeout(700);
      const slider = await phone.evaluate(() => {
        const element = document.querySelector('main input[type="range"]');
        if (!element) return null;
        const style = getComputedStyle(element);
        return {
          box: Math.round(element.getBoundingClientRect().height),
          track: Math.round(
            element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
          ),
          clip: style.backgroundClip,
        };
      });
      check('the tuning sliders are tappable', Boolean(slider) && slider.box >= 24, `${slider?.box}px tall`);
      check(
        'but their track stays thin',
        Boolean(slider) && slider.track <= 8 && slider.clip === 'content-box',
        `track ${slider?.track}px, clip ${slider?.clip}`
      );
    } finally {
      // Settle a capture triggered by a phone failure before this page goes away.
      if (pendingCapture) await pendingCapture.catch(() => {});
      await phone.close().catch(() => {});
    }

    console.log('\n== console health ==');
    check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));

    const failedApi = badResponses.filter((entry) => entry.includes('/api/'));
    check('no failed API requests', failedApi.length === 0, failedApi.join(' | '));

    // Anything the browser could not load that is not part of the API surface is
    // reported with its URL rather than silently swallowed.
    const failedAssets = badResponses.filter((entry) => !entry.includes('/api/'));
    if (failedAssets.length > 0) {
      console.log(`  info  non-API resource failures: ${failedAssets.join(' | ')}`);
    }

    const formatError = (entry) => `${entry.text}${entry.url ? ` @ ${entry.url}` : ''}`;
    const apiConsoleErrors = consoleErrors.filter((entry) => entry.url.includes('/api/'));
    check('no API console errors', apiConsoleErrors.length === 0, apiConsoleErrors.slice(0, 2).map(formatError).join(' | '));

    const otherConsoleErrors = consoleErrors.filter((entry) => !entry.url.includes('/api/'));
    if (otherConsoleErrors.length > 0) {
      console.log(`  info  browser noise (not API): ${otherConsoleErrors.slice(0, 4).map(formatError).join(' | ')}`);
    }
  } catch (error) {
    failures.push(`harness error: ${error.message}`);
    console.error(`\nharness error: ${error.message}`);
    if (page) await captureFailureArtifacts('harness-error');
    if (serverLog) console.error('--- server log ---\n' + serverLog.slice(-2000));
  } finally {
    // A capture started by a failed check has to finish before the browser goes
    // away, or the upload step in CI would find an empty directory.
    if (pendingCapture) await pendingCapture.catch(() => {});
    await browser.close().catch(() => {});
    server.kill('SIGTERM');
  }

  console.log('\n================ SUMMARY ================');
  console.log(`checks failed: ${failures.length}`);
  for (const failure of failures) console.log(`  - ${failure}`);
  if (consoleErrors.length) {
    console.log(`console errors:\n  ${consoleErrors.map((e) => `${e.text}${e.url ? ` @ ${e.url}` : ''}`).join('\n  ')}`);
  }
  process.exit(failures.length === 0 ? 0 : 1);
}

await main();
