ต้องการเขียนสคริป ขอเป็นภาษา elysia bunjs ดึงรายชื่อร้านอาหาร จาก apify ( https://apify.com/gtgyani206/google-maps-restaurant-scraper) โดยกำหนด location ต่อไปนี้ ทองหล่อ พร้อมพงศ์ สยาม อารีย์ โดยดึงมาอย่างน้อย 20 ร้าน เก็บข้อมูลไว้ใน googlesheet

----------------------------------


(base) aramnongjoy@Chas-MacBook-Air Resteraunt % bun run src/index.ts 
error: Cannot find module '@sinclair/typebox' from '/Users/aramnongjoy/.bun/install/cache/elysia@1.4.28@@@1/dist/index.mjs'

Bun v1.2.2 (macOS arm64)
(base) aramnongjoy@Chas-MacBook-Air Resteraunt %

------------------------------------
(base) aramnongjoy@Chas-MacBook-Air Resteraunt % bun add @sinclair/typebox
bun add v1.2.2 (c1708ea6)
  🔍 Resolving [1/2] HTTPThread: could not find CA file: '/Users/aramnongjoy/github.com/https/local.crt'

--------------------------------------

(base) aramnongjoy@Chas-MacBook-Air Resteraunt % bunx bun pm config delete ca

-----------------------------------

(base) aramnongjoy@Chas-MacBook-Air Resteraunt % BUN_CONFIG_NO_VERIFY_SSL=true bun add @sinclair/typebox
bun add v1.2.2 (c1708ea6)
  🔍 Resolving [1/3] HTTPThread: could not find CA file: '/Users/aramnongjoy/github.com/https/local.crt'
(base) aramnongjoy@Chas-MacBook-Air Resteraunt % bun add --noverify @sinclair/typebox
bun add v1.2.2 (c1708ea6)
  🔍 Resolving [1/3] HTTPThread: could not find CA file: '/Users/aramnongjoy/github.com/https/local.crt'


-------------------------------------------------

(base) aramnongjoy@Chas-MacBook-Air Resteraunt % grep -r "local.crt" ~/.mpmrc ~/.yarnrc 2>/dev/null
(base) aramnongjoy@Chas-MacBook-Air Resteraunt % grep -r "local.crt" ~/github.com 2>/dev/null | head -5
(base) aramnongjoy@Chas-MacBook-Air Resteraunt % cat ~/.npmrc
cafile=../https/local.crt
strict-ssl=false

--------------------------------------------------------------------





## Define scrape fields

**User:**
Fields data to scrape are:

| English | ภาษาไทย |
|---|---|
| Restaurant Name | ชื่อร้าน |
| Area | พื้นที่ |
| Food Type | ประเภทอาหาร |
| Google Rating | คะแนนรีวิว |
| Review Count | จำนวนรีวิว |
| Price Range | ช่วงราคา |
| Location / Address | ที่ตั้ง |
| Distance / Travel Note | หมายเหตุการเดินทาง |
| Opening Hours | เวลาเปิดปิด |
| Suitable for Group | เหมาะกับกลุ่มหรือไม่ |
| Source URL | ลิงก์แหล่งข้อมูล |
| Notes | หมายเหตุเพิ่มเติม |

**Assistant:**
Updated `src/scraper.ts`:
- Replaced the old `Restaurant` interface with the 12 fields above
- Renamed mismatched fields: `ย่าน` → `พื้นที่`, `คะแนน` → `คะแนนรีวิว`, `ราคาเฉลี่ย` → `ช่วงราคา`, `ที่อยู่` → `ที่ตั้ง`, `เวลาเปิด-ปิด` → `เวลาเปิดปิด`, `"Google Maps URL"` → `ลิงก์แหล่งข้อมูล`
- Added 3 new empty fields for manual fill-in: `หมายเหตุการเดินทาง`, `เหมาะกับกลุ่มหรือไม่`, `หมายเหตุเพิ่มเติม`
- Removed: `เบอร์โทร`, `เว็บไซต์`, `วันที่ดึงข้อมูล`
- Updated `flattenRestaurant` mapping and `r.ย่าน` reference in `scrapeAndSave`

---

## Fix column misalignment & empty-row guard

**User:**
Data is in invalid column. The "เวลาเปิดปิด" data appears under the "Google Maps URL" column header. Also: only write data to Google Sheets if data exists.

**Root cause:**
The Google Sheet still had old headers from a previous run. The code only wrote headers when A1 was empty, so stale headers were never replaced — every column after the rename shifted out of sync.

**Assistant:**
Two fixes applied to `src/scraper.ts`:

1. **Always overwrite row 1** — removed the `if (!existing.data.values?.length)` guard so headers are always synced to the current `Restaurant` interface on every run.
2. **Filter empty rows** — `dataRows` now filters out any entry where `ชื่อร้าน` is empty before appending, preventing invalid/nameless rows from being written to the sheet.

```ts
// Always overwrite row 1 so headers stay in sync with the current interface
await sheets.spreadsheets.values.update({
  spreadsheetId,
  range: `${SHEET_TAB_NAME}!A1`,
  valueInputOption: "USER_ENTERED",
  requestBody: { values: [headers] },
});

const dataRows = restaurants
  .filter((r) => r.ชื่อร้าน)
  .map((r) => headers.map((h) => String(r[h] ?? "")));
```

---
# Conversation Log – Restaurant Scraper Debugging

---

## Server not running

**User:** *(screenshot of `localhost:3000/health` — ERR_NETWORK_IO_SUSPENDED)*

**Claude:** The server isn't running — the error means the connection dropped (likely after sleep). Start it with:
```bash
bun run dev
```

---

## How to update Bun

**User:** how to update bun

**Claude:**
```bash
bun upgrade
```

---

## POST /scrape not working

**User:** /post scrape isn't work can i debug it.

**Claude:** Found the issue. `.env` has `GOOGLE_SHEET_ID=cha` — not a real spreadsheet ID. Fix:
```
GOOGLE_SHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
```
Also make sure `service_account.json` exists and has edit access to the sheet.

Test with:
```bash
curl -X POST http://localhost:3000/scrape
```

---

## Error: unexpected property `timeoutSecs`

**User:**
```json
{ "success": false, "error": "Did not expect property `timeoutSecs` to exist, got `300` in object `options`" }
```

**Claude:** The Apify client's `call()` options uses `waitSecs`, not `timeoutSecs`.

Changed in `scraper.ts:53`:
```ts
// before
{ timeoutSecs: 300 }

// after
{ waitSecs: 300 }
```

---

## Apify actor navigation timeout

**User:** *(Apify actor log — navigation timed out after 8 seconds on Google Maps URLs)*

**Claude:** The actor `gtgyani206/google-maps-restaurant-scraper` is unreliable. Switched to the official `compass/crawler-google-places`.

Updated `scraper.ts`:
```ts
const ACTOR_ID = "compass/crawler-google-places";

// new input format
{
  searchStringsArray: [location.query],
  maxCrawledPlacesPerSearch: MIN_RESULTS_PER_LOCATION,
  language: "th",
  maxImages: 0,
  maxReviews: 0,
}
```

---

## Stuck at "กำลังเขียนลง Google Sheets..."

**User:** stuck on process กำลังเขียนลง Google Sheets...

**Claude:** Added debug logging and a 10-second timeout to the Sheets API call to surface the real error:
```ts
const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId }, { timeout: 10000 });
```

Root cause: `GOOGLE_SHEET_ID=cha` was invalid (still placeholder value).

---

## Setting up service account

**User:** should i go to add permission to write file

**Claude:** Yes. Steps:
1. Go to Google Cloud Console → IAM & Admin → Service Accounts → **Add key** → JSON → download as `service_account.json`
2. Enable **Google Sheets API** in the project
3. Share the Google Sheet with `restaurant@puzzle-3-restaurant.iam.gserviceaccount.com` as **Editor**

Also added `service_account.json` and `.env` to `.gitignore` to protect credentials.

---

## Still stuck at "กำลัง authenticate..."

**User:** กำลัง authenticate... — still stuck after updating service_account.json

**Claude:** Credentials file looks valid. Most likely cause: **Google Sheets API not enabled**.

- Cloud Console → APIs & Services → Library → search "Google Sheets API" → **Enable**
- Share sheet with `restaurant@puzzle-3-restaurant.iam.gserviceaccount.com` as Editor

---

## Change logic: all locations, 5 results each, append mode

**User:** change logic. query all locations each 5 result per 1 location in 1 request and append to google sheet not write a new one.

**Claude:** Three changes made to `scraper.ts`:
- `MIN_RESULTS_PER_LOCATION = 5`
- Restored full loop over all 5 locations (ทองหล่อ, พร้อมพงศ์, สยาม, อารีย์, สาธร)
- `writeToSheet` now appends rows instead of clearing; writes headers only if sheet is empty

---

## Opening hours showing `[object Object]`

**User:** column "เวลาเปิดปิด" always is `[object Object] | [object Object] | [object Object]`

**Claude:** The `openingHours` field from the actor returns objects `{ day: "Monday", hours: "9:00 AM – 9:00 PM" }`, not strings.

Fixed in `flattenRestaurant`:
```ts
.map((h: any) =>
  typeof h === "object" ? `${h.day ?? ""}: ${h.hours ?? h.hour ?? ""}` : String(h)
)
```

Now produces: `Monday: 9:00 AM – 9:00 PM | Tuesday: ... | Wednesday: ...`



# Conversation Log – Result Page & Template System

---

## Define scrape fields

**User:** Fields data to scrape are:

| English | ภาษาไทย |
|---|---|
| Restaurant Name | ชื่อร้าน |
| Area | พื้นที่ |
| Food Type | ประเภทอาหาร |
| Google Rating | คะแนนรีวิว |
| Review Count | จำนวนรีวิว |
| Price Range | ช่วงราคา |
| Location / Address | ที่ตั้ง |
| Distance / Travel Note | หมายเหตุการเดินทาง |
| Opening Hours | เวลาเปิดปิด |
| Suitable for Group | เหมาะกับกลุ่มหรือไม่ |
| Source URL | ลิงก์แหล่งข้อมูล |
| Notes | หมายเหตุเพิ่มเติม |

**Claude:** Updated `src/scraper.ts`:
- Replaced the old `Restaurant` interface with the 12 fields above
- Renamed mismatched fields: `ย่าน` → `พื้นที่`, `คะแนน` → `คะแนนรีวิว`, `ราคาเฉลี่ย` → `ช่วงราคา`, `ที่อยู่` → `ที่ตั้ง`, `เวลาเปิด-ปิด` → `เวลาเปิดปิด`, `"Google Maps URL"` → `ลิงก์แหล่งข้อมูล`
- Added 3 new empty fields for manual fill-in: `หมายเหตุการเดินทาง`, `เหมาะกับกลุ่มหรือไม่`, `หมายเหตุเพิ่มเติม`
- Removed: `เบอร์โทร`, `เว็บไซต์`, `วันที่ดึงข้อมูล`
- Updated `flattenRestaurant` mapping and `r.ย่าน` reference in `scrapeAndSave`

---

## Fix column misalignment & empty-row guard

**User:** Data is in invalid column — "เวลาเปิดปิด" data appears under the "Google Maps URL" column header. Only write data to Google Sheets if data exists.

**Root cause:** The Google Sheet still had old headers from a previous run. The code only wrote headers when A1 was empty, so stale headers were never replaced — every column after the rename shifted out of sync.

**Claude:** Two fixes in `src/scraper.ts`:
1. **Always overwrite row 1** — removed the `if A1 is empty` guard so headers are always synced to the current interface.
2. **Filter empty rows** — `dataRows` now filters out entries where `ชื่อร้าน` is empty before appending.

```ts
await sheets.spreadsheets.values.update({
  spreadsheetId,
  range: `${SHEET_TAB_NAME}!A1`,
  valueInputOption: "USER_ENTERED",
  requestBody: { values: [headers] },
});

const dataRows = restaurants
  .filter((r) => r.ชื่อร้าน)
  .map((r) => headers.map((h) => String(r[h] ?? "")));
```

---

## Create static HTML website (result.html)

**User:** Create static HTML website using `result.html` to display Top 3 restaurants for a team of 8–12 people. Data from Google Sheets, modern retro theme.

**Claude:** Since `service_account.json` is server-side only, the page is server-rendered at `GET /result` by the Elysia server. Three parts needed:
1. `result.html` — template file with `{{cards}}` and `{{date}}` placeholders
2. `getTopRestaurants()` in `scraper.ts` — reads sheet, sorts by score then review count, returns top 3
3. `/result` route in `index.ts` — reads template, injects data, serves HTML

---

## Template engine options

**User:** Can I use a dynamic template like Blade in Laravel?

**Claude:** Yes. Three options:

| Engine | Syntax | Notes |
|---|---|---|
| **Handlebars** | `{{var}}` `{{#each}}` `{{#if}}` | Most Blade-like |
| **Eta** | `<%= var %>` | Fastest, tiny |
| **Plain template literals** | JS string interpolation | Zero dependencies |

---

## Chosen approach: plain template literals with separate HTML file

**User:** Not Handlebars. What is the standard library you recommend? Can I use only Elysia.js?

**Claude:** Two options without Handlebars:
- `@elysiajs/html` (JSX, requires `.tsx` + tsconfig changes)
- **Plain TypeScript template literals** — zero dependencies, works as-is

**Recommended: Option 2** (plain template literals).

---

## Separate template to its own HTML file

**User:** Can I separate the template to a new HTML file?

**Claude:** Yes. Pattern:
- `result.html` contains full layout + CSS with `{{placeholder}}` markers
- TypeScript reads the file, generates dynamic sections, replaces markers

```ts
function renderPage(restaurants: Restaurant[]): string {
  const template = readFileSync("result.html", "utf-8");
  const cards = restaurants.map((r, i) => renderCard(r, i + 1)).join("");
  return template
    .replace("{{cards}}", cards)
    .replace("{{date}}", new Date().toLocaleDateString("th-TH"));
}
```

Key benefit: edit `result.html` for styling/layout and refresh — no TypeScript restart needed.

---

## Implementation

**Files created / updated:**

### `result.html`
Full page template with modern retro theme:
- Warm cream background with dot pattern
- Google Fonts: Playfair Display (headings) + Sarabun (Thai body)
- Neo-brutalist cards with hard offset shadow (`box-shadow: 6px 6px 0 var(--ink)`)
- Gold / silver / bronze rank bars and badges
- Placeholders: `{{cards}}` and `{{date}}`

### `src/scraper.ts` — added `getTopRestaurants()`
```ts
export async function getTopRestaurants(limit = 3): Promise<Restaurant[]> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_TAB_NAME}!A1:L`,
  });
  return dataRows
    .filter((r) => r.ชื่อร้าน)
    .sort((a, b) => {
      const sd = Number(b.คะแนนรีวิว || 0) - Number(a.คะแนนรีวิว || 0);
      return sd !== 0 ? sd : Number(b.จำนวนรีวิว || 0) - Number(a.จำนวนรีวิว || 0);
    })
    .slice(0, limit);
}
```

### `src/index.ts` — added `/result` route
```ts
.get("/result", async ({ set }) => {
  const restaurants = await getTopRestaurants();
  set.headers["content-type"] = "text/html; charset=utf-8";
  return renderPage(restaurants);
})
```

**Visit:** `http://localhost:9145/result`

# Conversation Log – Vercel API Deployment Debugging

---

## /api/scrape stuck on Authenticating

**User:** `curl --location --request POST 'https://resteraunt-p0r829jrj-aramnongjoys-projects.vercel.app/api/scrape'` is stuck on Authenticating

**Claude:** Two issues found:

1. **Missing `x-scrape-secret` header** — `api/scrape.ts` checks for `x-scrape-secret` header against `SCRAPE_SECRET` env var. The curl command omitted it.
2. **`GOOGLE_CREDENTIALS_JSON` not set on Vercel** — `getSheetsClient()` falls back to reading `service_account.json` from disk, which doesn't exist on Vercel. The "Authenticating" hang comes from `scraper.ts:136` (`🔑 กำลัง authenticate...`) inside `writeToSheet()`.

**Fix:** Add `GOOGLE_CREDENTIALS_JSON` as a Vercel environment variable with the full JSON content of `service_account.json`.

---

## All env vars confirmed set in Vercel

**User:** *(screenshot — Vercel env vars: SCRAPE_SECRET, GOOGLE_CREDENTIALS_JSON, APIFY_TOKEN, GOOGLE_SHEET_ID all set)*

Just set SCRAPE_SECRET but already set GOOGLE_CREDENTIALS_JSON.

**Claude:** Add the `x-scrape-secret` header to curl:
```bash
curl --location --request POST 'https://resteraunt-p0r829jrj-aramnongjoys-projects.vercel.app/api/scrape' \
  --header 'x-scrape-secret: SCRAPE_SECRET'
```
The `SCRAPE_SECRET` value in `.env` is literally `SCRAPE_SECRET`.

---

## `bun run scrape` runs nothing

**User:** *(screenshot — `bun run scrape` shows bun usage/flags help instead of running)*

**Claude:** The `-e` flag doesn't work with `bun run`. Created `scripts/scrape.ts` and updated `package.json`:

```ts
// scripts/scrape.ts
import { scrapeAndSave } from "../src/scraper";
const result = await scrapeAndSave();
console.log("\nDone:", result);
```

```json
"scrape": "bun scripts/scrape.ts"
```

---

## FUNCTION_INVOCATION_FAILED (first time)

**User:** `A server error has occurred FUNCTION_INVOCATION_FAILED sin1::vgnn4-...`

**Vercel log:**
```
Warning: Failed to load the ES module: /var/task/api/scrape.js.
Make sure to set "type": "module" in the nearest package.json file or use the .mjs extension.
/var/task/api/scrape.js:1
import { scrapeAndSave } from "../src/scraper";
```

**Claude:** Added `"type": "module"` to `package.json`. Vercel was treating the compiled JS as CommonJS.

---

## FUNCTION_INVOCATION_FAILED (second time)

**User:** `A server error has occurred FUNCTION_INVOCATION_FAILED sin1::9ww9d-...`

**Vercel log:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/src/scraper'
imported from /var/task/api/scrape.js
```

**Claude:** In ESM, relative imports require explicit `.js` extensions. Fixed `api/scrape.ts`:
```ts
// before
import { scrapeAndSave } from "../src/scraper";

// after
import { scrapeAndSave } from "../src/scraper.js";
```

---

## FUNCTION_INVOCATION_FAILED (third time)

**User:** `A server error has occurred FUNCTION_INVOCATION_FAILED sin1::...`

**Vercel log:**
```
TypeError: req.headers.get is not a function
    at handler (/vercel/path0/api/scrape.ts:10:30)
```

**Root cause:** The handler was typed as `handler(req: Request)` using the Web API `Request` type, but Vercel's Node.js runtime passes a Node.js `IncomingMessage` object — which has `req.headers` as a plain object, not a `Headers` instance with `.get()`.

**Claude:** Rewrote `api/scrape.ts` to use Node.js `IncomingMessage`/`ServerResponse`:

```ts
import type { IncomingMessage, ServerResponse } from "http";
import { scrapeAndSave } from "../src/scraper.js";

export const maxDuration = 300;

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const secret = req.headers["x-scrape-secret"];
  if (process.env.SCRAPE_SECRET && secret !== process.env.SCRAPE_SECRET) {
    return json(res, 401, { error: "Unauthorized" });
  }

  try {
    const result = await scrapeAndSave();
    json(res, 200, {
      success: true,
      totalRestaurants: result.total,
      breakdown: result.breakdown,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}`,
    });
  } catch (err: any) {
    json(res, 500, { success: false, error: err.message });
  }
}
```

Key change: `req.headers["x-scrape-secret"]` (plain object access) instead of `req.headers.get("x-scrape-secret")`.




## Can Vercel run route `/scrape`?

**User:** is there any way to get vercel.com can run route /scrape on host

**Claude:** Yes, but there's a timing problem. The current `POST /scrape` calls Apify with `waitSecs: 300` (5 minutes) — Vercel serverless functions time out at **10s (Hobby)** or **300s (Pro)**.

**Options:**

| Option | Description |
|---|---|
| **A — Vercel API Route + Fire-and-forget** | Create `api/scrape.ts`, trigger Apify without waiting, return 202 immediately |
| **B — Vercel Cron Job** | Schedule `POST /scrape` automatically (e.g. every morning) — Vercel Pro |
| **C — Keep scraper outside Vercel** | Run on Railway/Render; Vercel only serves the static result page |

**Recommendation:** Option A — create a thin `api/scrape.ts` that fires Apify in parallel (not sequentially) to fit within the 300s Pro timeout.

---

## Create `api/scrape.ts`

**User:** can you create api/scrape.ts

**Claude:** Three changes made:

### New file — `api/scrape.ts`

Standard Vercel serverless function using Web `Request`/`Response` API:

```ts
import { scrapeAndSave } from "../src/scraper";

export const maxDuration = 300;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const secret = req.headers.get("x-scrape-secret");
  if (process.env.SCRAPE_SECRET && secret !== process.env.SCRAPE_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await scrapeAndSave();
    return Response.json({
      success: true,
      totalRestaurants: result.total,
      breakdown: result.breakdown,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}`,
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
```

### `src/scraper.ts` — fix `Bun.sleep` + parallelize

Replaced sequential loop + `Bun.sleep` (Bun-specific, breaks on Vercel's Node.js runtime) with `Promise.allSettled` so all 5 locations scrape in parallel:

```ts
// before
for (const location of LOCATIONS) {
  const items = await runApifyScraper(client, location);
  // ...
  await Bun.sleep(1500);
}

// after
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
```

### `vercel.json` — add `maxDuration`

```json
{
  "framework": null,
  "buildCommand": "bun run scripts/generate.ts",
  "outputDirectory": "public",
  "installCommand": "bun install",
  "functions": {
    "api/scrape.ts": {
      "maxDuration": 300
    }
  }
}
```

**Note:** `maxDuration: 300` requires Vercel Pro. Hobby plan limit is 10s.

**Required Vercel env vars:** `APIFY_TOKEN`, `GOOGLE_SHEET_ID`, `GOOGLE_CREDENTIALS_JSON` (full JSON string of `service_account.json`), `SCRAPE_SECRET`

**Trigger after deploy:**
```bash
curl -X POST https://your-project.vercel.app/api/scrape \
  -H "x-scrape-secret: your-secret"
```

---

## Handler rewritten to use Node.js `IncomingMessage`

**Root cause:** `api/scrape.ts` was typed as `handler(req: Request)` using the Web API `Request` type, but Vercel's Node.js runtime passes a Node.js `IncomingMessage` — `req.headers` is a plain object, not a `Headers` instance, so `.get()` threw `TypeError: req.headers.get is not a function`.

**Fix:** Rewrote to use `IncomingMessage`/`ServerResponse` from Node.js `http` module:

```ts
import type { IncomingMessage, ServerResponse } from "http";
import { scrapeAndSave } from "../src/scraper.js";

export const maxDuration = 300;

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const secret = req.headers["x-scrape-secret"];
  if (process.env.SCRAPE_SECRET && secret !== process.env.SCRAPE_SECRET) {
    return json(res, 401, { error: "Unauthorized" });
  }

  try {
    const result = await scrapeAndSave();
    json(res, 200, {
      success: true,
      totalRestaurants: result.total,
      breakdown: result.breakdown,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}`,
    });
  } catch (err: any) {
    json(res, 500, { success: false, error: err.message });
  }
}
```

Key change: `req.headers["x-scrape-secret"]` (plain object property access) instead of `req.headers.get("x-scrape-secret")`.

Also updated import to use explicit `.js` extension (required for ESM on Vercel):
```ts
import { scrapeAndSave } from "../src/scraper.js";
```
