// Overlay module for highlighting UI elements with step badges and tooltips

export interface OverlayStep {
  ghId: number;
  action: string;
  description: string;
}

let activeOverlayElements: HTMLElement[] = [];
let clearTimer: ReturnType<typeof setTimeout> | null = null;
let stylesInjected = false;

/**
 * Inject overlay CSS classes into the page if not already present.
 */
function injectStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes gh-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.6); }
      50%  { box-shadow: 0 0 0 10px rgba(76, 175, 80, 0); }
      100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
    }

    .gh-highlight {
      outline: 3px solid #0891B2 !important;
      outline-offset: 2px !important;
      animation: gh-pulse 1.5s ease-in-out infinite !important;
      position: relative !important;
    }

    .gh-step-badge {
      position: absolute !important;
      top: -14px !important;
      right: -14px !important;
      width: 36px !important;
      height: 36px !important;
      background: #0891B2 !important;
      color: #fff !important;
      border-radius: 50% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 18px !important;
      font-weight: bold !important;
      z-index: 2147483646 !important;
      pointer-events: none !important;
      font-family: Arial, sans-serif !important;
      line-height: 1 !important;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important;
    }

    .gh-tooltip {
      position: absolute !important;
      left: 0 !important;
      top: 100% !important;
      margin-top: 8px !important;
      background: #fff !important;
      color: #333 !important;
      font-size: 20px !important;
      font-family: Arial, sans-serif !important;
      padding: 12px 16px !important;
      border-radius: 10px !important;
      box-shadow: 0 4px 16px rgba(0,0,0,0.18) !important;
      max-width: 300px !important;
      z-index: 2147483646 !important;
      pointer-events: none !important;
      white-space: normal !important;
      line-height: 1.4 !important;
    }

    .gh-fallback-message {
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      background: #fff !important;
      color: #333 !important;
      font-size: 24px !important;
      font-family: Arial, sans-serif !important;
      padding: 32px 40px !important;
      border-radius: 16px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2) !important;
      z-index: 2147483647 !important;
      text-align: center !important;
      max-width: 500px !important;
      line-height: 1.5 !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Show visual overlay for each step: pulsing border, numbered badge, tooltip.
 * Elements are found by their `data-gh-id` attribute.
 * Auto-clears after 15 seconds.
 */
export function showOverlay(steps: OverlayStep[]): void {
  clearOverlay();
  injectStyles();

  let firstElement: HTMLElement | null = null;

  steps.forEach((step, index) => {
    const el = document.querySelector<HTMLElement>(`[data-gh-id="${step.ghId}"]`);
    if (!el) return;

    // Ensure positioned parent for badge/tooltip placement
    const computedPos = window.getComputedStyle(el).position;
    if (computedPos === 'static') {
      el.style.position = 'relative';
      el.dataset.ghResetPosition = 'true';
    }

    // Add pulsing highlight
    el.classList.add('gh-highlight');

    // Step badge
    const badge = document.createElement('div');
    badge.className = 'gh-step-badge';
    badge.textContent = String(index + 1);
    el.appendChild(badge);

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'gh-tooltip';
    tooltip.textContent = step.description;
    el.appendChild(tooltip);

    activeOverlayElements.push(el);

    if (!firstElement) {
      firstElement = el;
    }
  });

  // Scroll first highlighted element into view
  if (firstElement) {
    (firstElement as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Auto-clear after 15 seconds
  clearTimer = setTimeout(() => {
    clearOverlay();
  }, 15000);
}

/**
 * Remove all overlay decorations from the page.
 */
export function clearOverlay(): void {
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }

  activeOverlayElements.forEach((el) => {
    el.classList.remove('gh-highlight');

    // Remove badges and tooltips
    el.querySelectorAll('.gh-step-badge, .gh-tooltip').forEach((child) => {
      child.remove();
    });

    // Reset position if we changed it
    if (el.dataset.ghResetPosition === 'true') {
      el.style.position = '';
      delete el.dataset.ghResetPosition;
    }
  });

  activeOverlayElements = [];

  // Also remove any fallback messages
  document.querySelectorAll('.gh-fallback-message').forEach((el) => el.remove());
}

/**
 * Show a floating fallback message when no elements can be highlighted.
 */
export function showFallbackMessage(message: string): void {
  injectStyles();

  const msgEl = document.createElement('div');
  msgEl.className = 'gh-fallback-message';
  msgEl.textContent = message;
  document.body.appendChild(msgEl);

  activeOverlayElements.push(msgEl);

  // Auto-remove after 15 seconds
  clearTimer = setTimeout(() => {
    clearOverlay();
  }, 15000);
}
