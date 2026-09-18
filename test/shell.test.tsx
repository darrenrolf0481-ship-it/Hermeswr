// Render contract for the app shell: the top header and the bottom nav dock.
//
// These two frame every tab, so a name or an unexposed state here is invisible
// in the tab suites and easy to miss by eye. Everything asserted below is an
// attribute, which is all serialized markup can carry; the state changes they
// describe are exercised in a real browser by test/browser/reconMap.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { NavigationDock } from '../src/components/NavigationDock';
import { TacticalHeader } from '../src/components/TacticalHeader';
import { unnamedButtons, unnamedControls } from './a11y-helpers';
import { telemetry } from './fixtures';

const noop = () => {};

/** Renders to static markup, failing with the component name if it throws. */
function render(name: string, element: React.ReactElement): string {
  try {
    return renderToStaticMarkup(element);
  } catch (error) {
    assert.fail(`${name} threw during render: ${(error as Error).message}`);
  }
}

function dock(props: Partial<React.ComponentProps<typeof NavigationDock>> = {}): string {
  return render('NavigationDock', <NavigationDock activeTab="recon" onSelectTab={noop} {...props} />);
}

function header(props: Partial<React.ComponentProps<typeof TacticalHeader>> = {}): string {
  return render(
    'TacticalHeader',
    <TacticalHeader
      agentState="IDLE"
      telemetry={telemetry}
      soundEnabled
      onToggleSound={noop}
      onEmergencyStop={noop}
      activeModelName="Hermes-3-Alpha"
      {...props}
    />
  );
}

/** The serialized opening tag of a single element, for attribute assertions. */
function tagOf(html: string, marker: string): string {
  const match = new RegExp(`<[a-z][^>]*${marker}[^>]*>`).exec(html);
  return match?.[0] ?? '';
}

test('the dock names its landmark and marks exactly one active section', () => {
  const html = dock();
  assert.match(html, /<nav[^>]*aria-label="War room sections"/, 'the nav landmark needs a name');

  const current = [...html.matchAll(/aria-current="page"/g)];
  assert.equal(current.length, 1, 'exactly one section may be current');
  assert.match(tagOf(html, 'aria-current="page"'), /id="nav-tab-recon"/, 'the current section must be the selected one');
});

test('the active section follows the prop', () => {
  for (const tab of ['command', 'telemetry', 'matrix'] as const) {
    const html = dock({ activeTab: tab });
    assert.match(tagOf(html, 'aria-current="page"'), new RegExp(`id="nav-tab-${tab}"`), `${tab} should be current`);
    assert.equal(
      [...html.matchAll(/aria-current="page"/g)].length,
      1,
      `selecting ${tab} must not leave another section current`
    );
  }
});

test('a badge is announced with the tab, not glued to its label', () => {
  const html = dock({ pendingCorrectionsCount: 3 });
  // Without an explicit name the sibling badge span would be read as part of
  // the label, which is how this used to announce as "3CORRECTIONS".
  assert.match(html, /aria-label="CORRECTIONS, 3 pending"/);
  assert.match(html, /CORRECTIONS<\/span>/, 'the visible label must be unchanged');
});

test('a tab with no badge keeps its visible text as the name', () => {
  const html = dock({ activeTab: 'tasks' });
  const tag = tagOf(html, 'id="nav-tab-tasks"');
  assert.ok(tag.length > 0, 'the tasks tab should render');
  assert.ok(!/aria-label=/.test(tag), 'no badge means the visible text already names it');
});

test('every dock section is a named, labeled control', () => {
  const html = dock({ unreadLogsCount: 2, pendingCorrectionsCount: 1 });
  assert.equal(unnamedButtons(html).length, 0, unnamedButtons(html).join(' | '));
  assert.equal(unnamedControls(html).length, 0, unnamedControls(html).join(' | '));
  assert.equal([...html.matchAll(/<button/g)].length, 11, 'every section should be reachable');
});

test('the sound control exposes whether audio is on', () => {
  assert.match(
    header({ soundEnabled: true }),
    /aria-label="War room audio" aria-pressed="true"/,
    'audio on must be exposed as pressed'
  );
  assert.match(
    header({ soundEnabled: false }),
    /aria-label="War room audio" aria-pressed="false"/,
    'audio off must be exposed as not pressed'
  );
});

test('the heartbeat monitor reports its state and what it controls', () => {
  const html = header();
  assert.match(html, /aria-expanded="false"/, 'the collapsed panel must say so');
  assert.ok(
    !/aria-controls=/.test(html),
    'a collapsed panel should not be referenced while it is absent'
  );

  const label = /aria-label="Hermes heartbeat monitor[^"]*"/.exec(html)?.[0] ?? '';
  assert.match(label, /\d+ BPM/, 'the name should carry the reading, not just the widget name');
});

test('the emergency stop is named even where its visible text is hidden', () => {
  const html = header();
  assert.match(html, /aria-label="Abort all agents"/);
  // The visible label is display:none below the sm breakpoint, so the name
  // cannot be allowed to depend on it.
  assert.match(html, /class="hidden sm:inline">ABORT</);
});

test('every header control is named', () => {
  const html = header({ isProcessing: true, activeTasksCount: 2 });
  assert.equal(unnamedButtons(html).length, 0, unnamedButtons(html).join(' | '));
  assert.equal(unnamedControls(html).length, 0, unnamedControls(html).join(' | '));
});
