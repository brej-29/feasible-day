import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base "./" so the build works on GitHub Pages project sites and Hugging Face static Spaces alike
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: { include: ["tests/**/*.test.ts"] },
});
