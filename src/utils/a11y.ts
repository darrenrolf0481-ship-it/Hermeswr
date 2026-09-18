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
