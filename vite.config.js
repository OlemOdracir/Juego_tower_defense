import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        preview: resolve(__dirname, 'preview.html'),
        assetLab: resolve(__dirname, 'asset-lab.html'),
        vehicleLab: resolve(__dirname, 'vehicle-lab.html'),
      },
    },
  },
});
