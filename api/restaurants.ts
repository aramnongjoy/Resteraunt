import type { IncomingMessage, ServerResponse } from "http";
import { getTopRestaurants } from "../src/scraper.js";

export const maxDuration = 30;

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "s-maxage=300, stale-while-revalidate=60",
  });
  res.end(JSON.stringify(body));
}

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  try {
    const restaurants = await getTopRestaurants(3);
    json(res, 200, { restaurants });
  } catch (err: any) {
    json(res, 500, { error: err.message });
  }
}
