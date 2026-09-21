import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "automatic",
    }),
  ],
  server: {
    port: 5173,
    strictPort: false,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "recharts", "lucide-react", "react-is"],
  },
  resolve: {
    extensions: [".jsx", ".js", ".tsx", ".ts"],
  },
});
