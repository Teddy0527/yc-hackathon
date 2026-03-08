/**
 * Payload sent to the server when speech-to-text completes.
 */

export interface VoicePayloadPage {
  url: string;
  title: string;
  html: string;
}

export interface VoicePayload {
  query: string;
  current_page: VoicePayloadPage;
  other_pages: VoicePayloadPage[];
  metadata: {
    timestamp: number;
  };
}
