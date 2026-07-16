import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// ZK proving runs as WebAssembly in the browser, hence the wasm + top-level-await
// plugins. `server.fs.allow` lets Vite read the compiled contract from
// `../managed` (the repo-root output of `npm run compact`), which lives outside
// this Vite project's own root.
export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  // esbuild's default downlevel target chokes on destructuring syntax inside
  // some wasm-bindgen glue code pulled in transitively; the wasm/TLA plugins
  // need a modern target anyway, so build straight to esnext everywhere.
  build: {
    target: "esnext",
  },
  esbuild: {
    target: "esnext",
  },
  optimizeDeps: {
    exclude: ["@midnight-ntwrk/compact-runtime"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
});
