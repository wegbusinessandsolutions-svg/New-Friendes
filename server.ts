import express from "express";
import http from "http";
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

async function parseImagePayload(input: string, fallbackMime = "image/jpeg"): Promise<{ data: string; mimeType: string }> {
  if (input.startsWith("http://") || input.startsWith("https://")) {
    const res = await fetch(input);
    const arrayBuf = await res.arrayBuffer();
    const data = Buffer.from(arrayBuf).toString("base64");
    const mimeType = res.headers.get("content-type") || fallbackMime;
    return { data, mimeType };
  }
  const match = input.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: fallbackMime, data: input.replace(/^data:image\/\w+;base64,/, "") };
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/verify-face-login", async (req, res) => {
    try {
      const { liveImageBase64, storedImageBase64, email } = req.body;
      if (!liveImageBase64) {
        return res.status(400).json({ error: "Foto ao vivo não fornecida para autenticação." });
      }
      if (!storedImageBase64) {
        return res.status(400).json({ error: "Foto de referência cadastrada no banco de dados não encontrada." });
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

      const parsedStored = await parseImagePayload(storedImageBase64);
      const parsedLive = await parseImagePayload(liveImageBase64);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: parsedStored.data,
                  mimeType: parsedStored.mimeType,
                },
              },
              {
                inlineData: {
                  data: parsedLive.data,
                  mimeType: parsedLive.mimeType,
                },
              },
              {
                text: `Você é o sistema pericial de biometria e reconhecimento facial do aplicativo New Friends.br.
Compare a Imagem 1 (Foto e traços biométricos registrados previamente no banco de dados) e a Imagem 2 (Foto capturada ao vivo na câmera agora pelo usuário que informou o e-mail: "${email || 'usuário'}").

Avalie minuciosamente a geometria e fisionomia:
1. Formato do crânio, contorno da mandíbula, distância interpupilar, formato do nariz, lábios e maçãs do rosto.
2. Certifique-se de que a Imagem 2 contém um rosto humano real posicionado em frente à câmera.
3. Determine se as duas fotos retratam inequivocamente a MESMA pessoa física titular da conta.
4. Desconsidere variações normais de iluminação, leve ângulo ou expressão facial.

Retorne obrigatoriamente um JSON:
- isMatch (boolean: true se for a mesma pessoa; false se for pessoa diferente, impostor ou rosto não detectado)
- confidence (número de 0 a 100 de certeza do pareamento)
- reason (explicação sucinta em português do resultado da validação biométrica)`
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isMatch: { type: Type.BOOLEAN, description: "Indica se o rosto ao vivo corresponde ao usuário cadastrado" },
              confidence: { type: Type.NUMBER, description: "Nível de certeza biométrica entre 0 e 100" },
              reason: { type: Type.STRING, description: "Justificativa clara em português" }
            },
            required: ["isMatch", "confidence", "reason"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("Resposta vazia da inteligência artificial.");

      const result = JSON.parse(text);
      res.json({
        isMatch: Boolean(result.isMatch && (result.confidence >= 60 || result.isMatch === true)),
        confidence: result.confidence || (result.isMatch ? 95 : 20),
        reason: result.reason || (result.isMatch ? "Características faciais compatíveis com o cadastro." : "Rosto não compatível com o banco de dados.")
      });
    } catch (err: any) {
      console.error("Erro na verificação facial de login:", err);
      res.status(500).json({ error: err.message || "Falha ao processar biometria facial." });
    }
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
      server: { 
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server },
      },
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

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

