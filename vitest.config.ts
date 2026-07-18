import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/**'],
    alias: {
      'cm-chessboard/src/extensions/arrows/Arrows.js': resolve(__dirname, 'node_modules/cm-chessboard/src/extensions/arrows/Arrows.js'),
      'cm-chessboard/src/extensions/markers/Markers.js': resolve(__dirname, 'node_modules/cm-chessboard/src/extensions/markers/Markers.js'),
      'cm-chessboard': resolve(__dirname, 'node_modules/cm-chessboard/src/Chessboard.js')
    }
  }
});
