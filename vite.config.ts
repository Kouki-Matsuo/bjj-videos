import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// host: true にすると、同じWi-Fi上のiPhoneからアクセスできます
// base: './' にすると、GitHub Pages の https://ユーザー名.github.io/リポジトリ名/ のような
// サブフォルダに置いても画像やJSファイルを正しく読み込めます
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
