const MAX_OUTPUT_BYTES = 15_000;
const MAX_TEXT_LENGTH = 50;
const GRANDHELPER_HOST_CLASS = 'grandhelper-panel';

const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'textarea',
  'select',
  '[role="button"]',
  '[onclick]',
  '[tabindex]',
].join(',');

function isVisible(el: HTMLElement): boolean {
  if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') {
    return false;
  }
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }
  return true;
}

function isInsideGrandHelperPanel(el: HTMLElement): boolean {
  let current: Node | null = el;
  while (current) {
    if (current instanceof HTMLElement) {
      if (current.classList.contains(GRANDHELPER_HOST_CLASS)) {
        return true;
      }
      // Check if inside a shadow DOM host that is our panel
      if (current.getRootNode() instanceof ShadowRoot) {
        const host = (current.getRootNode() as ShadowRoot).host as HTMLElement;
        if (host.classList.contains(GRANDHELPER_HOST_CLASS)) {
          return true;
        }
      }
    }
    current = current.parentNode;
  }
  return false;
}

function truncate(text: string, maxLen: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 1) + '\u2026';
}

function shortenHref(href: string | null): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, window.location.href);
    const path = url.pathname + url.search;
    return truncate(path, 60);
  } catch {
    return truncate(href, 60);
  }
}

function serializeElement(el: HTMLElement, ghId: number): string {
  const tag = el.tagName.toLowerCase();
  const parts: string[] = [`ghId=${ghId}`, `tag=${tag}`];

  const type = el.getAttribute('type');
  if (type) parts.push(`type=${type}`);

  const name = el.getAttribute('name');
  if (name) parts.push(`name="${truncate(name, 30)}"`);

  const placeholder = el.getAttribute('placeholder');
  if (placeholder) parts.push(`placeholder="${truncate(placeholder, 40)}"`);

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) parts.push(`aria-label="${truncate(ariaLabel, 40)}"`);

  const value = (el as HTMLInputElement).value;
  if (value && tag === 'input') parts.push(`value="${truncate(value, 30)}"`);

  const href = el.getAttribute('href');
  const shortened = shortenHref(href);
  if (shortened) parts.push(`href="${shortened}"`);

  const textContent = el.textContent || '';
  const text = truncate(textContent, MAX_TEXT_LENGTH);
  if (text) parts.push(`text="${text}"`);

  return `[${parts.join(' ')}]`;
}

export function serializeDOM(): string {
  const elements = document.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR);
  const lines: string[] = [];
  let totalSize = 0;
  let ghId = 0;

  for (const el of elements) {
    if (!isVisible(el)) continue;
    if (isInsideGrandHelperPanel(el)) continue;

    ghId++;
    el.setAttribute('data-gh-id', String(ghId));

    const line = serializeElement(el, ghId);
    const lineSize = new TextEncoder().encode(line + '\n').length;

    if (totalSize + lineSize > MAX_OUTPUT_BYTES) break;

    lines.push(line);
    totalSize += lineSize;
  }

  return lines.join('\n');
}
