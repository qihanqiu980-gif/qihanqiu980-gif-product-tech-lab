import type { DayId } from './course/types'

export type AppRoute =
  | { view: 'today' | 'course' | 'review' | 'progress' | 'glossary' }
  | { view: 'lesson'; week: number }
  | { view: 'day'; dayId: DayId }

const simpleRoutes = new Set(['today', 'course', 'review', 'progress', 'glossary'])

export function parseHashRoute(hash = window.location.hash): AppRoute {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '')
  if (!path) return { view: 'today' }
  const segments = path.split('/')
  const [kind, value] = segments
  if (segments.length === 2 && kind === 'lesson' && /^W(?:[1-9]|1[0-2])D[1-6]$/.test(value || '')) return { view: 'day', dayId: value as DayId }
  if (segments.length === 2 && kind === 'week' && /^\d+$/.test(value || '')) return { view: 'lesson', week: Number(value) }
  if (segments.length === 1 && simpleRoutes.has(kind)) return { view: kind as 'today' | 'course' | 'review' | 'progress' | 'glossary' }
  return { view: 'today' }
}

export function routeToHash(route: AppRoute): string {
  if (route.view === 'day') return `#/lesson/${route.dayId}`
  if (route.view === 'lesson') return `#/week/${route.week}`
  return `#/${route.view}`
}

export function writeHashRoute(route: AppRoute, replace = false) {
  const next = routeToHash(route)
  if (window.location.hash === next) return
  if (replace) window.history.replaceState(null, '', next)
  else window.location.hash = next
}
