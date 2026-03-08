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
    background: #F5F7FA;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.08);
    border-radius: 20px 0 0 20px;
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
    padding: 24px 24px;
    background: #fff;
    color: #2D3748;
    border-radius: 20px 0 0 0;
    border-bottom: 1px solid #EDF2F7;
  }

  .gh-avatar {
    font-size: 32px;
    margin-right: 10px;
    line-height: 1;
  }

  .gh-title {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 0.3px;
  }

  .gh-close-btn {
    background: none;
    border: none;
    color: #A0AEC0;
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
    background: rgba(0, 0, 0, 0.05);
  }

  .gh-close-btn:focus-visible {
    outline: 3px solid #E8687A;
    outline-offset: 2px;
  }

  .gh-close-btn svg {
    width: 24px;
    height: 24px;
  }

  /* ── Greeting ─────────────────────────────────────────────────── */
  .gh-greeting {
    text-align: center;
    padding: 0 8px;
  }

  .gh-greeting-title {
    font-size: 26px;
    font-weight: 700;
    color: #2D3748;
    margin-bottom: 8px;
  }

  .gh-greeting-sub {
    font-size: 16px;
    color: #A0AEC0;
  }

  /* ── Body ─────────────────────────────────────────────────────── */
  .gh-body {
    padding: 32px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    overflow-y: auto;
    flex: 1;
  }

  /* ── Transcript ──────────────────────────────────────────────── */
  .gh-transcript {
    width: 100%;
    min-height: 72px;
    background: #ffffff;
    border: 1px solid #E2E8F0;
    border-radius: 12px;
    padding: 16px 18px;
    font-size: 18px;
    color: #4A6B82;
    line-height: 1.5;
    word-break: break-word;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  .gh-transcript:empty::after {
    content: 'Tap the microphone and ask your question...';
    color: #A0AEC0;
    font-size: 16px;
  }

  /* ── Visualizer ────────────────────────────────────────────────── */
  .gh-visualizer {
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: rgba(232, 104, 122, 0.08);
    display: none;
    align-items: center;
    justify-content: center;
    position: relative;
    flex-shrink: 0;
  }

  .gh-visualizer::before {
    content: '';
    position: absolute;
    width: 260px;
    height: 260px;
    border-radius: 50%;
    background: rgba(232, 104, 122, 0.04);
  }

  .gh-listening .gh-visualizer {
    display: flex;
  }

  .gh-visualizer-bars {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 60px;
    z-index: 1;
  }

  .gh-visualizer-bar {
    width: 6px;
    background: #E8687A;
    border-radius: 3px;
    height: 20px;
  }

  .gh-listening .gh-visualizer-bar {
    animation: gh-bar-bounce 0.8s ease-in-out infinite;
  }

  .gh-visualizer-bar:nth-child(1) { animation-delay: 0s; }
  .gh-visualizer-bar:nth-child(2) { animation-delay: 0.1s; }
  .gh-visualizer-bar:nth-child(3) { animation-delay: 0.2s; }
  .gh-visualizer-bar:nth-child(4) { animation-delay: 0.3s; }
  .gh-visualizer-bar:nth-child(5) { animation-delay: 0.4s; }

  @keyframes gh-bar-bounce {
    0%, 100% { height: 20px; }
    50%      { height: 50px; }
  }

  /* ── Status ──────────────────────────────────────────────────── */
  .gh-status {
    font-size: 20px;
    font-weight: 600;
    color: #E8687A;
    text-align: center;
    min-height: 28px;
  }

  /* ── Mic button ──────────────────────────────────────────────── */
  .gh-mic-btn {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    border: none;
    background: #E8687A;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, transform 0.15s;
    box-shadow: 0 0 0 8px rgba(232, 104, 122, 0.15), 0 0 0 16px rgba(232, 104, 122, 0.07), 0 4px 20px rgba(232, 104, 122, 0.4);
    flex-shrink: 0;
  }

  .gh-mic-btn svg {
    width: 36px;
    height: 36px;
  }

  .gh-mic-btn:hover {
    background: #D4576A;
    transform: scale(1.05);
  }

  .gh-mic-btn:active {
    transform: scale(0.95);
  }

  .gh-mic-btn:focus-visible {
    outline: 3px solid #E8687A;
    outline-offset: 3px;
  }

  .gh-mic-btn.gh-listening {
    background: #E8687A;
    animation: gh-mic-pulse 1s ease-in-out infinite;
  }

  .gh-mic-btn.gh-thinking {
    background: #F5A0AB;
    animation: gh-breathe 2s ease-in-out infinite;
  }

  @keyframes gh-mic-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(232, 104, 122, 0.5); }
    50%      { box-shadow: 0 0 0 16px rgba(232, 104, 122, 0); }
  }

  @keyframes gh-breathe {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 8px rgba(232, 104, 122, 0.2), 0 4px 20px rgba(232, 104, 122, 0.4); }
    50%      { transform: scale(1.06); box-shadow: 0 0 0 14px rgba(232, 104, 122, 0.1), 0 4px 24px rgba(232, 104, 122, 0.5); }
  }

  /* ── Button row ──────────────────────────────────────────────── */
  .gh-btn-row {
    display: none;
    gap: 12px;
    width: 100%;
  }

  .gh-repeat-btn {
    flex: 1;
    padding: 16px 20px;
    border: 2px solid #E8687A;
    background: #fff;
    color: #E8687A;
    font-size: 20px;
    font-weight: 600;
    border-radius: 16px;
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
    background: #E8687A;
    color: #fff;
  }

  .gh-repeat-btn:focus-visible {
    outline: 3px solid #E8687A;
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
    border-radius: 16px 0 0 16px;
    border: none;
    background: #E8687A;
    color: #fff;
    cursor: pointer;
    box-shadow: -2px 0 12px rgba(232, 104, 122, 0.3);
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
    background: #D4576A;
  }

  .gh-toggle-btn:focus-visible {
    outline: 3px solid #E8687A;
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
    .gh-mic-btn.gh-thinking {
      animation: none;
    }
    .gh-visualizer-bar {
      animation: none !important;
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
  toggleBtn.className = 'gh-toggle-btn';
  toggleBtn.setAttribute('aria-label', 'Open Silver Assist');
  toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
  shadowRoot.appendChild(toggleBtn);

  // Main panel
  const panel = document.createElement('div');
  panel.className = 'gh-panel';
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'Silver Assist voice assistant');
  panel.innerHTML = `
    <div class="gh-header">
      <div style="display:flex;align-items:center;"><span class="gh-avatar"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E8687A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span><span class="gh-title">Silver Assist</span></div>
      <button class="gh-close-btn" aria-label="Settings"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></button>
    </div>
    <div class="gh-body">
      <div class="gh-greeting">
        <div class="gh-greeting-title">How can I help you today?</div>
        <div class="gh-greeting-sub">マイクをタップして何でも聞いてください</div>
      </div>
      <div class="gh-transcript" aria-live="polite"></div>
      <div class="gh-visualizer">
        <div class="gh-visualizer-bars">
          <div class="gh-visualizer-bar"></div>
          <div class="gh-visualizer-bar"></div>
          <div class="gh-visualizer-bar"></div>
          <div class="gh-visualizer-bar"></div>
          <div class="gh-visualizer-bar"></div>
        </div>
      </div>
      <div class="gh-status" aria-live="polite"></div>
      <button class="gh-mic-btn" aria-label="Start listening"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg></button>
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

  // Start minimized with a visible edge tab so users can always reopen it.
  panel.classList.add('gh-minimized');

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
    panel.classList.add('gh-listening');

    // 1. Voice input
    console.log('[GrandHelper] Listening for speech...');
    const question = await startListening((interim: string) => {
      transcript.textContent = interim;
    });

    micBtn.classList.remove('gh-listening');
    panel.classList.remove('gh-listening');
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
    micBtn.classList.add('gh-thinking');

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

      micBtn.classList.remove('gh-thinking');
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
      micBtn.classList.remove('gh-thinking');
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
