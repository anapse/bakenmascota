/**
 * Cloudflare Worker Entrypoint: AI Backend API
 *
 * Deployable directly to Cloudflare Workers via Wrangler or the Cloudflare Dashboard.
 * Completely stateless, high-performance, edge-ready AI proxy with intelligent model routing and automatic fallback.
 */

export interface Env {
  GEMINI_API_KEY?: string;
  ALLOWED_ORIGIN?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  API_SECRET_KEY?: string; // Optional secret token if you want to restrict calls from your other app
}

export interface ChatMessage {
  role: 'user' | 'model' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequestBody {
  prompt?: string;
  messages?: ChatMessage[];
  systemInstruction?: string;
  model?: string;
  taskType?: 'auto' | 'general' | 'coding' | 'complex_reasoning' | 'fast_qa' | 'creative' | 'math';
  temperature?: number;
  maxTokens?: number;
}

// Helper: Add CORS headers to any Response
function corsResponse(response: Response, env: Env, reqOrigin?: string | null): Response {
  const allowed = env.ALLOWED_ORIGIN || reqOrigin || '*';
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', allowed === '*' ? '*' : reqOrigin || allowed);
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-app-token, User-Agent');
  newHeaders.set('Access-Control-Max-Age', '86400');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// Helper: JSON response with CORS
function jsonResponse(data: unknown, status = 200, env: Env, reqOrigin?: string | null): Response {
  const res = new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
  return corsResponse(res, env, reqOrigin);
}

// Prompt Classifier for Intelligent Model Routing
function classifyPrompt(prompt: string): string {
  const text = prompt.toLowerCase().trim();

  if (text.length < 80 && (
    text.startsWith('what is ') ||
    text.startsWith('define ') ||
    text.startsWith('sinónimo de ') ||
    text.startsWith('significado de ') ||
    text.startsWith('capital of ') ||
    text.startsWith('translate ') ||
    text.startsWith('traduce ') ||
    /^(yes|no|si|no)\??$/i.test(text)
  )) {
    return 'fast_qa';
  }

  const codePatterns = [
    /\b(function|const|let|var|class|import|export|interface|type|def |return|async|await)\b/,
    /\b(javascript|typescript|python|rust|golang|c\+\+|sql|postgres|mysql|html|css|json|yaml)\b/,
    /\b(bug|error|exception|stacktrace|refactor|compile|regex|algorithm|api|endpoint|git|docker)\b/,
    /[{};<>\[\]=_]{3,}/,
  ];
  for (const pattern of codePatterns) {
    if (pattern.test(text)) return 'coding';
  }

  const mathPatterns = [
    /\b(calculate|solve|equation|integral|derivative|matrix|vector|probability|statistic|logarithm)\b/,
    /\b(calcula|resuelve|ecuación|derivada|integral|matriz|probabilidad|estadística)\b/,
    /\d+\s*[\+\-\*\/\^\%]\s*\d+/,
  ];
  for (const pattern of mathPatterns) {
    if (pattern.test(text)) return 'math';
  }

  const reasoningPatterns = [
    /\b(analyze|compare|contrast|step by step|proof|theorem|implication|architectural|pros and cons)\b/,
    /\b(analiza|compara|contrasta|paso a paso|demostración|teorema|pros y contras|profundidad)\b/,
    /\b(why does|how come|explain in detail|explica en detalle)\b/,
  ];
  for (const pattern of reasoningPatterns) {
    if (pattern.test(text)) return 'complex_reasoning';
  }

  const creativePatterns = [
    /\b(write a story|poem|essay|draft|compose|creative|fiction|roleplay|script|blog post)\b/,
    /\b(escribe una historia|poema|ensayo|redacta|guion|novela|cuento|canción)\b/,
  ];
  for (const pattern of creativePatterns) {
    if (pattern.test(text)) return 'creative';
  }

  return 'general';
}

function routeModel(requestedModel?: string, requestedTaskType?: string, promptText: string = ''): {
  taskType: string;
  primaryModel: string;
  fallbackModel: string;
  reasoning: string;
} {
  const taskType = (!requestedTaskType || requestedTaskType === 'auto')
    ? classifyPrompt(promptText)
    : requestedTaskType;

  if (requestedModel && requestedModel !== 'auto') {
    const fallback = requestedModel === 'gemini-3.8-flash' ? 'gemini-3.1-flash-lite' : 'gemini-3.8-flash';
    return {
      taskType,
      primaryModel: requestedModel,
      fallbackModel: fallback,
      reasoning: `Explicit model requested: ${requestedModel}`,
    };
  }

  switch (taskType) {
    case 'fast_qa':
      return {
        taskType: 'fast_qa',
        primaryModel: 'gemini-3.1-flash-lite',
        fallbackModel: 'gemini-3.8-flash',
        reasoning: 'Fast Q&A: selected gemini-3.1-flash-lite for ultra-fast response',
      };
    case 'coding':
    case 'complex_reasoning':
    case 'math':
    case 'creative':
    case 'general':
    default:
      return {
        taskType,
        primaryModel: 'gemini-3.8-flash',
        fallbackModel: 'gemini-3.1-flash-lite',
        reasoning: `${taskType} query: selected primary gemini-3.8-flash with gemini-3.1-flash-lite fallback`,
      };
  }
}

// Call Google Gemini via REST API (Edge compatible)
async function callGemini(
  model: string,
  messages: ChatMessage[],
  systemInstruction: string | undefined,
  apiKey: string,
  temperature?: number,
  maxTokens?: number
): Promise<{ text: string; latencyMs: number }> {
  const startTime = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : m.role,
    parts: [{ text: m.content }],
  }));

  const payload: Record<string, unknown> = { contents };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const generationConfig: Record<string, unknown> = {};
  if (typeof temperature === 'number') generationConfig.temperature = temperature;
  if (typeof maxTokens === 'number') generationConfig.maxOutputTokens = maxTokens;
  if (Object.keys(generationConfig).length > 0) {
    payload.generationConfig = generationConfig;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'aistudio-build',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API HTTP ${res.status} (${model}): ${errText}`);
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
      return corsResponse(new Response(null, { status: 204 }), env, reqOrigin);
    }

    // Optional API Secret Token validation (if configured in env)
    if (env.API_SECRET_KEY) {
      const authHeader = request.headers.get('Authorization');
      const apiKeyHeader = request.headers.get('x-api-key');
      const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : apiKeyHeader;
      if (token !== env.API_SECRET_KEY && url.pathname !== '/api/health') {
        return jsonResponse({ success: false, error: 'Unauthorized: Invalid API secret token' }, 401, env, reqOrigin);
      }
    }

    // 2. GET /api/health
    if (request.method === 'GET' && url.pathname === '/api/health') {
      const isConfigured = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0);
      return jsonResponse(
        {
          status: isConfigured ? 'ok' : 'degraded',
          service: 'cloudflare-worker-ai-api',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          environment: 'cloudflare-worker',
          providers: {
            gemini: {
              configured: isConfigured,
              defaultModel: 'gemini-3.8-flash',
              fallbackModel: 'gemini-3.1-flash-lite',
            },
          },
          supportedModels: ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
          supportedTaskTypes: ['auto', 'general', 'coding', 'complex_reasoning', 'fast_qa', 'creative', 'math'],
        },
        isConfigured ? 200 : 503,
        env,
        reqOrigin
      );
    }

    // 3. GET /api/models
    if (request.method === 'GET' && url.pathname === '/api/models') {
      return jsonResponse(
        {
          primaryProvider: 'gemini',
          defaultModel: 'gemini-3.8-flash',
          fallbackModel: 'gemini-3.1-flash-lite',
          availableModels: [
            {
              id: 'gemini-3.8-flash',
              name: 'Gemini 3.8 Flash',
              description: 'Fast, high-reasoning flagship model for general, code, logic, and math.',
            },
            {
              id: 'gemini-3.1-flash-lite',
              name: 'Gemini 3.1 Flash Lite',
              description: 'Cost-efficient, ultra-low latency model for simple queries and default fallback.',
            },
          ],
        },
        200,
        env,
        reqOrigin
      );
    }

    // 4. POST /api/chat
    if (request.method === 'POST' && url.pathname === '/api/chat') {
      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        return jsonResponse(
          {
            success: false,
            error: 'Server configuration error: GEMINI_API_KEY secret is not set in Cloudflare Worker environment.',
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

      // Format messages
      const messages: ChatMessage[] = [];
      if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
        messages.push(...body.messages);
      } else if (body.prompt && body.prompt.trim()) {
        messages.push({ role: 'user', content: body.prompt.trim() });
      } else {
        return jsonResponse(
          { success: false, error: 'Missing required field: "prompt" or "messages" array.' },
          400,
          env,
          reqOrigin
        );
      }

      const latestPrompt = [...messages].reverse().find((m) => m.role === 'user')?.content || body.prompt || '';
      const route = routeModel(body.model, body.taskType, latestPrompt);

      let finalResultText = '';
      let finalModelUsed = route.primaryModel;
      let fallbackTriggered = false;
      let fallbackReason: string | undefined = undefined;
      const startTime = Date.now();

      // Primary model call
      try {
        const primaryRes = await callGemini(
          route.primaryModel,
          messages,
          body.systemInstruction,
          apiKey,
          body.temperature,
          body.maxTokens
        );
        finalResultText = primaryRes.text;
        finalModelUsed = route.primaryModel;
      } catch (primaryErr: unknown) {
        const pErr = primaryErr as Error;
        console.warn(`Primary model ${route.primaryModel} failed: ${pErr.message}. Trying fallback ${route.fallbackModel}...`);

        fallbackTriggered = true;
        fallbackReason = `Primary model ${route.primaryModel} failed: ${pErr.message}`;

        // Fallback model call
        try {
          const fallbackRes = await callGemini(
            route.fallbackModel,
            messages,
            body.systemInstruction,
            apiKey,
            body.temperature,
            body.maxTokens
          );
          finalResultText = fallbackRes.text;
          finalModelUsed = route.fallbackModel;
        } catch (fallbackErr: unknown) {
          const fErr = fallbackErr as Error;
          return jsonResponse(
            {
              success: false,
              error: `All AI models failed. Primary (${route.primaryModel}): ${pErr.message}. Fallback (${route.fallbackModel}): ${fErr.message}`,
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
            requestedModel: body.model,
            taskType: route.taskType,
            fallbackTriggered,
            fallbackReason,
            latencyMs: totalLatency,
            timestamp: new Date().toISOString(),
          },
        },
        200,
        env,
        reqOrigin
      );
    }

    // Default 404
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
