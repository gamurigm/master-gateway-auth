import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const apiUrl = process.env.FRONTEND_API_URL;

if (!apiUrl) {
  throw new Error("FRONTEND_API_URL is required");
}

if (apiUrl !== "/api") {
  const parsed = new URL(apiUrl);
  if (parsed.protocol !== "https:" || !parsed.pathname.endsWith("/api")) {
    throw new Error("FRONTEND_API_URL must be an HTTPS URL ending in /api");
  }
}

const outputPath = fileURLToPath(
  new URL(
    "../frontend/src/environments/environment.production.ts",
    import.meta.url,
  ),
);
const content = `export const environment = {\n  apiUrl: ${JSON.stringify(apiUrl)},\n};\n`;

await writeFile(outputPath, content, "utf8");
const apiOrigin = apiUrl === "/api" ? "same-origin" : new URL(apiUrl).origin;
console.log(`Configured frontend API origin: ${apiOrigin}`);
