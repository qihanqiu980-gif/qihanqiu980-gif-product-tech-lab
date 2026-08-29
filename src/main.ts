import { createApp } from 'vue'
import App from './App.vue'
import '@fontsource-variable/noto-sans-sc'
import './styles.css'

createApp(App).mount('#app')

const serviceWorkerPath = document.querySelector<HTMLMetaElement>('meta[name="course-service-worker"]')?.content

if ('serviceWorker' in navigator && import.meta.env.PROD && serviceWorkerPath) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(serviceWorkerPath).catch(() => {
      // 离线缓存是增强能力，失败不阻断课程。
    })
  })
}
