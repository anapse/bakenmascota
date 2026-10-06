import { IAIProvider, ProviderGenerateOptions, ProviderGenerateResult } from './types.ts';

export interface CloudflareWorkersAIConfig {
  accountId?: string;
  apiToken?: string;
  aiBinding?: {
    run(model: string, input: Record<string, unknown>): Promise<{ response?: string }>;
  };
}

/**
 * Adapter for Cloudflare Workers AI (both via Worker `env.AI` binding or Cloudflare REST API)
 */
export class CloudflareWorkersAIProvider implements IAIProvider {
  public readonly id = 'cloudflare-ai';
  public readonly name = 'Cloudflare Workers AI';
  private accountId?: string;
  private apiToken?: string;
  private aiBinding?: CloudflareWorkersAIConfig['aiBinding'];

  constructor(config: CloudflareWorkersAIConfig = {}) {
    this.accountId = config.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = config.apiToken || process.env.CLOUDFLARE_API_TOKEN;
    this.aiBinding = config.aiBinding;
  }

  public isConfigured(): boolean {
    return Boolean(this.aiBinding || (this.accountId && this.apiToken));
  }

  public async generate(options: ProviderGenerateOptions): Promise<ProviderGenerateResult> {
    const startTime = Date.now();
    const model = options.model || '@cf/meta/llama-3.1-8b-instruct';

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

    // If running directly inside Cloudflare Worker with AI binding:
    if (this.aiBinding) {
      const res = await this.aiBinding.run(model, {
        messages,
        max_tokens: options.maxTokens ?? 1024,
      });
      return {
        text: res.response || '',
        provider: this.id,
        model,
        latencyMs: Date.now() - startTime,
      };
    }

    // Else run via Cloudflare REST API
    if (!this.accountId || !this.apiToken) {
      throw new Error('Cloudflare Workers AI requires env.AI binding or CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN.');
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${model}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiToken}`,
      },
      body: JSON.stringify({
        messages,
        max_tokens: options.maxTokens ?? 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[Cloudflare Workers AI] HTTP ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      result?: {
        response?: string;
      };
    };

    return {
      text: data.result?.response || '',
      provider: this.id,
      model,
      latencyMs: Date.now() - startTime,
    };
  }
}
