import dotenv from "dotenv";
import { loadConfig } from "./src/config/env.js";
import { createApp } from "./src/server/createApp.js";
import { startHttpServer } from "./src/server/start.js";

// Load .env first, then let .env.local override it (the documented + gitignored
// place for local secrets like GEMINI_API_KEY). Plain dotenv.config() only reads
// .env, so a key placed in .env.local was silently ignored.
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const config = loadConfig();
const app = createApp(config);

startHttpServer(app, config).catch((error) => {
  console.error("Failed to start Arbor Express/Vite server:", error);
  process.exit(1);
});
