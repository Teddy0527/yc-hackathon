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

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; payload?: unknown },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    if (message.type === 'PING') {
      sendResponse({ status: 'ok' });
    }
    // Return true to indicate async response handling if needed in the future
    return false;
  }
);
