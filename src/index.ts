import { Elysia } from "elysia";
import { readFileSync } from "fs";
import { scrapeAndSave, getTopRestaurants, getAllRestaurants, type Restaurant } from "./scraper";

// ── HTML helpers ──────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCard(r: Restaurant, rank: number): string {
  const labels = ["🥇 อันดับ 1", "🥈 อันดับ 2", "🥉 อันดับ 3"];
  const score = Number(r.คะแนนรีวิว) || 0;
  const filled = Math.min(5, Math.round(score));
  const stars = "★".repeat(filled) + "☆".repeat(5 - filled);
  const reviews = Number(r.จำนวนรีวิว)
    ? Number(r.จำนวนรีวิว).toLocaleString("th-TH")
    : "—";

  const infoRows = (
    [
      [r.ที่ตั้ง,             "📍 ที่ตั้ง"],
      [r.เวลาเปิดปิด,         "🕐 เวลาเปิด"],
      [r.หมายเหตุการเดินทาง, "🚗 การเดินทาง"],
      [r.หมายเหตุเพิ่มเติม,  "📝 หมายเหตุ"],
    ] as [string, string][]
  )
    .filter(([val]) => val?.trim())
    .map(
      ([val, label]) =>
        `<div class="info-row"><span class="info-label">${label}</span><span class="info-value">${esc(val)}</span></div>`
    )
    .join("");

  const tags = [r.พื้นที่, r.ประเภทอาหาร, r.ช่วงราคา]
    .filter(Boolean)
    .map((t) => `<span class="tag">${esc(t)}</span>`)
    .join("");

  const groupBadge = r.เหมาะกับกลุ่มหรือไม่?.trim()
    ? `<div class="group-badge">✓ เหมาะสำหรับกลุ่ม 8–12 คน</div>`
    : "";

  const mapLink = r.ลิงก์แหล่งข้อมูล
    ? `<a class="card-link" href="${esc(r.ลิงก์แหล่งข้อมูล)}" target="_blank" rel="noopener noreferrer">ดูบน Google Maps →</a>`
    : "";

  return `
<div class="card rank-${rank}">
  <div class="card-rank-bar"></div>
  <div class="card-body">
    <div class="rank-badge">${labels[rank - 1]}</div>
    <h2 class="card-name">${esc(r.ชื่อร้าน)}</h2>
    <div class="card-tags">${tags}</div>
    <div class="score-block">
      <span class="score-num">${score || "—"}</span>
      <div class="score-right">
        <div class="stars">${stars}</div>
        <div class="review-count">${reviews} รีวิว</div>
      </div>
    </div>
    <div class="info-list">${infoRows}</div>
    ${groupBadge}
    ${mapLink}
  </div>
</div>`;
}

function renderPage(restaurants: Restaurant[]): string {
  const template = readFileSync("result.html", "utf-8");

  const cards =
    restaurants.length > 0
      ? restaurants.map((r, i) => renderCard(r, i + 1)).join("\n")
      : `<div class="empty">ยังไม่มีข้อมูลร้านอาหาร — กรุณารัน <strong>POST /scrape</strong> ก่อน</div>`;

  return template
    .replace("{{cards}}", cards)
    .replace("{{date}}", new Date().toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }));
}

// ── Scrape job state (fire-and-forget pattern) ───────────────
type ScrapeStatus = "idle" | "running" | "done" | "error";
let scrapeJob: {
  status: ScrapeStatus;
  startedAt?: number;
  total?: number;
  breakdown?: Record<string, number>;
  error?: string;
} = { status: "idle" };

// ── Routes ────────────────────────────────────────────────────

const app = new Elysia()
  .get("/", ({ set }) => {
    set.headers["content-type"] = "text/html; charset=utf-8";
    return readFileSync("public/index.html", "utf-8");
  })
  .get("/index.html", ({ set }) => {
    set.headers["content-type"] = "text/html; charset=utf-8";
    return readFileSync("public/index.html", "utf-8");
  })

  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))

  .get("/result", async ({ set }) => {
    try {
      const restaurants = await getTopRestaurants();
      set.headers["content-type"] = "text/html; charset=utf-8";
      return renderPage(restaurants);
    } catch (err: any) {
      set.status = 500;
      return { success: false, error: err.message };
    }
  })

  .get("/all-restaurants", async ({ set }) => {
    try {
      const restaurants = await getAllRestaurants();
      const areas = ["ทองหล่อ", "พร้อมพงศ์", "สยาม", "อารีย์", "อโศก"];
      const breakdown: Record<string, number> = {};
      areas.forEach((a) => {
        breakdown[a] = restaurants.filter((r) => r.พื้นที่ === a).length;
      });
      return { restaurants, total: restaurants.length, breakdown };
    } catch (err: any) {
      set.status = 500;
      return { error: err.message };
    }
  })

  // Fire-and-forget: return 202 immediately, scrape runs in background
  .post("/api/scrape", ({ set }) => {
    if (scrapeJob.status === "running") {
      set.status = 409;
      return { success: false, running: true, error: "กำลัง Scrape อยู่แล้ว โปรดรอสักครู่…" };
    }

    scrapeJob = { status: "running", startedAt: Date.now() };

    scrapeAndSave()
      .then((result) => {
        scrapeJob = {
          status: "done",
          startedAt: scrapeJob.startedAt,
          total: result.total,
          breakdown: result.breakdown,
        };
      })
      .catch((err: any) => {
        scrapeJob = { status: "error", startedAt: scrapeJob.startedAt, error: err.message };
      });

    set.status = 202;
    return { success: true, status: "running", message: "Scrape เริ่มต้นแล้ว กำลังดึงข้อมูล…" };
  })

  // Poll endpoint: frontend checks every few seconds
  .get("/api/scrape-status", () => {
    if (scrapeJob.status === "done") {
      const result = { success: true, status: "done", total: scrapeJob.total, breakdown: scrapeJob.breakdown };
      scrapeJob = { status: "idle" };
      return result;
    }
    if (scrapeJob.status === "error") {
      const result = { success: false, status: "error", error: scrapeJob.error };
      scrapeJob = { status: "idle" };
      return result;
    }
    const elapsed = scrapeJob.startedAt ? Math.round((Date.now() - scrapeJob.startedAt) / 1000) : 0;
    return { success: true, status: scrapeJob.status, elapsed };
  })

  .post("/api/ask", async ({ body, set }: { body: any; set: any }) => {
    const question = String(body?.question || "").trim();
    const restaurants = Array.isArray(body?.restaurants) ? body.restaurants.slice(0, 30) : [];
    const apiKey = String(body?.apiKey || "").trim() || process.env.ANTHROPIC_API_KEY || "";
    if (!apiKey) {
      set.status = 400;
      return { error: "กรุณาใส่ Anthropic API Key ในช่อง API Key" };
    }
    if (!question) {
      set.status = 400;
      return { error: "กรุณาระบุคำถาม" };
    }
    const systemPrompt = `คุณเป็นผู้ช่วยแนะนำร้านอาหารสำหรับทีมงาน 8–12 คน ในกรุงเทพฯ
มีข้อมูลร้านอาหาร: ${JSON.stringify(restaurants, null, 2)}
ตอบเป็นภาษาไทย กระชับ อ้างอิงจากข้อมูลที่ให้มาเท่านั้น`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1024, system: systemPrompt, messages: [{ role: "user", content: question }] }),
    });
    const data: any = await resp.json();
    if (!resp.ok) {
      set.status = 500;
      return { error: data?.error?.message || "AI error" };
    }
    return { answer: data?.content?.[0]?.text ?? "ไม่สามารถตอบได้" };
  })

  .listen({ port: 9145, idleTimeout: 255 }); // max allowed by Bun

console.log(`🚀 Server running at http://localhost:${app.server?.port}`);
console.log(`🍽️  GET  /             — Restaurant Picker UI`);
console.log(`📋 POST /api/scrape   — เริ่ม Scrape (fire-and-forget)`);
console.log(`🔍 GET  /api/scrape-status — ตรวจสอบสถานะ Scrape\n`);
