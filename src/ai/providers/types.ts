import { ChatMessage, ModelName } from '../types.ts';

export interface ProviderGenerateOptions {
  model: ModelName;
  messages: ChatMessage[];
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderGenerateResult {
  text: string;
  provider: string;
  model: string;
  latencyMs: number;
}

export interface IAIProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  generate(options: ProviderGenerateOptions): Promise<ProviderGenerateResult>;
}
