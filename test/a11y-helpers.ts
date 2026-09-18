// Accessibility assertions that inspect serialized markup.
//
// Markup can show what a control *advertises* — its name and whether it claims
// to be a button — but never a click or key handler, because React does not
// serialize those. So these helpers check the attributes a control must carry,
// while the behaviour they imply is pinned in test/a11y.test.ts and exercised
// against a real browser by test/browser/reconMap.mjs.

/** True when the control at `index` sits inside a wrapping <label>. */
export function insideLabel(html: string, index: number): boolean {
  const before = html.slice(0, index);
  return before.lastIndexOf('<label') > before.lastIndexOf('</label>');
}

/** Controls that would reach a screen reader with no name at all. */
export function unnamedControls(html: string): string[] {
  const labelFor = new Set([...html.matchAll(/<label\b[^>]*\sfor="([^"]+)"/g)].map((match) => match[1]));
  const issues: string[] = [];

  for (const match of html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const attrs = match[2] ?? '';
    if (/\baria-lab(?:el|elledby)=/.test(attrs)) continue;
    const id = /\bid="([^"]+)"/.exec(attrs)?.[1];
    if (id && labelFor.has(id)) continue;
    if (insideLabel(html, match.index ?? 0)) continue;
    issues.push(`<${match[1]} ${attrs.trim().slice(0, 80)}>`);
  }

  return issues;
}

/** Elements that claim to be buttons but cannot take focus. */
export function unfocusableButtons(html: string): string[] {
  return [...html.matchAll(/<[a-z][\w-]*\b[^>]*\brole="button"[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => !/\btabindex="0"/.test(tag))
    .map((tag) => tag.slice(0, 90));
}

/** Focusable elements that claim to be buttons. */
export function keyboardButtons(html: string): string[] {
  return [...html.matchAll(/<[a-z][\w-]*\b[^>]*\brole="button"[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => /\btabindex="0"/.test(tag));
}

/** Buttons whose accessible name is missing, empty, or only whitespace. */
export function unnamedButtons(html: string): string[] {
  const issues: string[] = [];

  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const attrs = match[1] ?? '';
    if (/\baria-label(?:ledby)?=/.test(attrs) || /\btitle=/.test(attrs)) continue;
    const text = match[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (!text) issues.push(`<button ${attrs.trim().slice(0, 80)}>`);
  }

  return issues;
}
