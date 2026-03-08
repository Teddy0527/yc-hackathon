import { API_URL } from '../utils/constants';

export interface AssistantRequest {
  question: string;
  url: string;
  title: string;
  dom: string;
  screenshotBase64: string;
}

export interface AssistantResponse {
  spokenResponse: string;
  steps: Array<{
    ghId: number;
    action: 'click' | 'type' | 'scroll' | 'look';
    description: string;
  }>;
}

const FALLBACK_RESPONSE: AssistantResponse = {
  spokenResponse:
    "I'm sorry, I had trouble understanding that. Could you try asking again?",
  steps: [],
};

export async function askAssistant(
  request: AssistantRequest
): Promise<AssistantResponse> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      console.error(
        `GrandHelper API error: ${response.status} ${response.statusText}`
      );
      return FALLBACK_RESPONSE;
    }

    const data: AssistantResponse = await response.json();
    return data;
  } catch (error) {
    console.error('GrandHelper API request failed:', error);
    return FALLBACK_RESPONSE;
  }
}
