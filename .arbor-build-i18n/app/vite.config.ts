import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(() => {
  return {
    base: "./",
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
