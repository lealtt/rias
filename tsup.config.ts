import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  outExtension({ format }) {
    return format === "esm" ? { js: ".mjs" } : { js: ".cjs" };
  },
});
