import { z } from 'zod';

export const AssistantRequestSchema = z.object({
  question: z.string(),
  url: z.string(),
  title: z.string(),
  dom: z.string(),
  screenshotBase64: z.string(),
});

export const AssistantResponseSchema = z.object({
  spokenResponse: z.string(),
  steps: z.array(
    z.object({
      ghId: z.number(),
      action: z.enum(['click', 'type', 'scroll', 'look']),
      description: z.string(),
    })
  ),
});

export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;
export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;
