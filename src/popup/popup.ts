function updateStatus(active: boolean): void {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (!dot || !text) return;

  if (active) {
    dot.classList.add('active');
    dot.classList.remove('inactive');
    text.textContent = 'Active';
  } else {
    dot.classList.add('inactive');
    dot.classList.remove('active');
    text.textContent = 'Inactive';
  }
}

async function checkContentScriptStatus(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id || !tab.url || tab.url.startsWith('chrome://')) {
      updateStatus(false);
      return;
    }

    chrome.tabs.sendMessage(
      tab.id,
      { type: 'PING' },
      (response) => {
        if (chrome.runtime.lastError || !response) {
          updateStatus(false);
        } else {
          updateStatus(true);
        }
      }
    );
  } catch {
    updateStatus(false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkContentScriptStatus();

  const settingsLink = document.getElementById('settings-link');
  if (settingsLink) {
    settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'settings.html';
    });
  }
});
