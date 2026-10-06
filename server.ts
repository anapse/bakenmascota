import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { AIService } from './src/ai/service.ts';
import { ChatRequestBody } from './src/ai/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Initialize AI Service
const aiService = new AIService({
  geminiApiKey: process.env.GEMINI_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiBaseUrl: process.env.OPENAI_BASE_URL,
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
  environment: 'express',
});

// Setup CORS - Allows the other application to connect seamlessly
const allowedOrigins = process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : '*';
app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-app-token', 'User-Agent'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));

// --- API ENDPOINTS ---

/**
 * Health Check Endpoint
 * GET /api/health
 */
app.get('/api/health', (_req: Request, res: Response) => {
  const health = aiService.getHealth();
  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

/**
 * Chat & AI Generation Endpoint
 * POST /api/chat
 */
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const body = req.body as ChatRequestBody;

    if (!body || (!body.prompt && (!body.messages || body.messages.length === 0))) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: "prompt" string or "messages" array.',
      });
    }

    const result = await aiService.handleChat(body);
    return res.status(200).json(result);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API /api/chat error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal AI Server Error',
    });
  }
});

/**
 * Models & Capabilities Metadata
 * GET /api/models
 */
app.get('/api/models', (_req: Request, res: Response) => {
  res.json({
    primaryProvider: 'gemini',
    defaultModel: 'gemini-3.8-flash',
    fallbackModel: 'gemini-3.1-flash-lite',
    availableModels: [
      {
        id: 'gemini-3.8-flash',
        name: 'Gemini 3.8 Flash',
        description: 'High-speed, top reasoning model for general text, math, code and analysis.',
        recommendedFor: ['general', 'coding', 'complex_reasoning', 'math', 'creative'],
      },
      {
        id: 'gemini-3.1-flash-lite',
        name: 'Gemini 3.1 Flash Lite',
        description: 'Ultra-low latency, cost-effective model used for fast Q&A and default fallback.',
        recommendedFor: ['fast_qa', 'fallback'],
      },
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro Preview',
        description: 'Deep reasoning model for high-complexity analytical tasks.',
        recommendedFor: ['complex_reasoning', 'advanced_stem'],
      },
    ],
    taskTypes: [
      { id: 'auto', description: 'Intelligently analyzes query text to pick the best model automatically' },
      { id: 'general', description: 'Standard general purpose text generation' },
      { id: 'coding', description: 'Code generation, debugging, refactoring, algorithms' },
      { id: 'complex_reasoning', description: 'Deep reasoning, multi-step analysis, logic' },
      { id: 'fast_qa', description: 'Rapid answers, definitions, translations' },
      { id: 'creative', description: 'Writing, drafting, storytelling' },
      { id: 'math', description: 'Mathematical reasoning, equations, calculations' },
    ],
  });
});

// Setup Frontend UI / Dev server
async function setupFrontend() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }
}

setupFrontend().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AI Backend API] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[AI Backend API] Health check: http://0.0.0.0:${PORT}/api/health`);
    console.log(`[AI Backend API] Chat endpoint: http://0.0.0.0:${PORT}/api/chat`);
  });
});
