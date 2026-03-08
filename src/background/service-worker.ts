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

/** Find a tab whose title or URL contains the query (case-insensitive). */
async function findTabByTitleOrUrl(query: string): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({});
  const lower = query.toLowerCase();
  return tabs.find((tab) => {
    const title = (tab.title ?? '').toLowerCase();
    const url = (tab.url ?? '').toLowerCase();
    return isSupportedTabUrl(tab.url) && (title.includes(lower) || url.includes(lower));
  }) ?? null;
}

/** Run in a tab: find an element containing the given text and click its clickable ancestor. */
function clickElementWithText(searchText: string): void {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.textContent && node.textContent.includes(searchText)) {
      const el = node.parentElement;
      if (!el) continue;
      const clickable = el.closest('a') || el.closest('[role="button"]') || el.closest('button') || el.closest('[onclick]') || el;
      (clickable as HTMLElement).click();
      return;
    }
  }
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

interface PanelState {
  transcript?: string;
  showSteps?: boolean;
}

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; payload?: unknown; query?: string; text?: string; state?: PanelState },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    if (message.type === 'PING') {
      sendResponse({ status: 'ok' });
    } else if (message.type === 'SEND_VOICE_PAYLOAD' && typeof message.query === 'string' && sender.tab?.id) {
      collectVoicePayload(message.query, sender.tab.id).then(() => {
        sendResponse({ status: 'ok' });
      });
      return true;
    } else if (message.type === 'SWITCH_TO_TAB' && typeof message.query === 'string') {
      const state = message.state;
      findTabByTitleOrUrl(message.query).then(async (tab) => {
        if (tab?.id == null) {
          sendResponse({ status: 'error', message: 'No matching tab found' });
          return;
        }
        await chrome.tabs.update(tab.id, { active: true });
        if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });
        await ensureContentScript(tab.id);
        if (state) {
          await sleep(150);
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'RESTORE_PANEL_STATE', state });
          } catch (_) {}
        }
        sendResponse({ status: 'ok', tabId: tab.id });
      });
      return true;
    } else if (message.type === 'CLICK_CALENDAR_EVENT' && typeof message.text === 'string') {
      const eventTitle = message.text;
      const state = message.state;
      findTabByTitleOrUrl('google calendar').then(async (tab) => {
        if (!tab?.id) {
          sendResponse({ status: 'error', message: 'Google Calendar tab not found' });
          return;
        }
        try {
          await chrome.tabs.update(tab.id, { active: true });
          if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });
          await ensureContentScript(tab.id);
          if (state) {
            await sleep(150);
            try {
              await chrome.tabs.sendMessage(tab.id, { type: 'RESTORE_PANEL_STATE', state });
            } catch (_) {}
          }
          await sleep(200);
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: clickElementWithText,
            args: [eventTitle],
          });
          sendResponse({ status: 'ok' });
        } catch (err) {
          console.error('[GrandHelper] CLICK_CALENDAR_EVENT failed:', err);
          sendResponse({ status: 'error', message: String(err) });
        }
      });
      return true;
    }
    return false;
  }
);
