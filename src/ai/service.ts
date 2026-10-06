import { GeminiProvider } from './providers/gemini.ts';
import { OpenAICompatibleProvider } from './providers/openai-compatible.ts';
import { CloudflareWorkersAIProvider } from './providers/workers-ai.ts';
import { IAIProvider } from './providers/types.ts';
import { resolveModelRoute } from './router.ts';
import {
  ChatMessage,
  ChatRequestBody,
  ChatResponseBody,
  HealthCheckResponse,
  ModelName,
} from './types.ts';

export interface AIServiceConfig {
  geminiApiKey?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  environment?: 'express' | 'cloudflare-worker';
}

export class AIService {
  private geminiProvider: GeminiProvider;
  private openaiProvider: OpenAICompatibleProvider;
  private workersAiProvider: CloudflareWorkersAIProvider;
  private startTime: number = Date.now();
  private environment: 'express' | 'cloudflare-worker';

  constructor(config: AIServiceConfig = {}) {
    this.geminiProvider = new GeminiProvider(config.geminiApiKey);
    this.openaiProvider = new OpenAICompatibleProvider({
      apiKey: config.openaiApiKey,
      baseUrl: config.openaiBaseUrl,
    });
    this.workersAiProvider = new CloudflareWorkersAIProvider({
      accountId: config.cloudflareAccountId,
      apiToken: config.cloudflareApiToken,
    });
    this.environment = config.environment || 'express';
  }

  /**
   * Main chat processing pipeline with intelligent model routing and automatic fallback.
   * Completely stateless.
   */
  public async handleChat(body: ChatRequestBody): Promise<ChatResponseBody> {
    const overallStartTime = Date.now();

    // Normalize messages
    const messages: ChatMessage[] = [];
    if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
      messages.push(...body.messages);
    } else if (body.prompt && body.prompt.trim()) {
      messages.push({ role: 'user', content: body.prompt.trim() });
    } else {
      throw new Error('Missing prompt or messages array in request body.');
    }

    // Extract latest user text for intelligent routing
    const latestUserPrompt = [...messages].reverse().find((m) => m.role === 'user')?.content || body.prompt || '';

    // Route query to optimal model
    const route = resolveModelRoute(body.model, body.taskType, latestUserPrompt);
    const primaryModel: ModelName = route.primaryModel;
    const fallbackModel: ModelName = route.fallbackModel;

    let fallbackTriggered = false;
    let fallbackReason: string | undefined = undefined;
    let resultText = '';
    let finalModelUsed = primaryModel;
    let finalProviderUsed = 'gemini';

    // Step 1: Attempt generation with Primary Model
    try {
      const result = await this.geminiProvider.generate({
        model: primaryModel,
        messages,
        systemInstruction: body.systemInstruction,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
      });

      resultText = result.text;
      finalModelUsed = result.model;
      finalProviderUsed = result.provider;
    } catch (primaryErr: unknown) {
      const error = primaryErr as Error;
      console.warn(`[AI Service] Primary model (${primaryModel}) failed: ${error.message}. Initiating fallback to ${fallbackModel}...`);

      fallbackTriggered = true;
      fallbackReason = `Primary model ${primaryModel} failed: ${error.message}`;

      // Step 2: Attempt fallback with Fallback Model on Gemini
      try {
        const fallbackResult = await this.geminiProvider.generate({
          model: fallbackModel,
          messages,
          systemInstruction: body.systemInstruction,
          temperature: body.temperature,
          maxTokens: body.maxTokens,
        });

        resultText = fallbackResult.text;
        finalModelUsed = fallbackResult.model;
        finalProviderUsed = fallbackResult.provider;
      } catch (fallbackErr: unknown) {
        const fallbackError = fallbackErr as Error;
        console.error(`[AI Service] Fallback model (${fallbackModel}) also failed: ${fallbackError.message}`);

        // Step 3: Check if an alternative configured provider exists (OpenAI / Cloudflare AI)
        if (this.openaiProvider.isConfigured()) {
          try {
            console.log('[AI Service] Attempting secondary provider (OpenAI Compatible)...');
            const altResult = await this.openaiProvider.generate({
              model: 'gpt-4o-mini',
              messages,
              systemInstruction: body.systemInstruction,
              temperature: body.temperature,
              maxTokens: body.maxTokens,
            });
            resultText = altResult.text;
            finalModelUsed = altResult.model;
            finalProviderUsed = altResult.provider;
            fallbackReason += ` | Secondary fallback to OpenAI succeeded.`;
          } catch (altErr: unknown) {
            const finalErr = altErr as Error;
            throw new Error(`All providers and fallbacks failed. Primary: ${error.message}. Gemini Fallback: ${fallbackError.message}. Alt Provider: ${finalErr.message}`);
          }
        } else {
          throw new Error(`AI generation failed. Primary (${primaryModel}): ${error.message}. Fallback (${fallbackModel}): ${fallbackError.message}`);
        }
      }
    }

    const totalLatency = Date.now() - overallStartTime;

    return {
      success: true,
      text: resultText,
      metadata: {
        provider: finalProviderUsed,
        model: finalModelUsed,
        requestedModel: body.model,
        taskType: route.taskType,
        fallbackTriggered,
        fallbackReason,
        latencyMs: totalLatency,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Health check returning detailed system and provider readiness.
   */
  public getHealth(): HealthCheckResponse {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      status: this.geminiProvider.isConfigured() ? 'ok' : 'degraded',
      service: 'ai-backend-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      environment: this.environment,
      providers: {
        gemini: {
          configured: this.geminiProvider.isConfigured(),
          defaultModel: 'gemini-3.8-flash',
          fallbackModel: 'gemini-3.1-flash-lite',
        },
        openaiCompatible: {
          configured: this.openaiProvider.isConfigured(),
        },
        cloudflareWorkersAI: {
          configured: this.workersAiProvider.isConfigured(),
        },
      },
      supportedModels: [
        'gemini-3.8-flash',
        'gemini-3.1-flash-lite',
        'gemini-3.1-pro-preview',
      ],
      supportedTaskTypes: [
        'auto',
        'general',
        'coding',
        'complex_reasoning',
        'fast_qa',
        'creative',
        'math',
      ],
    };
  }
}
