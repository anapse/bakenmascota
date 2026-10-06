import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  Send,
  Zap,
  ShieldCheck,
  Cpu,
  Layers,
  Code2,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Terminal,
  Clock,
  Sparkles,
  AlertCircle,
  FileCode,
  ArrowRight,
  ChevronRight,
  Radio,
} from 'lucide-react';
import { ChatResponseBody, HealthCheckResponse, TaskType } from './ai/types.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<'tester' | 'health' | 'export' | 'integration'>('tester');
  const [prompt, setPrompt] = useState<string>('Escribe una función en TypeScript para calcular el debounce de una llamada de API.');
  const [systemInstruction, setSystemInstruction] = useState<string>('Eres un asistente técnico conciso y preciso.');
  const [taskType, setTaskType] = useState<TaskType>('auto');
  const [model, setModel] = useState<string>('auto');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<ChatResponseBody | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Health check state
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(false);

  // Copy helpers
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [clientWorkerUrl, setClientWorkerUrl] = useState<string>('https://ai-backend-api.tu-usuario.workers.dev');

  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthData(data);
    } catch (err: unknown) {
      console.error('Health check failed:', err);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSendChat = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setErrorMessage(null);
    setResponse(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          systemInstruction: systemInstruction.trim() || undefined,
          taskType,
          model,
          temperature,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}: Error al procesar`);
      }
      setResponse(data);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || 'Error de conexión con el backend.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Code snippets for the other application
  const jsFetchSnippet = `// En tu otra aplicación (Frontend o Backend)
const BACKEND_URL = "${clientWorkerUrl || 'https://ai-backend-api.tu-usuario.workers.dev'}";

async function requestAI(promptText) {
  const response = await fetch(\`\${BACKEND_URL}/api/chat\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: promptText,
      taskType: 'auto', // Enrutamiento inteligente automático
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Error en la petición de IA');
  }

  const data = await response.json();
  console.log('Metadatos:', data.metadata); // Modelo usado, latencia, etc.
  return data.text; // Texto generado
}`;

  const curlSnippet = `curl -X POST "${clientWorkerUrl || 'https://ai-backend-api.tu-usuario.workers.dev'}/api/chat" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Explica la diferencia entre REST y GraphQL",
    "taskType": "auto",
    "temperature": 0.7
  }'`;

  const pythonSnippet = `import requests

BACKEND_URL = "${clientWorkerUrl || 'https://ai-backend-api.tu-usuario.workers.dev'}"

response = requests.post(
    f"{BACKEND_URL}/api/chat",
    json={
        "prompt": "¿Cuáles son las ventajas de una arquitectura serverless?",
        "taskType": "auto"
    }
)

if response.status_code == 200:
    data = response.json()
    print("Respuesta:", data["text"])
    print("Modelo usado:", data["metadata"]["model"])
else:
    print("Error:", response.json().get("error"))`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-lg text-white tracking-tight">AI Backend API</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                Cloudflare Ready
              </span>
            </div>
            <p className="text-xs text-slate-400">Stateless Edge AI Service · Smart Routing · Auto Fallback</p>
          </div>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-4">
          <button
            onClick={fetchHealth}
            disabled={healthLoading}
            className="flex items-center gap-2 text-xs bg-slate-800/80 hover:bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700/60 transition"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                healthData?.status === 'ok' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>Status: {healthData?.status === 'ok' ? 'Online' : 'Checking'}</span>
            <RefreshCw className={`w-3 h-3 text-slate-400 ${healthLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto p-4 sm:p-6 gap-6">
        {/* Sidebar Navigation */}
        <nav className="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col gap-2 p-1.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <button
            onClick={() => setActiveTab('tester')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition text-left flex-1 lg:flex-initial ${
              activeTab === 'tester'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>API Playground</span>
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition text-left flex-1 lg:flex-initial ${
              activeTab === 'health'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Health & Modelos</span>
          </button>

          <button
            onClick={() => setActiveTab('integration')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition text-left flex-1 lg:flex-initial ${
              activeTab === 'integration'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Conectar otra App</span>
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition text-left flex-1 lg:flex-initial ${
              activeTab === 'export'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            <span>Despliegue Cloudflare</span>
          </button>
        </nav>

        {/* Tab Views */}
        <main className="flex-1 min-w-0">
          {/* TAB 1: API PLAYGROUND */}
          {activeTab === 'tester' && (
            <div className="space-y-6">
              {/* Architecture Highlights Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">100% Stateless</div>
                    <div className="text-[11px] text-slate-400">Sin persistencia en BD</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Enrutamiento Inteligente</div>
                    <div className="text-[11px] text-slate-400">Selecciona el modelo por intención</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Fallback Automático</div>
                    <div className="text-[11px] text-slate-400">Gemini 3.8 → Gemini 3.1 Lite</div>
                  </div>
                </div>
              </div>

              {/* Playground Form */}
              <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-base font-semibold text-white">Probar Endpoint POST /api/chat</h2>
                  </div>
                  <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700">
                    POST /api/chat
                  </span>
                </div>

                {/* Prompt Input */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Prompt / Pregunta del Usuario <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    placeholder="Escribe la consulta que tu otra aplicación enviará a la API..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition resize-none"
                  />
                </div>

                {/* Optional Controls Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Tipo de Pregunta (taskType)
                    </label>
                    <select
                      value={taskType}
                      onChange={(e) => setTaskType(e.target.value as TaskType)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="auto">auto (Detección Inteligente)</option>
                      <option value="coding">coding (Programación/Código)</option>
                      <option value="fast_qa">fast_qa (Respuesta Rápida/Simple)</option>
                      <option value="complex_reasoning">complex_reasoning (Razonamiento)</option>
                      <option value="math">math (Matemáticas)</option>
                      <option value="creative">creative (Creativo/Redacción)</option>
                      <option value="general">general (General)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Modelo Forzado (opcional)
                    </label>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="auto">auto (Ruta Óptima)</option>
                      <option value="gemini-3.8-flash">gemini-3.8-flash (Recomendado)</option>
                      <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra Rápido)</option>
                      <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Avanzado)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-medium text-slate-400">Temperatura</label>
                      <span className="text-xs font-mono text-slate-300">{temperature}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                {/* System Instruction (Collapsible/Optional) */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    System Instruction (Opcional)
                  </label>
                  <input
                    type="text"
                    value={systemInstruction}
                    onChange={(e) => setSystemInstruction(e.target.value)}
                    placeholder="Instrucciones del sistema (ej: Responde en formato JSON, sé conciso...)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Action button */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPrompt('Explícame en 2 párrafos qué es Cloudflare Workers y por qué es tan rápido.')}
                      className="text-[11px] bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-md border border-slate-700/60 transition"
                    >
                      Ejemplo: Q&A
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrompt('Crea una función regex en JavaScript para validar números de teléfono internacionales.')}
                      className="text-[11px] bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-md border border-slate-700/60 transition"
                    >
                      Ejemplo: Coding
                    </button>
                  </div>

                  <button
                    onClick={handleSendChat}
                    disabled={loading || !prompt.trim()}
                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-medium text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/25 transition cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Generando respuesta...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Enviar Petición</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-semibold text-rose-200">Error en la llamada de API</div>
                    <div>{errorMessage}</div>
                  </div>
                </div>
              )}

              {/* Response Section */}
              {response && (
                <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                  {/* Metadata Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold text-slate-200">Respuesta de la API</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                        Modelo: {response.metadata.model}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                        Tipo: {response.metadata.taskType}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {response.metadata.latencyMs}ms
                      </span>
                      {response.metadata.fallbackTriggered && (
                        <span className="px-2.5 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800/60">
                          Fallback Activado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Generated Output */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                    {response.text}
                  </div>

                  {/* JSON Raw Response Inspector */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                      <span>Estructura JSON cruda devuelta a tu otra aplicación:</span>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(response, null, 2), 'response-json')}
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-300 transition"
                      >
                        {copiedKey === 'response-json' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'response-json' ? 'Copiado' : 'Copiar JSON'}</span>
                      </button>
                    </div>
                    <pre className="bg-slate-950/80 p-3 rounded-lg border border-slate-900 text-[11px] font-mono text-slate-400 overflow-x-auto">
                      {JSON.stringify(response, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: HEALTH & MODELS */}
          {activeTab === 'health' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-white">Estado del Servicio y Proveedores</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Endpoint GET /api/health</p>
                  </div>
                  <button
                    onClick={fetchHealth}
                    className="flex items-center gap-1.5 text-xs bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg hover:bg-indigo-600/30 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin' : ''}`} />
                    <span>Actualizar Estado</span>
                  </button>
                </div>

                {/* Health Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                    <div className="text-xs text-slate-400">Estado General</div>
                    <div className="text-lg font-semibold text-emerald-400 mt-1 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      {healthData?.status?.toUpperCase() || 'OK'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Servicio: {healthData?.service}</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                    <div className="text-xs text-slate-400">Proveedor Principal</div>
                    <div className="text-lg font-semibold text-indigo-400 mt-1">Google Gemini</div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      API Key: {healthData?.providers.gemini.configured ? 'Configurada ✓' : 'Faltante ⚠'}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                    <div className="text-xs text-slate-400">Cadena de Fallback</div>
                    <div className="text-sm font-semibold text-slate-200 mt-1">
                      gemini-3.8-flash → gemini-3.1-flash-lite
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Respaldo automático sin caídas</div>
                  </div>
                </div>

                {/* Model Catalog */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Modelos Disponibles y Enrutamiento
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-slate-200">gemini-3.8-flash</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                          Modelo Primario
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Modelo estrella de alta velocidad y gran capacidad de razonamiento. Ideal para código, razonamiento lógico, matemáticas y tareas generales.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-slate-200">gemini-3.1-flash-lite</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                          Fallback & Q&A Rápido
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Modelo ultra liviano y económico con latencia mínima. Se activa automáticamente para preguntas rápidas o si el modelo principal falla.
                      </p>
                    </div>
                  </div>
                </div>

                {/* CORS & Security */}
                <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-900/40 text-xs text-indigo-300 space-y-1">
                  <div className="font-semibold text-indigo-200 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    CORS y Seguridad Protegidos
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Las cabeceras CORS (`Access-Control-Allow-Origin: *`, `OPTIONS preflight`) están habilitadas para que tu otra aplicación web o móvil pueda consumir este backend sin bloqueos de navegador.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONECTAR OTRA APLICACIÓN */}
          {activeTab === 'integration' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-white">Conexión con tu Otra Aplicación</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Copia estos fragmentos de código listos para producción en tu proyecto existente.
                  </p>
                </div>

                {/* Worker URL configuration input */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    URL de tu Backend / Cloudflare Worker:
                  </label>
                  <input
                    type="text"
                    value={clientWorkerUrl}
                    onChange={(e) => setClientWorkerUrl(e.target.value)}
                    placeholder="https://ai-backend-api.tu-usuario.workers.dev"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    (Cuando despliegues en Cloudflare, introduce aquí tu dominio .workers.dev para actualizar los ejemplos automáticamente)
                  </span>
                </div>

                {/* JavaScript / TypeScript Fetch */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Code2 className="w-4 h-4 text-indigo-400" />
                      JavaScript / TypeScript (Fetch API)
                    </span>
                    <button
                      onClick={() => copyToClipboard(jsFetchSnippet, 'js-snippet')}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-300 transition"
                    >
                      {copiedKey === 'js-snippet' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'js-snippet' ? 'Copiado' : 'Copiar Código'}</span>
                    </button>
                  </div>
                  <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
                    {jsFetchSnippet}
                  </pre>
                </div>

                {/* cURL Snippet */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-amber-400" />
                      cURL (Terminal / Backend)
                    </span>
                    <button
                      onClick={() => copyToClipboard(curlSnippet, 'curl-snippet')}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-300 transition"
                    >
                      {copiedKey === 'curl-snippet' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'curl-snippet' ? 'Copiado' : 'Copiar cURL'}</span>
                    </button>
                  </div>
                  <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-amber-300/90 overflow-x-auto leading-relaxed">
                    {curlSnippet}
                  </pre>
                </div>

                {/* Python Snippet */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-emerald-400" />
                      Python (requests)
                    </span>
                    <button
                      onClick={() => copyToClipboard(pythonSnippet, 'python-snippet')}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-300 transition"
                    >
                      {copiedKey === 'python-snippet' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'python-snippet' ? 'Copiado' : 'Copiar Python'}</span>
                    </button>
                  </div>
                  <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
                    {pythonSnippet}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DESPLIEGUE EN CLOUDFLARE */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-white">Instrucciones de Despliegue en Cloudflare Workers</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Este proyecto ha sido preparado con archivos 100% compatibles con Cloudflare Workers.
                  </p>
                </div>

                {/* Key Files Summary */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Archivos a Exportar de este Proyecto:
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                      <FileCode className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">worker/index.ts</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Código ejecutable en el Edge de Cloudflare con Fetch API, CORS y llamadas a Gemini.
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                      <FileCode className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">wrangler.toml</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Configuración de Wrangler lista para desplegar en 1 comando.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Steps Accordion / List */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Paso a Paso para Desplegar:
                  </h3>

                  <div className="space-y-3 text-xs text-slate-300">
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                      <div className="font-semibold text-indigo-300 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-mono text-[11px]">
                          1
                        </span>
                        Configura el Secreto en Cloudflare
                      </div>
                      <p className="text-slate-400">
                        Tu API Key de Gemini debe guardarse como secreto en Cloudflare para que nunca quede expuesta:
                      </p>
                      <pre className="bg-slate-900 p-2.5 rounded-md font-mono text-[11px] text-indigo-200">
                        npx wrangler secret put GEMINI_API_KEY
                      </pre>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                      <div className="font-semibold text-indigo-300 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-mono text-[11px]">
                          2
                        </span>
                        Despliega tu Worker
                      </div>
                      <p className="text-slate-400">
                        Ejecuta el comando de despliegue desde la raíz del proyecto:
                      </p>
                      <pre className="bg-slate-900 p-2.5 rounded-md font-mono text-[11px] text-emerald-300">
                        npx wrangler deploy
                      </pre>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                      <div className="font-semibold text-indigo-300 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-mono text-[11px]">
                          3
                        </span>
                        Conecta tu Otra Aplicación
                      </div>
                      <p className="text-slate-400">
                        Cloudflare te devolverá una URL como <code className="text-slate-200">https://ai-backend-api.tu-usuario.workers.dev</code>. Reemplázala en la configuración de tu otra aplicación para empezar a hacer llamadas.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detailed Guide Notice */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Puedes consultar la guía completa y detallada en el archivo <strong className="text-slate-200">DEPLOYMENT_GUIDE.md</strong>.
                  </span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
