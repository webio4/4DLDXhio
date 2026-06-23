import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Initialize Gemini client lazily
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
}

// REST API endpoint for virtual car assistant Co-Pilot
app.post("/api/ai-assistant", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: "Yêu cầu cung cấp nội dung lệnh giọng nói / văn bản!" });
  }

  const promptLower = prompt.toLowerCase();

  // Try using actual Gemini API if key is present
  try {
    const ai = getGeminiClient();
    if (ai) {
      const systemPrompt = `Bạn là Trợ lý AI Xe Thông Minh ("Co-Pilot") trên xe VinFast của người chơi trong game mô phỏng lái xe 3D.
Nhiệm vụ của bạn là phân tích câu nói tự nhiên của người lái xe và chuyển thành các lệnh điều khiển xe tương ứng dưới dạng JSON.

Hãy trả về một đối tượng JSON hợp lệ duy nhất có lược đồ sau:
{
  "engine": "on" | "off" | null,     // "on": nổ máy/bật động cơ, "off": tắt máy/tắt động cơ, null: giữ nguyên
  "headlights": "on" | "off" | null, // "on": bật đèn pha/đèn cốt, "off": tắt đèn, null: giữ nguyên
  "indicator": "none" | "left" | "right" | "hazard" | null, // xi nhan trái/phải/nguy hiểm/none, null: giữ nguyên
  "horn": boolean | null,             // true nếu yêu cầu bấm còi/bíp bíp, false/null nếu không
  "turbo": boolean | null,            // true nếu yêu cầu tăng tốc/nitro/chạy nhanh/ga mạnh, false/null nếu không
  "color": string | null,             // nếu yêu cầu đổi màu sơn xe (ví dụ: "đỏ", "gold", "cyan", "green", "pink", "black"...), null nếu giữ nguyên
  "successMessage": string            // Câu trả lời tiếng Việt cực kỳ dí dỏm, lễ phép và đáng yêu từ trợ lý (ví dụ: "Dạ thưa chủ nhân, em đã khởi động động cơ gầm rú sẵn sàng rồi ạ! Bíp bíp!")
}

Luật lựa chọn xi nhan (indicator):
- rẽ trái, qua trái, xi nhan trái -> "left"
- rẽ phải, qua phải, xi nhan phải -> "right"
- nguy hiểm, cứu hộ, đèn chớp -> "hazard"
- tắt xi nhan, tắt đèn nháy -> "none"

Lưu ý: Bạn CHỈ ĐƯỢC trả về JSON nguyên bản, không bao gồm khối markdown \`\`\`json hay bất kỳ chữ nào khác ngoài JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          temperature: 0.2,
        }
      });

      const responseText = response.text || "";
      try {
        const parsed = JSON.parse(responseText.trim());
        return res.json(parsed);
      } catch (err) {
        console.warn("Raw Gemini AI response fell back due to JSON parsing error:", responseText);
      }
    }
  } catch (err: any) {
    console.error("Gemini Assistant error:", err.message);
  }

  // --- RULE-BASED ROBUST LOCAL FALLBACK (Always works even without internet/API keys!) ---
  const result: any = {
    engine: null,
    headlights: null,
    indicator: null,
    horn: null,
    turbo: null,
    color: null,
    successMessage: "Dạ em đây ạ! Hệ thống rà quét tín hiệu địa phương đã sẵn sàng."
  };

  let actionText = "";

  if (promptLower.includes("nổ máy") || promptLower.includes("bật máy") || promptLower.includes("khởi động xe") || promptLower.includes("bật động cơ") || promptLower.includes("start")) {
    result.engine = "on";
    actionText += "nổ máy xe 🟢, ";
  } else if (promptLower.includes("tắt máy") || promptLower.includes("tắt động cơ") || promptLower.includes("dừng xe") || promptLower.includes("stop")) {
    result.engine = "off";
    actionText += "tắt máy xe 🔴, ";
  }

  if (promptLower.includes("bật đèn") || promptLower.includes("mở đèn") || promptLower.includes("bật pha")) {
    result.headlights = "on";
    actionText += "bật đèn pha cực sáng 💡, ";
  } else if (promptLower.includes("tắt đèn") || promptLower.includes("tắt pha")) {
    result.headlights = "off";
    actionText += "tắt đèn headlights, ";
  }

  if (promptLower.includes("xi nhan trái") || promptLower.includes("rẽ trái") || promptLower.includes("qua trái")) {
    result.indicator = "left";
    actionText += "bật xi nhan trái ⬅️, ";
  } else if (promptLower.includes("xi nhan phải") || promptLower.includes("rẽ phải") || promptLower.includes("qua phải")) {
    result.indicator = "right";
    actionText += "bật xi nhan phải ➡️, ";
  } else if (promptLower.includes("xi nhan nguy hiểm") || promptLower.includes("khẩn cấp") || promptLower.includes("hazard")) {
    result.indicator = "hazard";
    actionText += "bật đèn nháy khẩn cấp ⚠️, ";
  } else if (promptLower.includes("tắt xi nhan") || promptLower.includes("tắt nháy")) {
    result.indicator = "none";
    actionText += "tắt đèn xi nhan, ";
  }

  if (promptLower.includes("bấm còi") || promptLower.includes("bóp còi") || promptLower.includes("kêu") || promptLower.includes("còi")) {
    result.horn = true;
    actionText += "bóp còi bíp bíp 🔊, ";
  }

  if (promptLower.includes("tăng tốc") || promptLower.includes("ga mạnh") || promptLower.includes("nitro") || promptLower.includes("chạy nhanh") || promptLower.includes("phóng") || promptLower.includes("turbo")) {
    result.turbo = true;
    actionText += "kích hoạt phản lực Nitro cực bốc ⚡, ";
  }

  // Paint job
  if (promptLower.includes("đỏ") || promptLower.includes("red")) {
    result.color = "#ff0000";
    actionText += "phủ lớp decal Đỏ rực rỡ 🔴, ";
  } else if (promptLower.includes("vàng") || promptLower.includes("gold") || promptLower.includes("yellow")) {
    result.color = "#ffd700";
    actionText += "phủ lớp decal Vàng Gold hoàng gia 🟡, ";
  } else if (promptLower.includes("xanh lá") || promptLower.includes("green")) {
    result.color = "#00ff00";
    actionText += "đổi màu sơn xanh lá thiên nhiên 🟢, ";
  } else if (promptLower.includes("hồng") || promptLower.includes("pink")) {
    result.color = "#ff69b4";
    actionText += "đổi màu hồng cực bánh bèo 🌸, ";
  } else if (promptLower.includes("đen") || promptLower.includes("black")) {
    result.color = "#111111";
    actionText += "phủ decal màu đen nhám lịch lãm ◼️, ";
  } else if (promptLower.includes("xanh dương") || promptLower.includes("blue") || promptLower.includes("xanh lam")) {
    result.color = "#0000ff";
    actionText += "phủ decal màu xanh đại dương cực mát 🔵, ";
  } else if (promptLower.includes("neon") || promptLower.includes("cyan")) {
    result.color = "#00ffff";
    actionText += "phủ decal màu xanh Neon cực đỉnh 🌐, ";
  }

  if (actionText) {
    result.successMessage = `Dạ thưa chủ nhân, hệ thống nội bộ đã thực hiện: ${actionText.slice(0, -2)} xong rồi ạ! Chúc chủ nhân lái xe vui vẻ!`;
  } else {
    result.successMessage = `Dạ! Em nghe rõ thắc mắc "${prompt}" từ chủ nhân. Chủ nhân có thể thử các lệnh như "Nổ máy xe", "Bật đèn pha", "Đổi màu sơn đỏ", "Bật còi" hoặc "Bơm Nitro tăng tốc" nhé ạ!`;
  }

  return res.json(result);
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development server with Vite integration
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static files hosting
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FULLSTACK CONTAINER] Webapp running beautifully on port http://localhost:${PORT}`);
  });
}

startServer();
