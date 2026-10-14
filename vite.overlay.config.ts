import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { resolve } from "node:path"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "overlay-mount",
      generateBundle(_, bundle) {
        const entry = Object.values(bundle).find((output) => output.type === "chunk" && output.isEntry)
        if (!entry || entry.type !== "chunk") throw new Error("The overlay entry script was not generated.")
        // executeScript evaluates a classic script in the isolated world and
        // waits for this final expression's promise, including mount failures.
        entry.code += "\nViewportStudioOverlay.mountWorkspace()\n"
      },
    },
  ],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  base: "./",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  css: {
    postcss: {
      plugins: [
        {
          postcssPlugin: "overlay-rem-units",
          // Shadow DOM does not isolate rem from the website's html font size.
          // Convert values only, preserving utility class names containing rem.
          Declaration(declaration) {
            declaration.value = declaration.value.replace(
              /(-?(?:\d*\.)?\d+)rem\b/g,
              (_, value) => `${Number(value) * 16}px`
            )
          },
          AtRule(rule) {
            if (rule.name === "media" || rule.name === "container")
              rule.params = rule.params.replace(/(-?(?:\d*\.)?\d+)rem\b/g, (_, value) => `${Number(value) * 16}px`)
          },
        },
      ],
    },
  },
  build: {
    emptyOutDir: false,
    cssCodeSplit: false,
    // Bundle dialogs and font assets into the injected classic script. Module
    // requests from a website frame can trigger Chrome's unsafe-load errors.
    lib: {
      entry: "src/overlay.tsx",
      name: "ViewportStudioOverlay",
      formats: ["iife"],
      fileName: () => "overlay.js",
    },
  },
})
