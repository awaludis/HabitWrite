import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Relative base so the build works on GitHub Pages or any sub-path.
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "HabitWrite – Latihan Menulis",
        short_name: "HabitWrite",
        description: "Latihan menulis terstruktur berbasis kata kunci, dinilai oleh Claude.",
        lang: "id",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#fcfcfb",
        theme_color: "#2a78d6",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,mjs,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1500 },
  test: { environment: "node" },
} as any);
