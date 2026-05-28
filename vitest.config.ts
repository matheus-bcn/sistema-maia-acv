import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Engenharia de Infraestrutura: Recriando as variáveis do CommonJS no padrão ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    alias: {
      // 2. Apontamento seguro para a raiz do projeto utilizando a variável __dirname recriada
      '@': path.resolve(__dirname, './'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});