# Contributing

The README is the reference for how this project is built, tested and
committed to. This page is the short version to read before opening a pull
request.

## Setup

Node 22 or newer — `.nvmrc` pins the version (`nvm use`) and `package.json`
enforces the floor with `engines`. Use **npm**: `package-lock.json` is the only
lockfile. See *Package manager* in the README before reaching for bun.

```bash
npm ci        # install exactly what the lockfile pins
npm run dev   # Express + Vite on http://localhost:3000
```

## Before you push

Run the steps CI runs, in the order CI runs them:

```bash
npm run lint          # tsc --noEmit, including test/
npm test              # unit + integration
npm run build         # SPA assets + bundled server
npm run test:browser  # real chromium
```

The browser check needs chromium once: `npx playwright install chromium`.

## Adding tests

Use the lowest layer that can actually observe the behaviour. The *Testing*
section of the README lists the existing files; this is what each layer can and
cannot see.

| Layer | Use it for | Cannot see |
| --- | --- | --- |
| `test/*.test.ts` | Pure logic: parsing, geometry, persistence, export shape | Anything React renders |
| `test/*.test.tsx` | Render contracts through `react-dom/server` | `onClick` / `onKeyDown` (never serialized), controls inside collapsed panels or modals, layout |
| `test/reconEndpoint.test.ts` | The HTTP contract, against a real server process | Client behaviour |
| `test/browser/reconMap.mjs` | Layout, focus, keyboard activation, accessible names, downloads | Nothing — it is just the slowest |

Two habits worth keeping:

- **A test that cannot fail is worth nothing.** Break the behaviour it covers,
  confirm it goes red, then restore. Reverting with `git checkout` is not enough
  when the file is untracked, so verify the restore actually happened.
- **Guard the guard.** When a test asserts an invariant through a helper (for
  example `unnamedControls` in `test/views.test.tsx`), give the helper its own
  case that must fail, so a broken helper cannot make the invariant pass
  vacuously.

## Commits

Follow *Commits* in the README: one logical change per commit, an imperative
subject of roughly 72 characters, and a body explaining **why**. Keep dependency
or formatting churn in its own commit, and land a fix in its own commit before
the feature that depends on it.

If a commit has to touch an existing file for two unrelated reasons, that is
usually two commits — stage them separately rather than bundling.

## Reporting what is real

Several panels in this app are simulated, and one endpoint parses commands it
never executes. The README's *What is real vs. simulated* section has the exact
list. Do not present simulated output as a measurement — in the UI, a commit
message, or a pull request description.

## Accessibility

Treat this as part of the contract:

- Every form control needs an accessible name — `aria-label`, `aria-labelledby`,
  an associated `<label for>`, or a wrapping `<label>`.
- Anything that behaves like a button but cannot be a native `<button>` (a card,
  a row) needs `role="button"`, `tabIndex={0}`, the state it toggles
  (`aria-pressed` / `aria-expanded`), and a key handler built with
  `activationKeyDown` from `src/utils/a11y.ts` so Enter and Space both work.
- Decorative icons and SVG overlays are `aria-hidden`.
- A modal dialog carries `role="dialog"`, `aria-modal="true"`, an
  `aria-labelledby` pointing at its heading, `tabIndex={-1}` on the panel, and
  `useDialogFocus` from `src/hooks/useDialogFocus.ts`. Dialogs render as siblings
  of the shell, so without that hook the nav dock stays in the tab order and Tab
  walks straight out of a dialog that only *looks* modal.

`test/views.test.tsx` enforces the first two points across every tab, the same
helpers in `test/a11y-helpers.ts` cover the header and nav dock in
`test/shell.test.tsx`, and `test/browser/reconMap.mjs` proves the keys actually
work and opens each modal dialog to audit the forms inside — those do not exist
in markup until they are opened, so a static render can never see them.

Both suites were added after an audit found three selectable-card elements that
were mouse-only, 23 default-rendered form controls with no accessible name, and
four icon-only modal close buttons with no name.
