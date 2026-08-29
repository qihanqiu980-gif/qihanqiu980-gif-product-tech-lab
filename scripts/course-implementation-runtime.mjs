import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

/**
 * Load renderer modules through the same Vite/Vue transform used by the app.
 * A callable function alone is insufficient: this proves that the registered
 * loader resolves and exposes a Vue component module for the registered Day.
 */
export async function inspectDailyCourseRendererModules(implementations) {
  if (!implementations.length) return []

  const server = await createServer({
    root: projectRoot,
    configFile: false,
    plugins: [vue()],
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  })

  try {
    const registry = await server.ssrLoadModule('/src/course/implementationRegistry.ts')
    const results = []
    for (const expected of implementations) {
      const implementation = registry.getDayImplementation(expected.dayId)
      if (!implementation) {
        results.push({
          dayId: expected.dayId,
          renderer: expected.renderer.key,
          resolved: false,
          issues: [`SSR 注册表无法解析 ${expected.dayId}。`],
        })
        continue
      }
      if (implementation.renderer.dayId !== expected.dayId || implementation.renderer.key !== expected.renderer.key) {
        results.push({
          dayId: expected.dayId,
          renderer: expected.renderer.key,
          resolved: false,
          issues: [`SSR renderer 绑定漂移为 ${implementation.renderer.dayId}/${implementation.renderer.key}。`],
        })
        continue
      }

      try {
        const rendererModule = await implementation.renderer.load()
        const resolved = Boolean(rendererModule?.default)
        results.push({
          dayId: expected.dayId,
          renderer: expected.renderer.key,
          resolved,
          issues: resolved ? [] : [`renderer ${expected.renderer.key} 没有 default export。`],
        })
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        results.push({
          dayId: expected.dayId,
          renderer: expected.renderer.key,
          resolved: false,
          issues: [`renderer ${expected.renderer.key} 模块加载失败：${detail}`],
        })
      }
    }
    return results
  } finally {
    await server.close()
  }
}
