/**
 * Dedicated Vite build for the Android (Capacitor) WebView.
 *
 * Root is `capacitor/` so the entry `index.html` lands directly at the
 * build outDir root (dist/android/index.html), not in a nested folder.
 * Aliases still resolve `@/` to `src/` outside the root.
 *
 * Run:  npx vite build --config vite.config.capacitor.ts
 * Out:  dist/android/index.html  (consumed by Capacitor via webDir)
 */
import { defineConfig } from "vite";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

const PROJECT_ROOT = __dirname;
const SRC = path.resolve(PROJECT_ROOT, "src");

export default defineConfig({
  root: path.resolve(PROJECT_ROOT, "capacitor"),
  base: "./",
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: path.resolve(SRC, "routes"),
      generatedRouteTree: path.resolve(SRC, "routeTree.gen.ts"),
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": SRC,
    },
    dedupe: [
      "react",
      "react-dom",
      "@tanstack/react-router",
      "@tanstack/react-query",
    ],
  },
  define: {
    "import.meta.env.SSR": "false",
  },
  server: {
    fs: { allow: [PROJECT_ROOT] },
  },
  build: {
    outDir: path.resolve(PROJECT_ROOT, "dist/android"),
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Manual chunk splitting to keep the initial bundle small.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-dom") || id.match(/[\\/]react[\\/]/))
            return "vendor-react";
          if (id.includes("@tanstack/react-router") || id.includes("@tanstack/router-"))
            return "vendor-router";
          if (id.includes("@tanstack/react-query"))
            return "vendor-query";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("date-fns")) return "vendor-date";
          if (id.includes("zustand") || id.includes("idb-keyval")) return "vendor-state";
          if (id.includes("@capacitor")) return "vendor-capacitor";
          return "vendor";
        },
      },
    },
  },
});
