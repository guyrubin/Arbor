import dotenv from "dotenv";
import { loadConfig } from "./src/config/env.js";
import { createApp } from "./src/server/createApp.js";
import { startHttpServer } from "./src/server/start.js";

dotenv.config();

const config = loadConfig();
const app = createApp(config);

startHttpServer(app, config).catch((error) => {
  console.error("Failed to start Arbor Express/Vite server:", error);
  process.exit(1);
});
