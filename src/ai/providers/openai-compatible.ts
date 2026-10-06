import { IAIProvider, ProviderGenerateOptions, ProviderGenerateResult } from './types.ts';

export interface OpenAICompatibleConfig {
  apiKey?: string;
  baseUrl?: string;
  providerId?: string;
  providerName?: string;
}

/**
 * Adapter for any OpenAI-compatible API endpoint (OpenAI, Groq, DeepSeek, OpenRouter, Together, Mistral, etc.)
 */
export class OpenAICompatibleProvider implements IAIProvider {
  public readonly id: string;
  public readonly name: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OpenAICompatibleConfig = {}) {
    this.id = config.providerId || 'openai-compatible';
    this.name = config.providerName || 'OpenAI Compatible';
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseUrl = config.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public async generate(options: ProviderGenerateOptions): Promise<ProviderGenerateResult> {
    if (!this.apiKey) {
      throw new Error(`API key for provider '${this.name}' is not configured.`);
    }

    const startTime = Date.now();
    const model = options.model || 'gpt-4o-mini';

    const messages = [];
    if (options.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }

    for (const msg of options.messages) {
      messages.push({
        role: msg.role === 'model' ? 'assistant' : msg.role,
        content: msg.content,
      });
    }

    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
    };

    if (options.maxTokens) {
      payload.max_tokens = options.maxTokens;
    }

    const endpoint = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[${this.name}] HTTP ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const text = data.choices?.[0]?.message?.content || '';
    const latencyMs = Date.now() - startTime;

    return {
      text,
      provider: this.id,
      model,
      latencyMs,
    };
  }
}
