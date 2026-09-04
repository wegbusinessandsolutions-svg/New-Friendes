import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const STATE_MAP: Record<string, string> = {
  'AC': 'Acre',
  'AL': 'Alagoas',
  'AP': 'Amapá',
  'AM': 'Amazonas',
  'BA': 'Bahia',
  'CE': 'Ceará',
  'DF': 'Distrito Federal',
  'ES': 'Espírito Santo',
  'GO': 'Goiás',
  'MA': 'Maranhão',
  'MT': 'Mato Grosso',
  'MS': 'Mato Grosso do Sul',
  'MG': 'Minas Gerais',
  'PA': 'Pará',
  'PB': 'Paraíba',
  'PR': 'Paraná',
  'PE': 'Pernambuco',
  'PI': 'Piauí',
  'RJ': 'Rio de Janeiro',
  'RN': 'Rio Grande do Norte',
  'RS': 'Rio Grande do Sul',
  'RO': 'Rondônia',
  'RR': 'Roraima',
  'SC': 'Santa Catarina',
  'SP': 'São Paulo',
  'SE': 'Sergipe',
  'TO': 'Tocantins'
};

function normalizeState(state: string | null | undefined): string {
  if (!state) return '';
  const trimmed = state.trim().toUpperCase();
  if (STATE_MAP[trimmed]) return STATE_MAP[trimmed];
  
  for (const [key, val] of Object.entries(STATE_MAP)) {
    if (val.toUpperCase() === trimmed) return val;
  }
  return state;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/verify-id", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "No image provided" });
      }

      const { GoogleGenAI, Type } = await import("@google/genai");
      
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: {
          parts: [
            {
              inlineData: {
                data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
                mimeType: mimeType || "image/jpeg",
              },
            },
            {
              text: "Analise este documento de identificação (Identidade/RG, CNH ou Passaporte). Extraia as seguintes informações exatamente como constam no documento: 1. Nome completo. 2. Data de Nascimento. 3. Local de Nascimento (Cidade e Estado). Se não for possível extrair alguma informação, deixe o campo em branco ou nulo."
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nomeCompleto: { type: Type.STRING, description: "Nome completo do titular" },
              dataNascimento: { type: Type.STRING, description: "Data de nascimento no formato YYYY-MM-DD" },
              cidadeNascimento: { type: Type.STRING, description: "Cidade de nascimento" },
              estadoNascimento: { type: Type.STRING, description: "Estado/UF de nascimento" },
            },
            required: ["nomeCompleto", "dataNascimento"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from AI");
      
      const data = JSON.parse(text);
      if (data && data.estadoNascimento) {
        data.estadoNascimento = normalizeState(data.estadoNascimento);
      }
      res.json(data);
    } catch (err: any) {
      console.error("Error verifying ID:", err);
      res.status(500).json({ error: err.message || "Failed to verify ID" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Support React Router fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

