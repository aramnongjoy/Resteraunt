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





## Turn 1 — Define scrape fields

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

## Turn 2 — Fix column misalignment & empty-row guard

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

## Turn 3 — Export conversation

**User:** Export this conversation, then save into chat.md

**Assistant:** Created this file (`chat.md`) at the project root.
