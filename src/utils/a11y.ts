// Keyboard activation for controls that cannot be a native <button>.
//
// Several views render selectable cards as styled containers. A click handler
// alone makes them invisible to the keyboard, so those elements carry
// role="button" + tabIndex={0} and use this handler to respond to the keys a
// real button would: Enter and Space.

/** The slice of a KeyboardEvent this needs, so it stays DOM-free and testable. */
export interface ActivationKeyEvent {
  key: string;
  preventDefault: () => void;
}

/** Keys that activate a button. Space arrives as ' ' in every browser. */
export function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ' || key === 'Spacebar';
}

/**
 * Returns an onKeyDown handler that runs `onActivate` for Enter and Space.
 *
 * Space is prevented from its default (page scroll) because the element is
 * acting as a button; Enter is left alone so it can still submit a surrounding
 * form when the control legitimately sits inside one.
 */
export function activationKeyDown(onActivate: () => void, onKeyDown?: (event: ActivationKeyEvent) => void) {
  return (event: ActivationKeyEvent): void => {
    onKeyDown?.(event);
    if (!isActivationKey(event.key)) return;
    if (event.key !== 'Enter') event.preventDefault();
    onActivate();
  };
}

// Focus containment for modal dialogs.
//
// The dialogs in this app are rendered as siblings of the shell, not inside it,
// so while one is open the nav dock and header are still in the tab order and
// Tab walks straight out of the dialog into the UI behind it. These two pieces
// keep focus inside: a selector for what counts as tabbable, and the arithmetic
// of where Tab and Shift+Tab land once the ends wrap around.

/** The elements a dialog is willing to hand focus to, in DOM order. */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

/**
 * Where focus goes when Tab (`shift` false) or Shift+Tab (`shift` true) is
 * pressed, given the number of tabbable elements in the dialog and the index of
 * the one currently focused.
 *
 * Wraps at both ends so the dialog is a closed loop, and returns null when there
 * is nothing to focus at all — the caller should then leave the event alone
 * rather than swallow it. A `current` of -1 means focus is outside the list (for
 * instance on the dialog container itself): Tab enters at the front, Shift+Tab
 * at the back.
 */
export function nextFocusIndex(count: number, current: number, shift: boolean): number | null {
  if (count <= 0) return null;
  if (current < 0) return shift ? count - 1 : 0;
  return (current + (shift ? -1 : 1) + count) % count;
}
