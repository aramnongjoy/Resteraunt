import type { IncomingMessage, ServerResponse } from "http";
import { getAllRestaurants } from "../src/scraper.js";

export const maxDuration = 30;

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "s-maxage=120, stale-while-revalidate=60",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
}

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  try {
    const restaurants = await getAllRestaurants();
    const areas = ["ทองหล่อ", "พร้อมพงศ์", "สยาม", "อารีย์", "อโศก"];
    const breakdown: Record<string, number> = {};
    areas.forEach((a) => {
      breakdown[a] = restaurants.filter((r) => r.พื้นที่ === a).length;
    });
    json(res, 200, { restaurants, total: restaurants.length, breakdown });
  } catch (err: any) {
    json(res, 500, { error: err.message });
  }
}
