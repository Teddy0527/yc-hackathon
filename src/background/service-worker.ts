chrome.runtime.onInstalled.addListener((details) => {
  console.log('GrandHelper extension installed:', details.reason);
  if (details.reason === 'install') {
    console.log('Welcome to GrandHelper! Your friendly computer assistant.');
  } else if (details.reason === 'update') {
    console.log(`GrandHelper updated to version ${chrome.runtime.getManifest().version}`);
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
