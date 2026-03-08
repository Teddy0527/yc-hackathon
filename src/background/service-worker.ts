chrome.runtime.onInstalled.addListener((details) => {
  console.log('GrandHelper extension installed:', details.reason);
  if (details.reason === 'install') {
    console.log('Welcome to GrandHelper! Your friendly computer assistant.');
  } else if (details.reason === 'update') {
    console.log(`GrandHelper updated to version ${chrome.runtime.getManifest().version}`);
  }
});

function isSupportedTabUrl(url?: string): boolean {
  if (!url) return false;
  return !(
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryOpenPanel(tabId: number): Promise<boolean> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'OPEN_PANEL' });
    return response?.status === 'ok';
  } catch {
    return false;
  }
}

async function ensureContentScript(tabId: number): Promise<boolean> {
  if (await tryOpenPanel(tabId)) {
    return true;
  }

  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['styles.css'],
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch (error) {
    console.error('[GrandHelper] Failed to inject content script:', error);
    return false;
  }

  // Give the injected script a brief moment to register message listeners.
  await sleep(80);

  return tryOpenPanel(tabId);
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !isSupportedTabUrl(tab.url)) {
    console.warn('[GrandHelper] Panel is not available on this page:', tab.url);
    return;
  }

  try {
    const opened = await ensureContentScript(tab.id);
    if (!opened) {
      console.error('[GrandHelper] Could not open panel on this tab.');
    }
  } catch (error) {
    console.error('[GrandHelper] Failed to toggle panel:', error);
  }
});

/** Get full HTML from a tab (run via scripting.executeScript). */
function getPageHtml(): string {
  return document.documentElement.outerHTML;
}

const VOICE_PAYLOAD_URL = 'http://localhost:3000';

async function collectVoicePayload(
  query: string,
  currentTabId: number
): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const supported = tabs.filter((tab) => tab.id != null && isSupportedTabUrl(tab.url));
  const currentTab = supported.find((t) => t.id === currentTabId);
  const otherTabs = supported.filter((t) => t.id !== currentTabId);

  const pageEntry = (tab: chrome.tabs.Tab, html: string) => ({
    url: tab.url ?? '',
    title: tab.title ?? '',
    html,
  });

  const results: { tabId: number; html: string }[] = [];
  for (const tab of supported) {
    if (!tab.id) continue;
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: getPageHtml,
      });
      results.push({ tabId: tab.id, html: typeof result === 'string' ? result : '' });
    } catch {
      results.push({ tabId: tab.id, html: '' });
    }
  }

  const htmlByTabId = new Map(results.map((r) => [r.tabId, r.html]));

  const current_page = currentTab
    ? pageEntry(currentTab, htmlByTabId.get(currentTab.id!) ?? '')
    : { url: '', title: '', html: '' };

  const other_pages = otherTabs.map((tab) =>
    pageEntry(tab, htmlByTabId.get(tab.id!) ?? '')
  );

  const payload = {
    query,
    current_page,
    other_pages,
    metadata: { timestamp: Math.floor(Date.now() / 1000) },
  };

  const body = JSON.stringify(payload);
  console.log('[GrandHelper] Voice payload — sending to', VOICE_PAYLOAD_URL);
  console.log('[GrandHelper] Payload (object):', payload);
  console.log('[GrandHelper] Payload (JSON body):', body);

  try {
    await fetch(VOICE_PAYLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (err) {
    console.error('[GrandHelper] Voice payload POST failed:', err);
  }
}

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; payload?: unknown; query?: string },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    if (message.type === 'PING') {
      sendResponse({ status: 'ok' });
    } else if (message.type === 'SEND_VOICE_PAYLOAD' && typeof message.query === 'string' && sender.tab?.id) {
      collectVoicePayload(message.query, sender.tab.id).then(() => {
        sendResponse({ status: 'ok' });
      });
      return true; // keep channel open for async sendResponse
    }
    return false;
  }
);
