import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "extension-metadata",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "manifest.json",
          source: readFileSync("manifest.json", "utf8"),
        })
        this.emitFile({
          type: "asset",
          fileName: "LICENSE",
          source: readFileSync("LICENSE", "utf8"),
        })
      },
    },
  ],
  base: "./",
  build: {
    rolldownOptions: {
      input: {
        app: "index.html",
        background: "src/background/service-worker.ts",
        content: "src/features/synchronization/content-script.ts",
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === "app" ? "assets/[name]-[hash].js" : `${chunk.name}.js`),
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
})
