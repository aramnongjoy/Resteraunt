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
