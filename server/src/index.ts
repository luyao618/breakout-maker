import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { TrialQuotaStore } from "./trial-quota.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";
if (!process.env.IMAGE_API_KEY && !process.env.LLM_API_KEY) {
  console.error("ERROR: IMAGE_API_KEY or LLM_API_KEY must be configured");
  process.exit(1);
}
const quota = new TrialQuotaStore(
  process.env.QUOTA_STORE_PATH ||
    path.resolve(directory, "../data/trial-quota.json"),
);
const app = createApp({
  quota,
  publicDir: path.resolve(directory, "../../public"),
});
app.listen(PORT, HOST, () =>
  console.log(`Breakout Maker listening on ${HOST}:${PORT}`),
);
