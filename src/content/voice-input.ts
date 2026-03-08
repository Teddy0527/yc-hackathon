// Voice input module using Web Speech API (webkitSpeechRecognition)

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

type InterimCallback = (text: string) => void;

let recognition: any | null = null;

/**
 * Start listening for voice input via the Web Speech API.
 * Returns a promise that resolves with the final transcribed text.
 * @param onInterim - Optional callback invoked with interim transcription results
 */
export function startListening(onInterim?: InterimCallback): Promise<string> {
  return new Promise<string>((resolve) => {
    const SpeechRecognition =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[GrandHelper] Speech recognition not supported in this browser.');
      resolve('');
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onresult = (event: SpeechRecognitionEvent): void => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (onInterim) {
        onInterim(finalTranscript || interim);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent): void => {
      console.warn('[GrandHelper] Speech recognition error:', event.error);
      recognition = null;
      resolve('');
    };

    recognition.onend = (): void => {
      recognition = null;
      resolve(finalTranscript.trim());
    };

    try {
      recognition.start();
    } catch (err) {
      console.warn('[GrandHelper] Failed to start speech recognition:', err);
      recognition = null;
      resolve('');
    }
  });
}

/**
 * Stop any active speech recognition session.
 */
export function stopListening(): void {
  if (recognition) {
    try {
      recognition.stop();
    } catch (_) {
      // Already stopped
    }
    recognition = null;
  }
}
