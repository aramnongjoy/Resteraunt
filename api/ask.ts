import type { IncomingMessage, ServerResponse } from "http";

export const maxDuration = 30;

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    });
    return res.end();
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  let question: string;
  let restaurants: unknown[];
  let apiKey: string;

  try {
    const raw = await readBody(req);
    const parsed = JSON.parse(raw);
    question = String(parsed.question || "").trim();
    restaurants = Array.isArray(parsed.restaurants) ? parsed.restaurants.slice(0, 30) : [];
    // Client-supplied key takes priority; fall back to server env var
    apiKey = String(parsed.apiKey || "").trim() || process.env.ANTHROPIC_API_KEY || "";
  } catch {
    return json(res, 400, { error: "Invalid JSON body" });
  }

  if (!apiKey) {
    return json(res, 400, { error: "กรุณาใส่ Anthropic API Key ในช่อง API Key หรือตั้งค่า ANTHROPIC_API_KEY บน server" });
  }

  if (!question) {
    return json(res, 400, { error: "กรุณาระบุคำถาม" });
  }

  const systemPrompt = `คุณเป็นผู้ช่วยแนะนำร้านอาหารสำหรับทีมงาน 8–12 คน ในกรุงเทพฯ
คุณมีข้อมูลร้านอาหารจาก Google Maps ดังนี้:

${JSON.stringify(restaurants, null, 2)}

กฎการตอบ:
- ตอบเป็นภาษาไทยเสมอ
- กระชับ ชัดเจน ตรงประเด็น
- อ้างอิงจากข้อมูลร้านที่ให้มาเท่านั้น ไม่คาดเดาเอง
- หากไม่มีข้อมูลในชุดข้อมูล ให้บอกตรงๆ ว่าไม่พบข้อมูล
- เน้นข้อมูลที่เป็นประโยชน์: ชื่อร้าน ย่าน ประเภทอาหาร คะแนน ราคา`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: question }],
      }),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      return json(res, 500, { error: data?.error?.message || `Anthropic API error ${response.status}` });
    }

    const answer = data?.content?.[0]?.text ?? "ไม่สามารถตอบได้";
    return json(res, 200, { answer });
  } catch (err: any) {
    return json(res, 500, { error: "เกิดข้อผิดพลาดในการเชื่อมต่อ AI: " + err.message });
  }
}
