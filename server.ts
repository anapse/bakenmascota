import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { AIService } from './src/ai/service.ts';
import { ECONOMIC_FAST_MODEL, HIGHER_REASONING_MODEL } from './src/ai/router.ts';
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

// Setup CORS Origin Validator
const customOrigins = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function checkOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // Server-to-server, curl, mobile apps
  if (customOrigins.includes('*')) return true;

  // Custom environment origins
  if (customOrigins.some((allowed) => origin === allowed || origin.startsWith(allowed))) {
    return true;
  }

  // Default allowed origins for GitHub Pages, Local dev, and AI Studio
  const isAllowedHost =
    origin.startsWith('https://anapse.github.io') ||
    origin.endsWith('.github.io') ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
    origin.endsWith('.run.app') ||
    (process.env.APP_URL && origin.startsWith(process.env.APP_URL));

  return Boolean(isAllowedHost);
}

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = checkOriginAllowed(origin);
      // Passing callback(null, allowed) avoids uncaught error crashes in Express
      callback(null, allowed);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-app-token', 'User-Agent'],
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));

// Optional API Secret validation middleware
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const secretKey = process.env.API_SECRET_KEY;
  if (!secretKey) return next();

  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : apiKeyHeader;

  if (!token || token !== secretKey.trim()) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing API secret token.',
    });
  }
  next();
};

// --- API ENDPOINTS ---

/**
 * Health Check Endpoint
 * GET /api/health (Always public)
 */
app.get('/api/health', (_req: Request, res: Response) => {
  const health = aiService.getHealth();
  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

/**
 * Chat & AI Generation Endpoint
 * POST /api/chat (Protected if API_SECRET_KEY configured)
 */
app.post('/api/chat', authMiddleware, async (req: Request, res: Response) => {
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
    defaultModel: ECONOMIC_FAST_MODEL,
    higherModel: HIGHER_REASONING_MODEL,
    availableModels: [
      {
        id: ECONOMIC_FAST_MODEL,
        name: 'Gemini 3.1 Flash Lite',
        role: 'Default Economic Model',
        description: 'Ultra-fast, cost-effective model used for general questions, demos, and simple Q&A.',
      },
      {
        id: HIGHER_REASONING_MODEL,
        name: 'Gemini 3.8 Flash',
        role: 'Higher Reasoning Model',
        description: 'Activated for coding queries, math, or complex analytical reasoning.',
      },
    ],
    routingMode: 'backend-governed',
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
