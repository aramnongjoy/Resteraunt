import { ApifyClient } from "apify-client";
import { GoogleAuth } from "google-auth-library";
import { google } from "googleapis";

// ============================================================
// ⚙️  CONFIG
// ============================================================
const ACTOR_ID = "compass/crawler-google-places";

const LOCATIONS = [
  { label: "ทองหล่อ", query: "restaurants in Thonglor Bangkok" },
  { label: "พร้อมพงศ์", query: "restaurants in Phrom Phong Bangkok" },
  { label: "สยาม", query: "restaurants in Siam Bangkok" },
  { label: "อารีย์", query: "restaurants in Ari Bangkok" },
  { label: "อโศก", query: "restaurants in Asoke Bangkok" },
];

const MIN_RESULTS_PER_LOCATION = 10;
const SHEET_TAB_NAME = "Restaurants";

// ============================================================

export interface Restaurant {
  ชื่อร้าน: string;
  พื้นที่: string;
  ประเภทอาหาร: string;
  คะแนนรีวิว: string | number;
  จำนวนรีวิว: string | number;
  ช่วงราคา: string;
  ที่ตั้ง: string;
  หมายเหตุการเดินทาง: string;
  เวลาเปิดปิด: string;
  เหมาะกับกลุ่มหรือไม่: string;
  ลิงก์แหล่งข้อมูล: string;
  หมายเหตุเพิ่มเติม: string;
}

// ── Apify ─────────────────────────────────────────────────────

async function runApifyScraper(
  client: ApifyClient,
  location: (typeof LOCATIONS)[number]
): Promise<Restaurant[]> {
  console.log(`\n🔍 ดึงข้อมูล: ${location.label}`);

  const run = await client.actor(ACTOR_ID).call(
    {
      searchStringsArray: [location.query],
      maxCrawledPlacesPerSearch: MIN_RESULTS_PER_LOCATION,
      language: "th",
      maxImages: 0,
      maxReviews: 0,
    },
    { waitSecs: 300 }
  );

  const datasetId = run.defaultDatasetId;
  if (!datasetId) {
    console.warn(`  ⚠️  ไม่พบ dataset สำหรับ ${location.label}`);
    return [];
  }

  const { items } = await client.dataset(datasetId).listItems();
  console.log(`  ✅ ได้ ${items.length} ร้าน`);

  return items.map((item: any) => flattenRestaurant(item, location.label));
}

function flattenRestaurant(item: any, locationLabel: string): Restaurant {
  const hours = item.openingHours ?? item.hours;
  const hoursStr = Array.isArray(hours)
    ? hours
      .slice(0, 3)
      .map((h: any) =>
        typeof h === "object" ? `${h.day ?? ""}: ${h.hours ?? h.hour ?? ""}` : String(h)
      )
      .join(" | ")
    : String(hours ?? "");

  return {
    ชื่อร้าน: item.name ?? item.title ?? "",
    พื้นที่: locationLabel,
    ประเภทอาหาร: item.category ?? item.cuisine ?? item.types ?? "",
    คะแนนรีวิว: item.rating ?? item.totalScore ?? "",
    จำนวนรีวิว: item.reviewsCount ?? item.reviewCount ?? "",
    ช่วงราคา: item.priceLevel ?? item.price ?? "",
    ที่ตั้ง: item.address ?? item.location ?? "",
    หมายเหตุการเดินทาง: "",
    เวลาเปิดปิด: hoursStr,
    เหมาะกับกลุ่มหรือไม่: "",
    ลิงก์แหล่งข้อมูล: item.url ?? item.link ?? item.mapsUrl ?? "",
    หมายเหตุเพิ่มเติม: "",
  };
}

// ── Google Sheets ─────────────────────────────────────────────

async function getSheetsClient() {
  const credsJson = process.env.GOOGLE_CREDENTIALS_JSON;
  const credsPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH ?? "service_account.json";

  let auth: GoogleAuth;

  if (credsJson) {
    const credentials = JSON.parse(credsJson);
    auth = new GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
      ],
    });
  } else {
    auth = new GoogleAuth({
      keyFile: credsPath,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
      ],
    });
  }

  return google.sheets({ version: "v4", auth });
}

async function writeToSheet(restaurants: Restaurant[]): Promise<void> {
  if (restaurants.length === 0) {
    console.warn("⚠️  ไม่มีข้อมูลให้เขียน");
    return;
  }

  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

  console.log(`  📋 ใช้ Sheet ID: ${spreadsheetId}`);
  console.log(`  🔑 กำลัง authenticate...`);

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId }, { timeout: 10000 });
  console.log(`  ✅ เชื่อมต่อ Google Sheets สำเร็จ`);
  const existingSheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === SHEET_TAB_NAME
  );

  if (!existingSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SHEET_TAB_NAME } } }],
      },
    });
    console.log(`📄 สร้าง Sheet tab ใหม่: '${SHEET_TAB_NAME}'`);
  } else {
    console.log(`📄 ใช้ Sheet tab ที่มีอยู่: '${SHEET_TAB_NAME}'`);
  }

  const headers = Object.keys(restaurants[0]) as (keyof Restaurant)[];
  const dataRows = restaurants
    .filter((r) => r.ชื่อร้าน)
    .map((r) => headers.map((h) => String(r[h] ?? "")));

  // Always overwrite row 1 so headers stay in sync with the current interface
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_TAB_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headers] },
  });

  if (dataRows.length === 0) {
    console.warn("⚠️  ไม่มีข้อมูลร้านอาหารที่มีชื่อให้เขียน");
    return;
  }

  // ต่อท้ายข้อมูล
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_TAB_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: dataRows },
  });

  // จัดรูปแบบ header
  const sheetId = (await sheets.spreadsheets.get({ spreadsheetId }))
    .data.sheets?.find((s) => s.properties?.title === SHEET_TAB_NAME)
    ?.properties?.sheetId;

  if (sheetId !== undefined) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.55, blue: 0.9 },
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                  },
                  horizontalAlignment: "CENTER",
                },
              },
              fields: "userEnteredFormat",
            },
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: { frozenRowCount: 1 },
              },
              fields: "gridProperties.frozenRowCount",
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId,
                dimension: "COLUMNS",
                startIndex: 0,
                endIndex: headers.length,
              },
            },
          },
        ],
      },
    });
  }

  console.log(`\n✅ เขียน ${restaurants.length} ร้านลง Google Sheets สำเร็จ`);
}

// ── Shared sheet reader ───────────────────────────────────────

async function readAllFromSheet(): Promise<Restaurant[]> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("GOOGLE_SHEET_ID ไม่ได้ตั้งค่า");

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_TAB_NAME}!A1:N`,
  });

  const rows = (res.data.values ?? []) as string[][];
  if (rows.length < 2) return [];

  const [headerRow, ...dataRows] = rows;

  return dataRows
    .map((row) => {
      const obj: Record<string, string> = {};
      headerRow.forEach((h, i) => { obj[h] = row[i] ?? ""; });
      return obj as unknown as Restaurant;
    })
    .filter((r) => r.ชื่อร้าน)
    .sort((a, b) => {
      const sd = Number(b.คะแนนรีวิว || 0) - Number(a.คะแนนรีวิว || 0);
      return sd !== 0 ? sd : Number(b.จำนวนรีวิว || 0) - Number(a.จำนวนรีวิว || 0);
    });
}

// ── Top restaurants for result page ──────────────────────────

export async function getTopRestaurants(limit = 3): Promise<Restaurant[]> {
  return (await readAllFromSheet()).slice(0, limit);
}

// ── All restaurants for index2 picker ────────────────────────

export async function getAllRestaurants(): Promise<Restaurant[]> {
  return readAllFromSheet();
}

// ── Main export ───────────────────────────────────────────────

export async function scrapeAndSave() {
  const apifyToken = process.env.APIFY_TOKEN;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!apifyToken) throw new Error("APIFY_TOKEN ไม่ได้ตั้งค่า");
  if (!sheetId) throw new Error("GOOGLE_SHEET_ID ไม่ได้ตั้งค่า");

  const client = new ApifyClient({ token: apifyToken });
  const allRestaurants: Restaurant[] = [];
  const seen = new Set<string>();

  const results = await Promise.allSettled(
    LOCATIONS.map((location) => runApifyScraper(client, location))
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("⚠️  ดึงข้อมูลล้มเหลว:", result.reason);
      continue;
    }
    for (const item of result.value) {
      if (item.ชื่อร้าน && !seen.has(item.ชื่อร้าน)) {
        seen.add(item.ชื่อร้าน);
        allRestaurants.push(item);
      }
    }
  }

  console.log(`\n📊 รวมทั้งหมด: ${allRestaurants.length} ร้าน (ไม่ซ้ำ)`);

  if (allRestaurants.length < 20) {
    console.warn(`⚠️  ได้น้อยกว่า 20 ร้าน — ลองเพิ่ม MIN_RESULTS_PER_LOCATION`);
  }

  console.log("\n🔗 กำลังเขียนลง Google Sheets...");
  await writeToSheet(allRestaurants);

  const breakdown = LOCATIONS.reduce<Record<string, number>>((acc, loc) => {
    acc[loc.label] = allRestaurants.filter((r) => r.พื้นที่ === loc.label).length;
    return acc;
  }, {});

  console.log("\n📈 สรุป:");
  Object.entries(breakdown).forEach(([loc, count]) =>
    console.log(`  ${loc.padEnd(10)}: ${count} ร้าน`)
  );
  console.log(`  ${"รวม".padEnd(10)}: ${allRestaurants.length} ร้าน`);

  return { total: allRestaurants.length, breakdown };
}