import { build } from "vite";
import { fileURLToPath } from "node:url";

// A standalone classic worker works with both the local Vite preview and Next.js on Vercel.
await build({
  configFile: false,
  root: fileURLToPath(new URL("..", import.meta.url)),
  publicDir: false,
  build: {
    target: "es2022",
    outDir: "public/generated",
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL("../workers/recipe.worker.ts", import.meta.url)),
      name: "CookingTubeWorker",
      formats: ["iife"],
      fileName: () => "recipe.worker.js",
    },
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
