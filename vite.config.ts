import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    rollupOptions: {
      input: fileURLToPath(new URL('./course-source.html', import.meta.url)),
      output: {
        // The root index.html must remain a genuinely self-contained offline file.
        // Runtime renderer imports are still real implementation bindings, but the
        // release bundle folds their chunks back into the single entry script.
        inlineDynamicImports: true,
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4317,
    strictPort: true,
    open: '/course-source.html',
  },
  preview: {
    host: '127.0.0.1',
    port: 4317,
    strictPort: true,
  },
})
