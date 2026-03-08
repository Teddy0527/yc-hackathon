import OpenAI from 'openai';
import type { AssistantRequest, AssistantResponse } from '../schema';

const FALLBACK_RESPONSE: AssistantResponse = {
  spokenResponse:
    "I'm sorry, I had trouble understanding that. Could you try asking again?",
  steps: [],
};

const SYSTEM_PROMPT = `You are Silver Assist, a patient, friendly assistant helping elderly people use their computer. You guide them step by step through web pages. Always be encouraging and use simple language. Respond in JSON format with: spokenResponse (what to say aloud, be warm and clear) and steps (array of actions referencing element ghId numbers from the DOM).

Each step should have:
- ghId: the numeric ID of the element to interact with
- action: one of "click", "type", "scroll", or "look"
- description: a simple explanation of what this step does

Example response:
{
  "spokenResponse": "Of course! I'll help you sign in. Let's start by clicking the Sign In button.",
  "steps": [
    {"ghId": 3, "action": "click", "description": "Click the Sign In button"}
  ]
}`;

function buildUserMessage(request: AssistantRequest): OpenAI.ChatCompletionMessageParam {
  const textContent = [
    `User's question: "${request.question}"`,
    `Current page: ${request.title} (${request.url})`,
    '',
    'Interactive elements on the page:',
    request.dom,
  ].join('\n');

  const parts: OpenAI.ChatCompletionContentPart[] = [
    { type: 'text', text: textContent },
  ];

  if (request.screenshotBase64) {
    parts.push({
      type: 'image_url',
      image_url: {
        url: request.screenshotBase64.startsWith('data:')
          ? request.screenshotBase64
          : `data:image/png;base64,${request.screenshotBase64}`,
        detail: 'low',
      },
    });
  }

  return { role: 'user', content: parts };
}

export async function askShisa(
  request: AssistantRequest
): Promise<AssistantResponse> {
  try {
    const client = new OpenAI({
      apiKey: process.env.SHISA_API_KEY || '',
      baseURL: process.env.SHISA_BASE_URL || 'https://api.shisa.ai/v1',
    });

    const model = process.env.SHISA_MODEL || 'shisa-v2-llama3.3-70b';

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        buildUserMessage(request),
      ],
      max_tokens: 1024,
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.warn('Empty response from Shisa');
      return FALLBACK_RESPONSE;
    }

    // Extract JSON from the response (handle markdown code blocks)
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ||
      content.match(/(\{[\s\S]*\})/);

    if (!jsonMatch || !jsonMatch[1]) {
      console.warn('Could not extract JSON from response:', content);
      return FALLBACK_RESPONSE;
    }

    const parsed = JSON.parse(jsonMatch[1].trim()) as AssistantResponse;
    return parsed;
  } catch (error) {
    console.error('Shisa provider error:', error);
    return FALLBACK_RESPONSE;
  }
}
