import { ModelName, TaskType } from './types.ts';

export interface RouteDecision {
  taskType: TaskType;
  primaryModel: ModelName;
  fallbackModel: ModelName;
  reasoning: string;
}

export const ECONOMIC_FAST_MODEL: ModelName = 'gemini-3.1-flash-lite';
export const HIGHER_REASONING_MODEL: ModelName = 'gemini-3.8-flash';

/**
 * Heuristic classifier to detect question category.
 * Tailored for demo applications (MascoticasIA, interactive games, Q&A).
 */
export function classifyPrompt(prompt: string): TaskType {
  const text = prompt.toLowerCase().trim();

  // Fast Q&A, greetings, pet dialogs, simple definitions (< 100 chars)
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
 * Resolves the backend-governed model route.
 * Economic fast model by default for demo cost control.
 */
export function resolveModelRoute(
  requestedTaskType?: TaskType,
  promptText: string = ''
): RouteDecision {
  const effectiveTaskType: TaskType = (!requestedTaskType || requestedTaskType === 'auto')
    ? classifyPrompt(promptText)
    : requestedTaskType;

  switch (effectiveTaskType) {
    case 'coding':
      return {
        taskType: 'coding',
        primaryModel: HIGHER_REASONING_MODEL,
        fallbackModel: ECONOMIC_FAST_MODEL,
        reasoning: 'Coding query: selected higher reasoning model with economic fallback.',
      };

    case 'complex_reasoning':
    case 'math':
      return {
        taskType: effectiveTaskType,
        primaryModel: HIGHER_REASONING_MODEL,
        fallbackModel: ECONOMIC_FAST_MODEL,
        reasoning: `${effectiveTaskType} detected: selected higher reasoning model with economic fallback.`,
      };

    case 'creative':
      return {
        taskType: 'creative',
        primaryModel: ECONOMIC_FAST_MODEL,
        fallbackModel: HIGHER_REASONING_MODEL,
        reasoning: 'Creative query for demo: selected economic fast model.',
      };

    case 'fast_qa':
    case 'general':
    default:
      return {
        taskType: effectiveTaskType || 'general',
        primaryModel: ECONOMIC_FAST_MODEL,
        fallbackModel: HIGHER_REASONING_MODEL,
        reasoning: 'General demo query: selected economic fast model for minimal latency and cost efficiency.',
      };
  }
}
