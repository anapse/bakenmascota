import { ModelName, TaskType } from './types.ts';

export interface RouteDecision {
  taskType: TaskType;
  primaryModel: ModelName;
  fallbackModel: ModelName;
  reasoning: string;
}

const DEFAULT_PRIMARY_MODEL: ModelName = 'gemini-3.8-flash';
const DEFAULT_FALLBACK_MODEL: ModelName = 'gemini-3.1-flash-lite';

/**
 * Heuristic classifier to detect question category when set to 'auto'.
 */
export function classifyPrompt(prompt: string): TaskType {
  const text = prompt.toLowerCase().trim();

  // Fast Q&A / Simple queries: very short queries or simple definitions
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

  // Coding & Technical queries
  const codePatterns = [
    /\b(function|const|let|var|class|import|export|interface|type|def |return|async|await)\b/,
    /\b(javascript|typescript|python|rust|golang|c\+\+|sql|postgres|mysql|html|css|json|yaml)\b/,
    /\b(bug|error|exception|stacktrace|refactor|compile|regex|algorithm|api|endpoint|git|docker)\b/,
    /[{};<>\[\]=_]{3,}/, // Code symbol density
  ];

  for (const pattern of codePatterns) {
    if (pattern.test(text)) {
      return 'coding';
    }
  }

  // Math & Logic queries
  const mathPatterns = [
    /\b(calculate|solve|equation|integral|derivative|matrix|vector|probability|statistic|logarithm)\b/,
    /\b(calcula|resuelve|ecuación|derivada|integral|matriz|probabilidad|estadística)\b/,
    /\d+\s*[\+\-\*\/\^\%]\s*\d+/,
  ];

  for (const pattern of mathPatterns) {
    if (pattern.test(text)) {
      return 'math';
    }
  }

  // Complex reasoning & Deep analysis
  const reasoningPatterns = [
    /\b(analyze|compare|contrast|step by step|proof|theorem|implication|architectural|pros and cons)\b/,
    /\b(analiza|compara|contrasta|paso a paso|demostración|teorema|pros y contras|profundidad)\b/,
    /\b(why does|how come|explain in detail|explica en detalle)\b/,
  ];

  for (const pattern of reasoningPatterns) {
    if (pattern.test(text)) {
      return 'complex_reasoning';
    }
  }

  // Creative tasks
  const creativePatterns = [
    /\b(write a story|poem|essay|draft|compose|creative|fiction|roleplay|script|blog post)\b/,
    /\b(escribe una historia|poema|ensayo|redacta|guion|novela|cuento|canción)\b/,
  ];

  for (const pattern of creativePatterns) {
    if (pattern.test(text)) {
      return 'creative';
    }
  }

  return 'general';
}

/**
 * Resolves the optimal primary model and fallback model based on request parameters and prompt analysis.
 */
export function resolveModelRoute(
  requestedModel?: ModelName | 'auto',
  requestedTaskType?: TaskType,
  promptText: string = ''
): RouteDecision {
  // Determine task type
  const effectiveTaskType: TaskType = (!requestedTaskType || requestedTaskType === 'auto')
    ? classifyPrompt(promptText)
    : requestedTaskType;

  // If user explicitly specified a valid model (and not 'auto'), respect their choice
  if (requestedModel && requestedModel !== 'auto') {
    const fallback = requestedModel === DEFAULT_PRIMARY_MODEL ? DEFAULT_FALLBACK_MODEL : DEFAULT_PRIMARY_MODEL;
    return {
      taskType: effectiveTaskType,
      primaryModel: requestedModel,
      fallbackModel: fallback,
      reasoning: `Explicit model requested: ${requestedModel}`,
    };
  }

  // Route by task type
  switch (effectiveTaskType) {
    case 'fast_qa':
      return {
        taskType: 'fast_qa',
        primaryModel: 'gemini-3.1-flash-lite',
        fallbackModel: 'gemini-3.8-flash',
        reasoning: 'Fast Q&A detected: selected gemini-3.1-flash-lite for minimal latency and cost efficiency.',
      };

    case 'coding':
      return {
        taskType: 'coding',
        primaryModel: 'gemini-3.8-flash',
        fallbackModel: 'gemini-3.1-flash-lite',
        reasoning: 'Coding query detected: selected gemini-3.8-flash for code precision and syntax adherence.',
      };

    case 'math':
    case 'complex_reasoning':
      return {
        taskType: effectiveTaskType,
        primaryModel: 'gemini-3.8-flash',
        fallbackModel: 'gemini-3.1-flash-lite',
        reasoning: `${effectiveTaskType} detected: selected gemini-3.8-flash for multi-step reasoning capabilities.`,
      };

    case 'creative':
      return {
        taskType: 'creative',
        primaryModel: 'gemini-3.8-flash',
        fallbackModel: 'gemini-3.1-flash-lite',
        reasoning: 'Creative writing task detected: selected gemini-3.8-flash for expressive generation.',
      };

    case 'general':
    default:
      return {
        taskType: 'general',
        primaryModel: DEFAULT_PRIMARY_MODEL,
        fallbackModel: DEFAULT_FALLBACK_MODEL,
        reasoning: 'General task: selected standard default gemini-3.8-flash.',
      };
  }
}
