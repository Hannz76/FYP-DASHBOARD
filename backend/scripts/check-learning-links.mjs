import { learningCatalog } from "../data/learningCatalog.js";

console.log("Checking published learning destinations. HTTP success does not verify enrollment, completion, current price or curriculum alignment.");
for (const resource of learningCatalog.resources.filter((item) => item.publication.status === "active")) {
  try {
    const response = await fetch(resource.url, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "FYP-Dashboard-Learning-Link-Check/1.0", Accept: "text/html" },
    });
    const html = await response.text();
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "Title not exposed").replace(/\s+/g, " ").trim();
    console.log(`${response.ok ? "PASS" : "FAIL"} ${resource.id}: HTTP ${response.status}; ${response.url}; ${title}`);
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    console.error(`FAIL ${resource.id}: ${error.message}`);
    process.exitCode = 1;
  }
}
