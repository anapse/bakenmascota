import { GoogleGenAI } from '@google/genai';
import { IAIProvider, ProviderGenerateOptions, ProviderGenerateResult } from './types.ts';

export class GeminiProvider implements IAIProvider {
  public readonly id = 'gemini';
  public readonly name = 'Google Gemini';
  private apiKey: string;
  private client: GoogleGenAI | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    if (this.apiKey) {
      this.client = new GoogleGenAI({
        apiKey: this.apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public async generate(options: ProviderGenerateOptions): Promise<ProviderGenerateResult> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in the environment.');
    }

    const startTime = Date.now();
    const model = options.model || 'gemini-3.8-flash';

    // Format contents from messages
    // If only 1 user message, pass direct string or parts
    const contents = options.messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }],
    }));

    try {
      if (this.client) {
        // Preferred @google/genai SDK path
        const config: Record<string, unknown> = {};
        if (options.systemInstruction) {
          config.systemInstruction = options.systemInstruction;
        }
        if (typeof options.temperature === 'number') {
          config.temperature = options.temperature;
        }
        if (typeof options.maxTokens === 'number') {
          config.maxOutputTokens = options.maxTokens;
        }

        const response = await this.client.models.generateContent({
          model,
          contents,
          ...(Object.keys(config).length > 0 ? { config } : {}),
        });

        const text = response.text || '';
        const latencyMs = Date.now() - startTime;

        return {
          text,
          provider: this.id,
          model,
          latencyMs,
        };
      } else {
        // Direct REST fallback (useful for serverless / workers environments)
        return await this.generateViaFetch(options, startTime);
      }
    } catch (err: unknown) {
      const error = err as Error;
      throw new Error(`[Gemini Provider Error - ${model}]: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Direct REST fallback for standard edge / fetch runtimes like Cloudflare Workers.
   */
  public async generateViaFetch(options: ProviderGenerateOptions, startTime: number = Date.now()): Promise<ProviderGenerateResult> {
    const model = options.model || 'gemini-3.8-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const contents = options.messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }],
    }));

    const payload: Record<string, unknown> = {
      contents,
    };

    if (options.systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    const genConfig: Record<string, unknown> = {};
    if (typeof options.temperature === 'number') {
      genConfig.temperature = options.temperature;
    }
    if (typeof options.maxTokens === 'number') {
      genConfig.maxOutputTokens = options.maxTokens;
    }
    if (Object.keys(genConfig).length > 0) {
      payload.generationConfig = genConfig;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'aistudio-build',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API HTTP ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    const latencyMs = Date.now() - startTime;

    return {
      text,
      provider: this.id,
      model,
      latencyMs,
    };
  }
}
