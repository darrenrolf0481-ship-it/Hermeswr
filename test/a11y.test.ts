// Unit tests for the shared keyboard-activation helper.
//
// Static markup can show that a control advertises itself as a button, but not
// that the advertised keys actually do anything — so the behaviour is pinned
// down here, away from React.

import test from 'node:test';
import assert from 'node:assert/strict';

import { activationKeyDown, nextFocusIndex, isActivationKey } from '../src/utils/a11y';

/** A structural stand-in for the parts of a KeyboardEvent the helper reads. */
function keyEvent(key: string) {
  let prevented = 0;
  return {
    key,
    preventDefault: () => {
      prevented += 1;
    },
    get preventedTimes() {
      return prevented;
    },
  };
}

test('isActivationKey accepts exactly the keys that activate a button', () => {
  for (const key of ['Enter', ' ', 'Spacebar']) {
    assert.equal(isActivationKey(key), true, `${JSON.stringify(key)} should activate`);
  }
  for (const key of ['a', 'Tab', 'Escape', 'ArrowDown', 'Shift', 'enter']) {
    assert.equal(isActivationKey(key), false, `${JSON.stringify(key)} should not activate`);
  }
});

test('activationKeyDown runs the handler for Enter and Space', () => {
  for (const key of ['Enter', ' ', 'Spacebar']) {
    let calls = 0;
    const handler = activationKeyDown(() => {
      calls += 1;
    });

    handler(keyEvent(key));
    assert.equal(calls, 1, `${JSON.stringify(key)} should activate once`);
  }
});

test('activationKeyDown ignores keys that are not activation keys', () => {
  let calls = 0;
  const handler = activationKeyDown(() => {
    calls += 1;
  });

  for (const key of ['a', 'Tab', 'Escape', 'ArrowDown']) handler(keyEvent(key));
  assert.equal(calls, 0, 'no non-activation key may trigger the control');
});

test('activationKeyDown suppresses the default for Space but not Enter', () => {
  const space = keyEvent(' ');
  activationKeyDown(() => {})(space);
  assert.equal(space.preventedTimes, 1, 'Space must not scroll the page');

  const enter = keyEvent('Enter');
  activationKeyDown(() => {})(enter);
  assert.equal(enter.preventedTimes, 0, 'Enter must stay available to a surrounding form');
});

test('activationKeyDown forwards every key to an external handler', () => {
  const seen: string[] = [];
  const handler = activationKeyDown(
    () => {},
    (event) => seen.push(event.key)
  );

  handler(keyEvent('a'));
  handler(keyEvent('Enter'));
  handler(keyEvent('Tab'));

  assert.deepEqual(seen, ['a', 'Enter', 'Tab'], 'the external handler sees all keys, in order');
});

test('activationKeyDown activates only once per event', () => {
  let calls = 0;
  const handler = activationKeyDown(() => {
    calls += 1;
  });

  handler(keyEvent('Enter'));
  handler(keyEvent('Spacebar'));

  assert.equal(calls, 2, 'one activation per event, not per key press batch');
});

// The dialog Tab loop. This is the rule that decides whether a modal keeps the
// keyboard inside it, so it is checked as arithmetic rather than observed
// indirectly through a browser.

test('nextFocusIndex steps forward and backward without wrapping early', () => {
  assert.equal(nextFocusIndex(3, 0, false), 1);
  assert.equal(nextFocusIndex(3, 1, false), 2);
  assert.equal(nextFocusIndex(3, 1, true), 0);
  assert.equal(nextFocusIndex(3, 2, true), 1);
});

test('nextFocusIndex wraps at both ends so the dialog is a closed loop', () => {
  assert.equal(nextFocusIndex(3, 2, false), 0, 'Tab on the last control returns to the first');
  assert.equal(nextFocusIndex(3, 0, true), 2, 'Shift+Tab on the first control goes to the last');
});

test('nextFocusIndex enters at the front for Tab and the back for Shift+Tab', () => {
  const outside = -1;
  assert.equal(nextFocusIndex(3, outside, false), 0);
  assert.equal(nextFocusIndex(3, outside, true), 2);
});

test('nextFocusIndex handles a dialog with a single control', () => {
  assert.equal(nextFocusIndex(1, 0, false), 0, 'Tab stays on it');
  assert.equal(nextFocusIndex(1, 0, true), 0, 'Shift+Tab stays on it');
});

test('nextFocusIndex reports nothing to focus instead of guessing', () => {
  assert.equal(nextFocusIndex(0, -1, false), null);
  assert.equal(nextFocusIndex(0, 0, true), null);
});

test('nextFocusIndex always returns a usable index for any real dialog', () => {
  for (let count = 1; count <= 12; count += 1) {
    for (let current = -1; current < count; current += 1) {
      for (const shift of [false, true]) {
        const index = nextFocusIndex(count, current, shift);
        assert.equal(typeof index, 'number', `count=${count} current=${current} shift=${shift}`);
        assert.ok(
          index !== null && index >= 0 && index < count,
          `index ${index} must land inside ${count} controls (current=${current} shift=${shift})`
        );
      }
    }
  }
});
