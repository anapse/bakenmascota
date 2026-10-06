export type ModelName =
  | 'gemini-3.8-flash'
  | 'gemini-3.1-flash-lite'
  | 'gemini-3.1-pro-preview'
  | string;

export type TaskType =
  | 'auto'
  | 'general'
  | 'coding'
  | 'complex_reasoning'
  | 'fast_qa'
  | 'creative'
  | 'math';

export interface ChatMessage {
  role: 'user' | 'model' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequestBody {
  prompt?: string;
  messages?: ChatMessage[];
  systemInstruction?: string;
  model?: ModelName | 'auto';
  taskType?: TaskType;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponseMetadata {
  provider: string;
  model: string;
  requestedModel?: string;
  taskType: TaskType;
  fallbackTriggered: boolean;
  fallbackReason?: string;
  latencyMs: number;
  timestamp: string;
}

export interface ChatResponseBody {
  success: boolean;
  text: string;
  metadata: AIResponseMetadata;
  error?: string;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds?: number;
  environment: 'express' | 'cloudflare-worker';
  providers: {
    gemini: {
      configured: boolean;
      defaultModel: string;
      fallbackModel: string;
    };
    openaiCompatible?: {
      configured: boolean;
    };
    cloudflareWorkersAI?: {
      configured: boolean;
    };
  };
  supportedModels: string[];
  supportedTaskTypes: string[];
}
