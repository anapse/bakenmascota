# Guía de Despliegue en Cloudflare Workers y Conexión con Mascoticas IA

Backend de Inteligencia Artificial independiente, stateless y optimizado en costes para alimentar aplicaciones estáticas en **GitHub Pages** (como `https://anapse.github.io/MascoticasIA/`) y otras aplicaciones de ANAPSE.

---

## 📁 Archivos Clave del Repositorio

| Archivo | Propósito |
| :--- | :--- |
| **`worker/index.ts`** | Código principal del Worker para el Edge de Cloudflare (Fetch API nativo, CORS por lista blanca, enrutamiento económico, fallback y límites anti-abuso). |
| **`wrangler.toml`** | Configuración de despliegue para Wrangler de Cloudflare. |
| **`server.ts`** | Servidor local Express para pruebas durante el desarrollo. |
| **`src/ai/*`** | Lógica modular de enrutador, proveedores y tipos. |

---

## 🚀 Pasos para Desplegar en Cloudflare Workers

### 1. Iniciar sesión en Cloudflare (desde tu terminal local)
```bash
npx wrangler login
```

### 2. Configurar la API Key de Gemini como Secreto seguro
*(Cloudflare encripta el secreto para que nunca sea visible en el código ni en el cliente)*:
```bash
npx wrangler secret put GEMINI_API_KEY
```
> Escribe o pega tu clave de Google Gemini cuando te lo pida en la terminal.

*(Opcional: Si quieres proteger el acceso con un token secreto adicional)*:
```bash
npx wrangler secret put API_SECRET_KEY
```

### 3. Desplegar el Worker
```bash
npx wrangler deploy
```

Cloudflare te devolverá la URL pública de tu API, por ejemplo:
`https://ai-backend-api.<tu-subdominio>.workers.dev`

---

## 🔒 Configuración de CORS y Seguridad

Por defecto en `wrangler.toml`, las peticiones solo se aceptan desde los siguientes orígenes:
- `https://anapse.github.io` *(GitHub Pages / Mascoticas IA)*
- `http://localhost:3000` *(Desarrollo local)*
- `http://localhost:5173` *(Desarrollo local)*

---

## 💰 Optimización de Costes y Enrutamiento Inteligente

- **Modelo económico por defecto:** Utiliza **`gemini-3.1-flash-lite`** para saludos, preguntas sencillas, definiciones, diálogos de mascotas y consultas generales.
- **Modelo superior:** Solo pasa automáticamente a **`gemini-3.8-flash`** para tareas que realmente requieren código avanzado, matemáticas o razonamiento complejo.
- **Control del backend:** El cliente no puede obligar al backend a usar modelos caros para consultas simples.
- **Fallback de alta disponibilidad:** Si el modelo económico experimenta congestión o fallo temporal, reintenta automáticamente con el modelo secundario sin interrumpir la experiencia del usuario.

---

## 🔌 Cómo conectar tu aplicación en GitHub Pages (Mascoticas IA)

En tu aplicación estática alojada en GitHub Pages, solo debes hacer una llamada HTTP `POST` al endpoint `/api/chat` de tu Worker:

```javascript
// URL de tu Cloudflare Worker desplegado
const AI_BACKEND_URL = "https://ai-backend-api.<tu-subdominio>.workers.dev";

async function consultarMascotaIA(preguntaUsuario, personalidadMascota) {
  try {
    const response = await fetch(`${AI_BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: preguntaUsuario,
        systemInstruction: personalidadMascota || "Eres una simpática mascota virtual que responde de forma alegre y breve.",
        taskType: "auto", // El backend detecta automáticamente y usa el modelo más económico
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Error al comunicar con la IA");
    }

    const data = await response.json();
    return data.text; // Texto generado para la mascota
  } catch (err) {
    console.error("Error consultando IA:", err);
    return "¡Ups! En este momento no puedo responder, inténtalo de nuevo en unos segundos.";
  }
}
```

---

## 📡 Resumen de Endpoints del Worker

- **`GET /api/health`**: Comprueba si el worker está vivo y si la API Key está configurada (no requiere autenticación).
- **`GET /api/models`**: Lista los modelos gobernados por el backend (`gemini-3.1-flash-lite` y `gemini-3.8-flash`).
- **`POST /api/chat`**: Genera respuestas con límites de seguridad y fallback automático.
