import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base must match the GitHub Pages sub-path: https://pairic1.github.io/HouseMoney/
export default defineConfig({
  plugins: [react()],
  base: '/HouseMoney/',
});
