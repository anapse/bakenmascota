/**
 * Cloudflare Worker Entrypoint: AI Backend API
 *
 * Designed as a secure, stateless, cost-optimized AI bridge for static applications
 * hosted on GitHub Pages (e.g., https://anapse.github.io/MascoticasIA/) and local dev.
 */

export interface Env {
  GEMINI_API_KEY?: string;
  ALLOWED_ORIGINS?: string;
  ALLOWED_ORIGIN?: string;
  API_SECRET_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequestBody {
  prompt?: string;
  messages?: ChatMessage[];
  systemInstruction?: string;
  taskType?: 'auto' | 'fast_qa' | 'general' | 'coding' | 'complex_reasoning' | 'math' | 'creative';
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// Allowed models allowlist (Backend-governed)
const ECONOMIC_FAST_MODEL = 'gemini-3.1-flash-lite';
const HIGHER_REASONING_MODEL = ECONOMIC_FAST_MODEL;
const ALLOWED_MODELS = [ECONOMIC_FAST_MODEL];

// Default allowed origins for GitHub Pages and local development
const DEFAULT_ALLOWED_ORIGINS = [
  'https://anapse.github.io',
  'http://localhost:3000',
  'http://localhost:5173',
];

// Abuse limits
const MAX_PROMPT_LENGTH = 4000;
const MAX_MESSAGES_COUNT = 10;
const MAX_MESSAGE_CONTENT_LENGTH = 4000;
const MAX_SYSTEM_INSTRUCTION_LENGTH = 2000;
const DEFAULT_MAX_TOKENS = 800;
const MAX_MAX_TOKENS = 2048;
const REQUEST_TIMEOUT_MS = 25000; // 25s timeout

/**
 * Resolves the list of allowed CORS origins from configuration and defaults.
 */
function getAllowedOrigins(env: Env): string[] {
  const customOrigins = env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN;
  if (!customOrigins) {
    return DEFAULT_ALLOWED_ORIGINS;
  }
  const parsed = customOrigins.split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS;
}

/**
 * Checks if the request origin matches allowed origins.
 */
function isOriginAllowed(origin: string | null, allowedList: string[]): boolean {
  if (!origin) return true;
  const normalized = origin.trim().replace(/\/+$/, '');
  return allowedList.some((allowed) => {
    if (allowed === '*') return true;
    if (normalized.startsWith('https://anapse.github.io') || normalized.endsWith('.github.io')) return true;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) return true;
    return normalized === allowed || normalized.startsWith(allowed);
  });
}

/**
 * Adds CORS headers to a Response object based on the incoming request Origin.
 */
function applyCors(response: Response, env: Env, reqOrigin?: string | null): Response {
  const allowedList = getAllowedOrigins(env);
  const newHeaders = new Headers(response.headers);

  if (reqOrigin && isOriginAllowed(reqOrigin, allowedList)) {
    newHeaders.set('Access-Control-Allow-Origin', reqOrigin);
    newHeaders.set('Vary', 'Origin');
  } else if (allowedList.includes('*')) {
    newHeaders.set('Access-Control-Allow-Origin', '*');
  }

  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-app-token');
  newHeaders.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Helper to build JSON responses with CORS headers.
 */
function jsonResponse(data: unknown, status = 200, env: Env, reqOrigin?: string | null): Response {
  const res = new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
  return applyCors(res, env, reqOrigin);
}

/**
 * Prompt Classifier for Cost-Controlled Intelligent Routing.
 * Prioritizes the economical/fast model for simple demos, greetings, general questions, and definitions.
 */
function classifyPrompt(prompt: string): 'fast_qa' | 'general' | 'coding' | 'complex_reasoning' | 'math' | 'creative' {
  const text = prompt.toLowerCase().trim();

  // Greetings, short chit-chat, simple queries (< 100 chars) -> fast_qa (economic)
  if (
    text.length < 100 &&
    (text.startsWith('hola') ||
      text.startsWith('hey') ||
      text.startsWith('hello') ||
      text.startsWith('buenos días') ||
      text.startsWith('buenas') ||
      text.startsWith('qué tal') ||
      text.startsWith('que tal') ||
      text.startsWith('cómo estás') ||
      text.startsWith('como estas') ||
      text.startsWith('qué eres') ||
      text.startsWith('que eres') ||
      text.startsWith('quién eres') ||
      text.startsWith('quien eres') ||
      text.startsWith('what is ') ||
      text.startsWith('define ') ||
      text.startsWith('sinónimo') ||
      text.startsWith('significado') ||
      text.startsWith('capital de') ||
      text.startsWith('traduce') ||
      text.startsWith('translate') ||
      /^(si|no|yes|no|ok|vale|bien|gracias)\b/i.test(text))
  ) {
    return 'fast_qa';
  }

  // Coding patterns
  const codePatterns = [
    /\b(function|const|let|var|class|import|export|interface|type|def |return|async|await)\b/,
    /\b(javascript|typescript|python|rust|golang|c\+\+|sql|postgres|mysql|html|css|json|yaml)\b/,
    /\b(bug|error|exception|stacktrace|refactor|compile|regex|algorithm|api|endpoint|git|docker)\b/,
    /[{};<>\[\]=_]{4,}/,
  ];
  for (const pattern of codePatterns) {
    if (pattern.test(text)) return 'coding';
  }

  // Math calculation patterns
  const mathPatterns = [
    /\b(calculate|solve|equation|integral|derivative|matrix|vector|probability|statistic|logarithm)\b/,
    /\b(calcula|resuelve|ecuación|derivada|integral|matriz|probabilidad|estadística)\b/,
    /\d+\s*[\+\-\*\/\^\%]\s*\d+/,
  ];
  for (const pattern of mathPatterns) {
    if (pattern.test(text)) return 'math';
  }

  // Deep reasoning patterns
  const reasoningPatterns = [
    /\b(analyze in depth|compare and contrast|step by step proof|mathematical theorem|architectural trade-offs)\b/,
    /\b(analiza en profundidad|demostración paso a paso|teorema|pros y contras exhaustivos)\b/,
  ];
  for (const pattern of reasoningPatterns) {
    if (pattern.test(text)) return 'complex_reasoning';
  }

  // Creative writing
  const creativePatterns = [
    /\b(write a story|poem|essay|compose|fiction|roleplay|script)\b/,
    /\b(escribe una historia|poema|ensayo|cuento|canción|novela|guion)\b/,
  ];
  for (const pattern of creativePatterns) {
    if (pattern.test(text)) return 'creative';
  }

  return 'general';
}

/**
 * Backend-Governed Model Router:
 * Enforces economical/fast model by default for demos.
 * Client CANNOT force expensive models for simple queries.
 */
function resolveBackendRoute(
  requestedTaskType?: string,
  promptText: string = ''
): {
  taskType: string;
  primaryModel: string;
  fallbackModel: string;
  reasoning: string;
} {
  const taskType = !requestedTaskType || requestedTaskType === 'auto'
    ? classifyPrompt(promptText)
    : requestedTaskType;

  // Mascoticas IA uses only Gemini 3.1 Flash-Lite.
  // The task classifier remains useful for logging/analytics, but no task
  // is routed to a more expensive model.
  return {
    taskType: taskType || 'general',
    primaryModel: ECONOMIC_FAST_MODEL,
    fallbackModel: ECONOMIC_FAST_MODEL,
    reasoning: 'Mascoticas IA: Gemini 3.1 Flash-Lite only for all AI queries.',
  };
}

/**
 * Calls Google Gemini REST API with edge-compatible Fetch and AbortSignal timeout.
 */
async function callGeminiRest(
  model: string,
  messages: ChatMessage[],
  systemInstruction: string | undefined,
  apiKey: string,
  temperature?: number,
  maxTokens?: number
): Promise<{ text: string; latencyMs: number }> {
  const startTime = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : m.role,
    parts: [{ text: m.content }],
  }));

  const payload: Record<string, unknown> = { contents };

  if (systemInstruction && systemInstruction.trim()) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction.trim() }],
    };
  }

  const generationConfig: Record<string, unknown> = {};
  if (typeof temperature === 'number' && !isNaN(temperature)) {
    generationConfig.temperature = Math.min(Math.max(temperature, 0), 1.5);
  }
  if (typeof maxTokens === 'number' && !isNaN(maxTokens)) {
    generationConfig.maxOutputTokens = Math.min(Math.max(Math.floor(maxTokens), 1), MAX_MAX_TOKENS);
  } else {
    generationConfig.maxOutputTokens = DEFAULT_MAX_TOKENS;
  }

  payload.generationConfig = generationConfig;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'aistudio-build',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'No error body');
    throw new Error(`Gemini API HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  return {
    text,
    latencyMs: Date.now() - startTime,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const reqOrigin = request.headers.get('Origin');

    // 1. Handle CORS Preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
      const allowedList = getAllowedOrigins(env);
      if (reqOrigin && !isOriginAllowed(reqOrigin, allowedList) && !allowedList.includes('*')) {
        return new Response('CORS origin not allowed', { status: 403 });
      }
      return applyCors(new Response(null, { status: 204 }), env, reqOrigin);
    }

    // 2. Validate Optional API Secret Key for protected endpoints
    if (env.API_SECRET_KEY && env.API_SECRET_KEY.trim()) {
      if (url.pathname !== '/api/health') {
        const authHeader = request.headers.get('Authorization');
        const apiKeyHeader = request.headers.get('x-api-key');
        const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : apiKeyHeader?.trim();

        if (!token || token !== env.API_SECRET_KEY.trim()) {
          return jsonResponse(
            { success: false, error: 'Unauthorized: Invalid or missing API secret key.' },
            401,
            env,
            reqOrigin
          );
        }
      }
    }

    // 3. GET /api/health
    if (request.method === 'GET' && url.pathname === '/api/health') {
      const isConfigured = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0);
      return jsonResponse(
        {
          status: isConfigured ? 'ok' : 'degraded',
          service: 'cloudflare-worker-ai-backend',
          version: '1.1.0',
          timestamp: new Date().toISOString(),
          environment: 'cloudflare-worker',
          providers: {
            gemini: {
              configured: isConfigured,
              fastModel: ECONOMIC_FAST_MODEL,
              higherModel: HIGHER_REASONING_MODEL,
            },
          },
          supportedModels: ALLOWED_MODELS,
          costOptimization: 'gemini-3.1-flash-lite only',
        },
        isConfigured ? 200 : 503,
        env,
        reqOrigin
      );
    }

    // 4. GET /api/models
    if (request.method === 'GET' && url.pathname === '/api/models') {
      return jsonResponse(
        {
          defaultModel: ECONOMIC_FAST_MODEL,
          higherModel: HIGHER_REASONING_MODEL,
          availableModels: [
            {
              id: ECONOMIC_FAST_MODEL,
              name: 'Gemini 3.1 Flash Lite',
              role: 'Default Economic & Fast Model',
              description: 'Ultra-fast, low-cost model used for demo interactions, general chat, Q&A, and greetings.',
            },
            {
              id: HIGHER_REASONING_MODEL,
              name: 'Gemini 3.8 Flash',
              role: 'Higher Reasoning Model',
              description: 'Activated automatically for coding queries, math, or complex multi-step reasoning.',
            },
          ],
          routingMode: 'backend-governed',
        },
        200,
        env,
        reqOrigin
      );
    }

    // 5. POST /api/chat
    if (request.method === 'POST' && url.pathname === '/api/chat') {
      const apiKey = env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
        return jsonResponse(
          {
            success: false,
            error: 'Server error: GEMINI_API_KEY secret is not set in Cloudflare Worker configuration.',
          },
          500,
          env,
          reqOrigin
        );
      }

      let body: ChatRequestBody;
      try {
        body = (await request.json()) as ChatRequestBody;
      } catch {
        return jsonResponse({ success: false, error: 'Invalid JSON body in request.' }, 400, env, reqOrigin);
      }

      // Input extraction & validation
      const messages: ChatMessage[] = [];

      if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
        if (body.messages.length > MAX_MESSAGES_COUNT) {
          return jsonResponse(
            { success: false, error: `Exceeded maximum message count of ${MAX_MESSAGES_COUNT}.` },
            400,
            env,
            reqOrigin
          );
        }
        for (const msg of body.messages) {
          if (!msg || typeof msg.content !== 'string' || !msg.content.trim()) continue;
          if (msg.content.length > MAX_MESSAGE_CONTENT_LENGTH) {
            return jsonResponse(
              { success: false, error: `Individual message length exceeds ${MAX_MESSAGE_CONTENT_LENGTH} characters.` },
              400,
              env,
              reqOrigin
            );
          }
          messages.push({
            role: msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user',
            content: msg.content.trim(),
          });
        }
      } else if (body.prompt && typeof body.prompt === 'string' && body.prompt.trim()) {
        if (body.prompt.length > MAX_PROMPT_LENGTH) {
          return jsonResponse(
            { success: false, error: `Prompt length exceeds maximum allowed limit (${MAX_PROMPT_LENGTH} characters).` },
            400,
            env,
            reqOrigin
          );
        }
        messages.push({ role: 'user', content: body.prompt.trim() });
      } else {
        return jsonResponse(
          { success: false, error: 'Missing required field: "prompt" string or "messages" array.' },
          400,
          env,
          reqOrigin
        );
      }

      // System instruction limit
      let systemInstruction = body.systemInstruction;
      if (systemInstruction && typeof systemInstruction === 'string') {
        if (systemInstruction.length > MAX_SYSTEM_INSTRUCTION_LENGTH) {
          systemInstruction = systemInstruction.slice(0, MAX_SYSTEM_INSTRUCTION_LENGTH);
        }
      } else {
        systemInstruction = undefined;
      }

      // Backend-governed model routing (prevents clients from forcing expensive models on simple questions)
      const latestPrompt = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
      const route = resolveBackendRoute(body.taskType, latestPrompt);

      let finalResultText = '';
      let finalModelUsed = route.primaryModel;
      let fallbackTriggered = false;
      let fallbackReason: string | undefined = undefined;
      const startTime = Date.now();

      // Primary Model Call
      try {
        const primaryRes = await callGeminiRest(
          route.primaryModel,
          messages,
          systemInstruction,
          apiKey,
          body.temperature,
          body.maxTokens
        );
        finalResultText = primaryRes.text;
        finalModelUsed = route.primaryModel;
      } catch (primaryErr: unknown) {
        const pErr = primaryErr as Error;
        console.warn(`[AI Backend] Primary model (${route.primaryModel}) failed: ${pErr.message}. Executing fallback to ${route.fallbackModel}...`);

        fallbackTriggered = true;
        fallbackReason = `Primary model (${route.primaryModel}) unavailable. Reattempted with ${route.fallbackModel}.`;

        // Fallback Model Call
        try {
          const fallbackRes = await callGeminiRest(
            route.fallbackModel,
            messages,
            systemInstruction,
            apiKey,
            body.temperature,
            body.maxTokens
          );
          finalResultText = fallbackRes.text;
          finalModelUsed = route.fallbackModel;
        } catch (fallbackErr: unknown) {
          const fErr = fallbackErr as Error;
          console.error(`[AI Backend] Fallback model (${route.fallbackModel}) also failed: ${fErr.message}`);
          return jsonResponse(
            {
              success: false,
              error: 'AI service temporarily unavailable. Please try again in a few moments.',
            },
            502,
            env,
            reqOrigin
          );
        }
      }

      const totalLatency = Date.now() - startTime;

      return jsonResponse(
        {
          success: true,
          text: finalResultText,
          metadata: {
            provider: 'gemini',
            model: finalModelUsed,
            taskType: route.taskType,
            fallbackTriggered,
            ...(fallbackTriggered ? { fallbackReason } : {}),
            latencyMs: totalLatency,
          },
        },
        200,
        env,
        reqOrigin
      );
    }

    // 6. Default 404
    return jsonResponse(
      {
        success: false,
        error: `Endpoint '${url.pathname}' not found. Available endpoints: GET /api/health, GET /api/models, POST /api/chat`,
      },
      404,
      env,
      reqOrigin
    );
  },
};
