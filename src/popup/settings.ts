const speedSlider = document.getElementById('speech-speed') as HTMLInputElement;
const speedValue = document.getElementById('speed-value') as HTMLSpanElement;
const voiceSelect = document.getElementById('voice-select') as HTMLSelectElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const saveStatus = document.getElementById('save-status') as HTMLDivElement;

// Update speed label as slider moves
speedSlider.addEventListener('input', () => {
  speedValue.textContent = speedSlider.value;
});

// Populate voice dropdown with English voices
function populateVoices(): void {
  const voices = window.speechSynthesis.getVoices();
  const englishVoices = voices.filter((v) => v.lang.startsWith('en'));

  // Clear existing options except the default
  voiceSelect.innerHTML = '<option value="">Auto (default)</option>';

  for (const voice of englishVoices) {
    const option = document.createElement('option');
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.appendChild(option);
  }

  // Restore saved voice selection
  chrome.storage.local.get(['voiceName'], (result) => {
    if (typeof result.voiceName === 'string' && result.voiceName) {
      voiceSelect.value = result.voiceName;
    }
  });
}

// Load saved settings
chrome.storage.local.get(['speechRate', 'voiceName'], (result) => {
  if (result.speechRate !== undefined) {
    speedSlider.value = String(result.speechRate);
    speedValue.textContent = String(result.speechRate);
  }
});

// Voices may load asynchronously
if (window.speechSynthesis.getVoices().length > 0) {
  populateVoices();
}
window.speechSynthesis.onvoiceschanged = populateVoices;

// Save settings
saveBtn.addEventListener('click', () => {
  const settings = {
    speechRate: parseFloat(speedSlider.value),
    voiceName: voiceSelect.value,
  };

  chrome.storage.local.set(settings, () => {
    saveStatus.textContent = 'Settings saved!';
    setTimeout(() => {
      saveStatus.textContent = '';
    }, 2000);
  });
});
