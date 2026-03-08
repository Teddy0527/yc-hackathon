// GrandHelper Content Script - Main entry point
// Injects a floating voice-assistant panel via Shadow DOM

import { startListening, stopListening } from './voice-input';
import { speak, stopSpeaking } from './voice-output';
import { captureScreen } from './screen-capture';
import { showOverlay, clearOverlay, showFallbackMessage, OverlayStep } from './overlay';
import { serializeDOM } from '../utils/dom-serializer';
import { askAssistant, AssistantResponse } from '../api/assistant';

// Log as soon as script runs (Chrome: content script logs show in this page's Console — Inspect → Console, ensure "Default levels" / All)
console.log('[GrandHelper] Content script loaded');

/**
 * Show a visible banner on the page so you can confirm the content script ran.
 * Content script console.log can be hidden by DevTools context — this is a fallback.
 */
function showLoadedBanner(): void {
  const id = 'grandhelper-loaded-banner';
  if (document.getElementById(id)) return;
  const el = document.createElement('div');
  el.id = id;
  el.setAttribute(
    'style',
    'position:fixed;bottom:12px;left:12px;z-index:2147483646;padding:8px 12px;background:#0891B2;color:#fff;font-family:sans-serif;font-size:12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.2);'
  );
  el.textContent = 'GrandHelper loaded. Inspect this page (F12) → Console. Filter by "GrandHelper" or show All levels.';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 8000);
}

// Run as soon as we have a body (content scripts run at document_idle, so body exists)
if (document.body) {
  showLoadedBanner();
} else {
  document.addEventListener('DOMContentLoaded', showLoadedBanner);
}

// ── Panel styles (isolated inside Shadow DOM) ────────────────────────────────

const PANEL_STYLES = `
  :host {
    all: initial;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* ── Sidebar ─────────────────────────────────────────────────── */
  .gh-panel {
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    width: 380px;
    background: #ECFEFF;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Arial, sans-serif;
    z-index: 2147483647;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transform: translateX(0);
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .gh-panel.gh-minimized {
    transform: translateX(100%);
    pointer-events: none;
  }

  /* ── Header ──────────────────────────────────────────────────── */
  .gh-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    background: #0891B2;
    color: #fff;
  }

  .gh-title {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 0.3px;
  }

  .gh-close-btn {
    background: none;
    border: none;
    color: #fff;
    cursor: pointer;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background 0.2s;
    line-height: 1;
  }

  .gh-close-btn:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .gh-close-btn:focus-visible {
    outline: 3px solid #164E63;
    outline-offset: 2px;
  }

  .gh-close-btn svg {
    width: 24px;
    height: 24px;
  }

  /* ── Body ─────────────────────────────────────────────────────── */
  .gh-body {
    padding: 28px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    overflow-y: auto;
    flex: 1;
  }

  /* ── Mic button ──────────────────────────────────────────────── */
  .gh-mic-btn {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    border: none;
    background: #059669;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, transform 0.15s;
    box-shadow: 0 4px 20px rgba(5, 150, 105, 0.4);
    flex-shrink: 0;
  }

  .gh-mic-btn svg {
    width: 40px;
    height: 40px;
  }

  .gh-mic-btn:hover {
    background: #047857;
    transform: scale(1.05);
  }

  .gh-mic-btn:active {
    transform: scale(0.95);
  }

  .gh-mic-btn:focus-visible {
    outline: 3px solid #164E63;
    outline-offset: 3px;
  }

  .gh-mic-btn.gh-listening {
    background: #DC2626;
    animation: gh-mic-pulse 1s ease-in-out infinite;
  }

  @keyframes gh-mic-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.5); }
    50%      { box-shadow: 0 0 0 16px rgba(220, 38, 38, 0); }
  }

  /* ── Transcript ──────────────────────────────────────────────── */
  .gh-transcript {
    width: 100%;
    min-height: 72px;
    background: #ffffff;
    border: 2px solid #0891B2;
    border-radius: 12px;
    padding: 16px 18px;
    font-size: 22px;
    color: #164E63;
    line-height: 1.5;
    word-break: break-word;
  }

  .gh-transcript:empty::after {
    content: 'Tap the microphone and ask your question...';
    color: #94A3B8;
    font-size: 20px;
  }

  /* ── Status ──────────────────────────────────────────────────── */
  .gh-status {
    font-size: 20px;
    font-weight: 600;
    color: #164E63;
    text-align: center;
    min-height: 28px;
  }

  /* ── Button row ──────────────────────────────────────────────── */
  .gh-btn-row {
    display: flex;
    gap: 12px;
    width: 100%;
  }

  .gh-repeat-btn {
    flex: 1;
    padding: 16px 20px;
    border: 2px solid #059669;
    background: #fff;
    color: #059669;
    font-size: 20px;
    font-weight: 600;
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.2s, color 0.2s;
    font-family: inherit;
  }

  .gh-repeat-btn svg {
    width: 22px;
    height: 22px;
  }

  .gh-repeat-btn:hover {
    background: #059669;
    color: #fff;
  }

  .gh-repeat-btn:focus-visible {
    outline: 3px solid #164E63;
    outline-offset: 2px;
  }

  .gh-repeat-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ── Toggle tab (right edge) ─────────────────────────────────── */
  .gh-toggle-btn {
    position: fixed;
    top: 50%;
    right: 0;
    transform: translateY(-50%);
    width: 48px;
    height: 96px;
    border-radius: 12px 0 0 12px;
    border: none;
    background: #0891B2;
    color: #fff;
    cursor: pointer;
    box-shadow: -2px 0 12px rgba(8, 145, 178, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    transition: background 0.2s;
  }

  .gh-toggle-btn svg {
    width: 24px;
    height: 24px;
  }

  .gh-toggle-btn:hover {
    background: #0E7490;
  }

  .gh-toggle-btn:focus-visible {
    outline: 3px solid #164E63;
    outline-offset: 2px;
  }

  .gh-toggle-btn.gh-hidden {
    display: none;
  }

  /* ── Reduced motion ──────────────────────────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    .gh-panel {
      transition: none;
    }
    .gh-mic-btn {
      transition: none;
    }
    .gh-mic-btn.gh-listening {
      animation: none;
    }
    .gh-close-btn,
    .gh-repeat-btn,
    .gh-toggle-btn {
      transition: none;
    }
  }
`;

// ── State ────────────────────────────────────────────────────────────────────

let lastResponse = '';
let isProcessing = false;
const ROOT_ID = 'grandhelper-root';

// ── Panel creation ───────────────────────────────────────────────────────────

function createPanel(): {
  shadowRoot: ShadowRoot;
  micBtn: HTMLButtonElement;
  transcript: HTMLDivElement;
  status: HTMLDivElement;
  repeatBtn: HTMLButtonElement;
  panel: HTMLDivElement;
  toggleBtn: HTMLButtonElement;
} {
  const host = document.createElement('div');
  host.id = ROOT_ID;
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });

  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.textContent = PANEL_STYLES;
  shadowRoot.appendChild(styleEl);

  // Toggle tab (visible when panel minimized)
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'gh-toggle-btn gh-hidden';
  toggleBtn.setAttribute('aria-label', 'Open GrandHelper');
  toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
  shadowRoot.appendChild(toggleBtn);

  // Main panel
  const panel = document.createElement('div');
  panel.className = 'gh-panel';
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'GrandHelper voice assistant');
  panel.innerHTML = `
    <div class="gh-header">
      <span class="gh-title">GrandHelper</span>
      <button class="gh-close-btn" aria-label="Close sidebar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="gh-body">
      <button class="gh-mic-btn" aria-label="Start listening"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg></button>
      <div class="gh-transcript" aria-live="polite"></div>
      <div class="gh-status" aria-live="polite"></div>
      <div class="gh-btn-row">
        <button class="gh-repeat-btn" aria-label="Repeat last response" disabled><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg> Repeat</button>
      </div>
    </div>
  `;
  shadowRoot.appendChild(panel);

  const micBtn = panel.querySelector('.gh-mic-btn') as HTMLButtonElement;
  const transcript = panel.querySelector('.gh-transcript') as HTMLDivElement;
  const status = panel.querySelector('.gh-status') as HTMLDivElement;
  const repeatBtn = panel.querySelector('.gh-repeat-btn') as HTMLButtonElement;
  const closeBtn = panel.querySelector('.gh-close-btn') as HTMLButtonElement;

  const minimizePanel = (): void => {
    panel.classList.add('gh-minimized');
    toggleBtn.classList.remove('gh-hidden');
  };

  const openPanel = (): void => {
    panel.classList.remove('gh-minimized');
    toggleBtn.classList.add('gh-hidden');
    micBtn.focus();
  };

  // Minimize / restore
  closeBtn.addEventListener('click', minimizePanel);

  toggleBtn.addEventListener('click', openPanel);

  // Start minimized; opened via toolbar click.
  panel.classList.add('gh-minimized');
  toggleBtn.classList.add('gh-hidden');

  return { shadowRoot, micBtn, transcript, status, repeatBtn, panel, toggleBtn };
}

// ── Main orchestration ───────────────────────────────────────────────────────

function init(): void {
  if (document.getElementById(ROOT_ID)) {
    console.log('[GrandHelper] Already initialized, skipping');
    return;
  }
  console.log('[GrandHelper] Initializing panel');

  const { micBtn, transcript, status, repeatBtn, panel, toggleBtn } = createPanel();
  console.log('[GrandHelper] Panel created — click the extension icon or the mic to continue');
  const openPanel = (): void => {
    panel.classList.remove('gh-minimized');
    toggleBtn.classList.add('gh-hidden');
    micBtn.focus();
  };
  const minimizePanel = (): void => {
    panel.classList.add('gh-minimized');
    toggleBtn.classList.remove('gh-hidden');
  };
  const togglePanel = (): void => {
    if (panel.classList.contains('gh-minimized')) {
      openPanel();
    } else {
      minimizePanel();
    }
  };

  // --- Respond to PING from popup ---
  chrome.runtime.onMessage.addListener(
    (message: { type: string }, _sender, sendResponse) => {
      if (message.type === 'PING') {
        sendResponse({ status: 'ok' });
      } else if (message.type === 'OPEN_PANEL') {
        openPanel();
        sendResponse({ status: 'ok' });
      } else if (message.type === 'TOGGLE_PANEL') {
        togglePanel();
        sendResponse({ status: 'ok' });
      }
      return false;
    }
  );

  // --- Mic button handler ---
  micBtn.addEventListener('click', async () => {
    if (isProcessing) return;

    console.log('[GrandHelper] Mic button clicked');
    isProcessing = true;
    clearOverlay();
    stopSpeaking();
    transcript.textContent = '';
    status.textContent = 'Listening...';
    micBtn.classList.add('gh-listening');

    // 1. Voice input
    console.log('[GrandHelper] Listening for speech...');
    const question = await startListening((interim: string) => {
      transcript.textContent = interim;
    });

    micBtn.classList.remove('gh-listening');
    console.log('[GrandHelper] Speech ended. Final query:', question || '(empty)');

    if (!question) {
      status.textContent = 'No speech detected. Try again.';
      console.log('[GrandHelper] No speech detected, stopping');
      isProcessing = false;
      return;
    }

    transcript.textContent = question;

    // Send voice payload to server (query + current tab + other tabs)
    try {
      chrome.runtime.sendMessage({
        type: 'SEND_VOICE_PAYLOAD',
        query: question,
      });
      console.log('[GrandHelper] Voice payload sent to background (query:', question.substring(0, 50) + (question.length > 50 ? '...' : '') + ')');
    } catch (e) {
      console.warn('[GrandHelper] Could not send voice payload:', e);
    }

    status.textContent = 'Analyzing the page...';

    // 2. Serialize DOM (tags interactive elements with data-gh-id)
    const dom = serializeDOM();

    // 3. Screen capture
    const screenshotBase64 = await captureScreen();

    status.textContent = 'Thinking...';

    // 4. Ask AI via proxy
    try {
      const aiResult: AssistantResponse = await askAssistant({
        question,
        url: window.location.href,
        title: document.title,
        dom,
        screenshotBase64,
      });

      lastResponse = aiResult.spokenResponse;
      repeatBtn.disabled = false;

      status.textContent = 'Speaking...';

      // 5. Speak response
      speak(aiResult.spokenResponse).then(() => {
        status.textContent = '';
      });

      // 6. Show overlays if steps provided
      if (aiResult.steps && aiResult.steps.length > 0) {
        const matchedSteps = aiResult.steps.filter((s) =>
          document.querySelector(`[data-gh-id="${s.ghId}"]`)
        );

        if (matchedSteps.length > 0) {
          showOverlay(matchedSteps);
        } else {
          showFallbackMessage(
            "I can explain the steps, but I can't highlight elements on this page yet."
          );
        }
      }
    } catch (err) {
      console.error('[GrandHelper] AI request failed:', err);
      status.textContent = 'Something went wrong. Please try again.';
      const errorMessage =
        'Sorry, I had trouble connecting. Please try again in a moment.';
      lastResponse = errorMessage;
      repeatBtn.disabled = false;
      speak(errorMessage);
    }

    isProcessing = false;
  });

  // --- Repeat button handler ---
  repeatBtn.addEventListener('click', () => {
    if (lastResponse) {
      stopSpeaking();
      speak(lastResponse);
    }
  });
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

init();
