import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AssistantRequestSchema, AssistantResponseSchema } from './schema';
import type { AssistantResponse } from './schema';
import { askShisa } from './providers/shisa';

dotenv.config();

const app = express();
const PORT = 3456;

const FALLBACK_RESPONSE: AssistantResponse = {
  spokenResponse:
    "I'm sorry, I had trouble understanding that. Could you try asking again?",
  steps: [],
};

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/ask', async (req: Request, res: Response) => {
  const parsed = AssistantRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parsed.error.issues,
    });
    return;
  }

  try {
    const rawResponse = await askShisa(parsed.data);

    const validated = AssistantResponseSchema.safeParse(rawResponse);
    if (!validated.success) {
      console.warn(
        'Response validation failed, returning fallback:',
        validated.error.issues
      );
      res.json(FALLBACK_RESPONSE);
      return;
    }

    res.json(validated.data);
  } catch (error) {
    console.error('Error processing request:', error);
    res.json(FALLBACK_RESPONSE);
  }
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

app.listen(PORT, () => {
  console.log(`GrandHelper proxy server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
