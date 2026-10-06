# Guía de Despliegue en Cloudflare Workers y Conexión de API

Este proyecto contiene un backend API de Inteligencia Artificial independiente, stateless y con alta disponibilidad, preparado para ser desplegado en **Cloudflare Workers**.

---

## 📁 Archivos Clave del Proyecto

Si deseas exportar este backend fuera de Google AI Studio, estos son los archivos esenciales:

| Archivo | Propósito |
| :--- | :--- |
| **`worker/index.ts`** | Código principal del Worker (API estándar Edge Fetch, enrutamiento, fallback, CORS, Gemini REST). |
| **`wrangler.toml`** | Archivo de configuración de Cloudflare Workers. |
| **`package.json`** | Dependencias y scripts del proyecto. |
| **`server.ts`** | Servidor Node.js / Express local para pruebas en desarrollo. |
| **`src/ai/*`** | Módulos desacoplados de proveedores, enrutador inteligente y tipos. |

> **Nota:** Para desplegar en Cloudflare Workers, **solo necesitas `worker/index.ts` y `wrangler.toml`** (o simplemente copiar el contenido de `worker/index.ts` en el editor del Dashboard de Cloudflare).

---

## 🚀 Cómo desplegar en Cloudflare Workers

Tienes **dos métodos sencillos**:

### Opción A: Usando Wrangler CLI (Recomendado)

1. **Instala Wrangler** (si no lo tienes):
   ```bash
   npm install -g wrangler
   # o usa npx wrangler directamente
   ```

2. **Inicia sesión en Cloudflare**:
   ```bash
   npx wrangler login
   ```

3. **Configura tu API Key de Gemini como Secreto seguro**:
   ```bash
   npx wrangler secret put GEMINI_API_KEY
   # Introduce tu clave de Gemini cuando te lo solicite en la terminal
   ```

4. **(Opcional) Configura token de acceso o CORS**:
   ```bash
   # Si deseas restringir qué origen puede conectarse (por defecto '*'):
   npx wrangler secret put ALLOWED_ORIGIN
   ```

5. **Despliega el Worker**:
   ```bash
   npx wrangler deploy
   ```

Cloudflare te devolverá la URL pública de tu API, por ejemplo:
`https://ai-backend-api.<tu-subdominio>.workers.dev`

---

### Opción B: Desde el Panel Web de Cloudflare (Sin terminal)

1. Entra en tu panel de **Cloudflare Dashboard** > **Workers & Pages** > **Create application** > **Create Worker**.
2. Asigna un nombre al Worker (ejemplo: `ai-backend-api`) y haz clic en **Deploy**.
3. Haz clic en **Edit code** y reemplaza todo el contenido con el código de `worker/index.ts`. Guarda y despliega.
4. Ve a la pestaña **Settings** > **Variables and Secrets**:
   - Haz clic en **Add**
   - Nombre: `GEMINI_API_KEY`
   - Valor: tu clave de Gemini
   - Tipo: **Secret** (Encriptado)
   - Guarda los cambios.

---

## 📡 Endpoints Disponibles

### 1. `GET /api/health`
Verifica el estado del servicio y configuración de los proveedores.

**Ejemplo de Respuesta (200 OK):**
```json
{
  "status": "ok",
  "service": "cloudflare-worker-ai-api",
  "version": "1.0.0",
  "timestamp": "2026-10-06T17:00:00.000Z",
  "environment": "cloudflare-worker",
  "providers": {
    "gemini": {
      "configured": true,
      "defaultModel": "gemini-3.8-flash",
      "fallbackModel": "gemini-3.1-flash-lite"
    }
  },
  "supportedModels": ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview"],
  "supportedTaskTypes": ["auto", "general", "coding", "complex_reasoning", "fast_qa", "creative", "math"]
}
```

---

### 2. `POST /api/chat`
Procesa preguntas de IA con enrutamiento inteligente y fallback automático.

**Cuerpo de la Petición (JSON):**
```json
{
  "prompt": "¿Cómo optimizar una consulta en PostgreSQL?",
  "systemInstruction": "Eres un arquitecto de bases de datos senior.",
  "taskType": "auto",
  "model": "auto",
  "temperature": 0.7
}
```

*Opcionalmente también acepta historial de conversación:*
```json
{
  "messages": [
    { "role": "user", "content": "Hola" },
    { "role": "assistant", "content": "¡Hola! ¿En qué puedo ayudarte?" },
    { "role": "user", "content": "Explícame qué es CORS" }
  ],
  "taskType": "coding"
}
```

**Respuesta Exitosa (200 OK):**
```json
{
  "success": true,
  "text": "CORS (Cross-Origin Resource Sharing) es un mecanismo...",
  "metadata": {
    "provider": "gemini",
    "model": "gemini-3.8-flash",
    "taskType": "coding",
    "fallbackTriggered": false,
    "latencyMs": 420,
    "timestamp": "2026-10-06T17:00:01.000Z"
  }
}
```

---

## 🔌 Cómo conectar tu OTRA aplicación a este Backend

En tu otra aplicación existente, solo debes hacer una llamada HTTP `POST` a la URL del Worker:

### En JavaScript / TypeScript (Frontend o Backend):

```typescript
const CLOUDFLARE_WORKER_URL = 'https://ai-backend-api.<tu-subdominio>.workers.dev';

async function askAI(userPrompt: string) {
  const response = await fetch(`${CLOUDFLARE_WORKER_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: userPrompt,
      taskType: 'auto', // 'auto' clasifica la pregunta para elegir el modelo óptimo
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Error en la respuesta de la IA');
  }

  const data = await response.json();
  return data.text; // Texto generado por el modelo
}
```

---

## 🛡️ Características Implementadas

- **Sin Estado (Stateless):** No guarda conversaciones ni en base de datos ni en memoria persistente.
- **Enrutamiento Inteligente:** Clasifica automáticamente la intención de la pregunta (`coding`, `math`, `complex_reasoning`, `fast_qa`, `creative`) y selecciona el modelo óptimo (`gemini-3.8-flash` o `gemini-3.1-flash-lite`).
- **Fallback de Alta Disponibilidad:** Si el modelo principal experimenta cualquier fallo o límite, el backend reintenta automáticamente con el modelo secundario de respaldo sin interrumpir al usuario.
- **CORS Habilitado:** Permite llamadas desde cualquier dominio o el dominio específico que configures en `ALLOWED_ORIGIN`.
- **Preparado para Múltiples Proveedores:** Arquitectura modular lista para añadir OpenAI, Groq, Anthropic o Cloudflare Workers AI.
