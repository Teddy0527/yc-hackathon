// Voice output module using the SpeechSynthesis API

let currentUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Find a preferred English voice for clear speech output.
 */
function getPreferredVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const preferredNames = ['Google', 'Samantha', 'Daniel', 'Karen', 'Moira', 'Alex'];

  // Try to find a voice matching one of the preferred names
  for (const name of preferredNames) {
    const match = voices.find(
      (v) => v.name.includes(name) && v.lang.startsWith('en')
    );
    if (match) return match;
  }

  // Fall back to any English voice
  const englishVoice = voices.find((v) => v.lang.startsWith('en'));
  if (englishVoice) return englishVoice;

  return null;
}

/**
 * Speak the given text aloud using SpeechSynthesis.
 * Cancels any currently playing speech first.
 * Returns a promise that resolves when speaking finishes.
 */
export function speak(text: string): Promise<void> {
  return new Promise<void>((resolve) => {
    // Cancel any ongoing speech
    stopSpeaking();

    if (!window.speechSynthesis) {
      console.warn('[GrandHelper] SpeechSynthesis not supported.');
      resolve();
      return;
    }

    chrome.storage.local.get(['speechRate', 'voiceName'], (result) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = typeof result.speechRate === 'number' ? result.speechRate : 0.85;
      utterance.pitch = 1.0;

      // Use saved voice if set, otherwise fall back to auto-selection
      if (result.voiceName) {
        const voices = window.speechSynthesis.getVoices();
        const savedVoice = voices.find((v) => v.name === result.voiceName);
        if (savedVoice) {
          utterance.voice = savedVoice;
        } else {
          const voice = getPreferredVoice();
          if (voice) utterance.voice = voice;
        }
      } else {
        const voice = getPreferredVoice();
        if (voice) utterance.voice = voice;
      }

      utterance.onend = (): void => {
        currentUtterance = null;
        resolve();
      };

      utterance.onerror = (): void => {
        currentUtterance = null;
        resolve();
      };

      currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    });
  });
}

/**
 * Stop any currently playing speech.
 */
export function stopSpeaking(): void {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
}
