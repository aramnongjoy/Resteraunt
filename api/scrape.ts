import { scrapeAndSave } from "../src/scraper.js";

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
