import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { formatBuildVersion } from "./src/lib/buildVersion";

export default defineConfig(() => {
  return {
    base: "./",
    // B-INF-05: the hosting build runs with GITHUB_SHA set; About shows its
    // 7-char form. Without a SHA (local dev) the About row says "dev".
    define: {
      __APP_VERSION__: JSON.stringify(formatBuildVersion(process.env.GITHUB_SHA)),
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
