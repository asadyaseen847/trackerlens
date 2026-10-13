/**
 * Copy text to the clipboard. If the browser refuses (permissions, http, old browser), select
 * the fallback element's text so the user can press Ctrl+C, as in the prototype.
 */
export async function copyText(
  text: string,
  fallbackEl?: HTMLElement | null,
): Promise<'copied' | 'selected'> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    if (fallbackEl) {
      const range = document.createRange();
      range.selectNodeContents(fallbackEl);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    return 'selected';
  }
}

export const COPY_MESSAGES = {
  copied: 'Copied',
  selected: 'Selected. Press Ctrl+C (or ⌘C) to copy.',
} as const;
