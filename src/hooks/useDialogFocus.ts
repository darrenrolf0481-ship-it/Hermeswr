import { useEffect, useRef, type RefObject } from 'react';
import { FOCUSABLE_SELECTOR, nextFocusIndex } from '../utils/a11y';

/**
 * Keeps keyboard focus inside a modal dialog, and gives it back when the dialog
 * closes.
 *
 * Attach the returned ref to the dialog *panel* (the bordered card, not the
 * backdrop): it is focused on open so the dialog is announced, it is the
 * boundary the Tab loop is measured against, and it should carry
 * `tabIndex={-1}` to be focusable at all.
 *
 * The three behaviours this adds, none of which a dialog gets for free:
 *
 * - **Focus moves in.** Otherwise focus stays on whichever button opened the
 *   dialog and the first Tab walks into the UI behind it.
 * - **Tab loops.** The nav dock and header are mounted siblings, so without this
 *   Tab reaches them and the dialog is only visually modal.
 * - **Focus comes back.** On close the element that opened the dialog is focused
 *   again, so the operator is not dumped at the top of the document.
 *
 * `onClose` is held in a ref rather than a dependency so that an inline arrow —
 * how every caller writes it — cannot re-run the effect and re-focus the dialog
 * mid-typing.
 */
export function useDialogFocus<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const node = ref.current;
    if (!open || !node) return;

    // Captured before focus moves, so it can be handed back on unmount.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Rendered but not visible elements (a collapsed section, a hidden field)
    // must not join the loop, or Tab would appear to do nothing.
    const tabbable = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.getClientRects().length > 0,
      );

    node.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = tabbable();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const target = nextFocusIndex(items.length, current, event.shiftKey);
      if (target === null) return;

      // Claimed before moving focus, so the browser's own tab order — which
      // would leave the dialog — never runs.
      event.preventDefault();
      items[target].focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      opener?.focus();
    };
  }, [open]);

  return ref;
}
