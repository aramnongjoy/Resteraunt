import { getTopRestaurants, type Restaurant } from "../src/scraper";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

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

async function main() {
  const template = readFileSync("result.html", "utf-8");

  let cards: string;
  try {
    const restaurants = await getTopRestaurants();
    cards =
      restaurants.length > 0
        ? restaurants.map((r, i) => renderCard(r, i + 1)).join("\n")
        : `<div class="empty">ยังไม่มีข้อมูลร้านอาหาร — กรุณารัน scraper ก่อน</div>`;
  } catch (err: any) {
    console.warn("⚠️  ไม่สามารถดึงข้อมูลจาก Google Sheets:", err.message);
    cards = `<div class="empty">ยังไม่มีข้อมูลร้านอาหาร — กรุณาตั้งค่า environment variables</div>`;
  }

  const html = template
    .replace("{{cards}}", cards)
    .replace("{{date}}", new Date().toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }));

  mkdirSync("public", { recursive: true });
  writeFileSync("public/index.html", html, "utf-8");
  console.log("✅ Generated public/index.html");
}

main();
