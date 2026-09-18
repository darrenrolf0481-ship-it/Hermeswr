// Unit tests for the shared keyboard-activation helper.
//
// Static markup can show that a control advertises itself as a button, but not
// that the advertised keys actually do anything — so the behaviour is pinned
// down here, away from React.

import test from 'node:test';
import assert from 'node:assert/strict';

import { activationKeyDown, isActivationKey } from '../src/utils/a11y';

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
