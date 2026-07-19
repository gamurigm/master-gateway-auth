import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const apiUrl = process.env.FRONTEND_API_URL;
const inventoryApiUrl = process.env.FRONTEND_INVENTARIO_API_URL ?? "/inventario";

if (!apiUrl) {
  throw new Error("FRONTEND_API_URL is required");
}

if (apiUrl !== "/api") {
  const parsed = new URL(apiUrl);
  if (parsed.protocol !== "https:" || !parsed.pathname.endsWith("/api")) {
    throw new Error("FRONTEND_API_URL must be an HTTPS URL ending in /api");
  }
}

if (!inventoryApiUrl.startsWith("/")) {
  const parsed = new URL(inventoryApiUrl);
  const isLocalHttp =
    parsed.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);

  if (parsed.protocol !== "https:" && !isLocalHttp) {
    throw new Error(
      "FRONTEND_INVENTARIO_API_URL must be HTTPS, localhost HTTP, or same-origin",
    );
  }
}

const outputPath = fileURLToPath(
  new URL(
    "../frontend/src/environments/environment.production.ts",
    import.meta.url,
  ),
);
const content = `export const environment = {\n  apiUrl: ${JSON.stringify(apiUrl)},\n  inventoryApiUrl: ${JSON.stringify(inventoryApiUrl)},\n};\n`;

await writeFile(outputPath, content, "utf8");
const apiOrigin = apiUrl === "/api" ? "same-origin" : new URL(apiUrl).origin;
console.log(`Configured frontend API origin: ${apiOrigin}`);
console.log(`Configured frontend inventory API: ${inventoryApiUrl}`);