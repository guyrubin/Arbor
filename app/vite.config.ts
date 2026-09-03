import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";
import path from "path";
import { defineConfig } from "vite";

// MOB-20: the app version shown in Settings → About comes from package.json
// at build time (lib/appInfo.ts reads the define; "dev" when absent).
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")) as { version?: string };

export default defineConfig(() => {
  return {
    base: "./",
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version ?? "0.0.0"),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== "true",
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // Split heavy vendors so the app chunk stays lean and vendors cache
          // independently across deploys (A9).
          manualChunks: {
            "vendor-firebase": ["firebase/app", "firebase/auth", "firebase/firestore"],
            "vendor-charts": ["recharts"],
            "vendor-dnd": ["@dnd-kit/core", "@dnd-kit/sortable"],
            "vendor-motion": ["motion"],
          },
        },
      },
    },
  };
});
