<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import referenceEncoded from '../reference/w1d1-approved.base64.txt?raw'
import { w1d1 } from '../course/w1d1'
import {
  getDayProgress,
  loadEvidenceState,
  markSectionVisited,
  saveDayDraft,
  saveEvidenceState,
  setDayProgressStatus,
  type EvidenceState,
} from '../evidenceStore'

type ProductView = 'today' | 'course' | 'review' | 'progress' | 'glossary'

interface ReplicaAction {
  kind: 'click' | 'input'
  key: string
  value?: string
  checked?: boolean
}

interface ReplicaDraft {
  schemaVersion: 1
  lessonId: 'W1D1'
  sourceSha256: '6bc6ced62ea095ac51e94fb006f98fbf3e51d30bcda341cb7f9f96f549d5c0bd'
  actions: ReplicaAction[]
  savedAt: string
}

const emit = defineEmits<{
  back: []
  requestConfirmation: []
  navigate: [view: ProductView]
  'update:durationMode': [mode: 30 | 45]
  'evidence-change': [state: EvidenceState]
}>()

withDefaults(defineProps<{
  durationMode?: 30 | 45
}>(), {
  durationMode: 45,
})

const DRAFT_KEY = 'w1d1ReferenceReplica'
const SOURCE_SHA256 = '6bc6ced62ea095ac51e94fb006f98fbf3e51d30bcda341cb7f9f96f549d5c0bd' as const
const referenceBytes = Uint8Array.from(globalThis.atob(referenceEncoded.trim()), (character) => character.charCodeAt(0))
// Keep the approved reference bytes untouched. The user-requested W1D1
// surface removes only the visible desktop/mobile/review toolbar; hidden
// controls remain so the reference interaction script can initialize safely.
const referenceHtml = new TextDecoder().decode(referenceBytes).replace(
  /<div class="w1-preview-tools">[\s\S]*?<\/div>\s*<div class="w1-window">/,
  '<div class="w1-preview-tools" hidden aria-hidden="true" style="display:none!important">' +
    '<button type="button" data-device-choice="desktop" aria-pressed="true" tabindex="-1"></button>' +
    '<button type="button" data-device-choice="mobile" aria-pressed="false" tabindex="-1"></button>' +
    '<button type="button" data-review-toggle aria-pressed="true" tabindex="-1"></button>' +
  '</div>\n\n  <div class="w1-window">',
)
const replicaFrame = ref<HTMLIFrameElement | null>(null)
const evidenceLedger = ref(loadEvidenceState())
let actions: ReplicaAction[] = readSavedActions()
let persistTimer: number | undefined
let frameCleanup: (() => void) | undefined
let replaying = false
let completionRequested = false

function readSavedActions(): ReplicaAction[] {
  const raw = getDayProgress(evidenceLedger.value, w1d1.id).drafts[DRAFT_KEY]
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Partial<ReplicaDraft>
    if (parsed.schemaVersion !== 1 || parsed.lessonId !== w1d1.id || parsed.sourceSha256 !== SOURCE_SHA256 || !Array.isArray(parsed.actions)) return []
    return parsed.actions.filter((action): action is ReplicaAction => (
      (action.kind === 'click' || action.kind === 'input')
      && typeof action.key === 'string'
      && (action.value === undefined || typeof action.value === 'string')
      && (action.checked === undefined || typeof action.checked === 'boolean')
    ))
  } catch {
    return []
  }
}

function persistReplicaDraft(documentRef?: Document) {
  if (!actions.length && !completionRequested) return
  const now = new Date().toISOString()
  const draft: ReplicaDraft = {
    schemaVersion: 1,
    lessonId: 'W1D1',
    sourceSha256: SOURCE_SHA256,
    actions,
    savedAt: now,
  }
  evidenceLedger.value = saveDayDraft(evidenceLedger.value, w1d1.id, DRAFT_KEY, JSON.stringify(draft), now)

  const activeRoute = documentRef?.querySelector<HTMLElement>('.w1-route-item[aria-current="location"], .w1-route-item[aria-current="step"]')
  const chapterIndex = activeRoute?.dataset.route
  if (chapterIndex !== undefined) {
    evidenceLedger.value = markSectionVisited(evidenceLedger.value, w1d1.id, `prototype-chapter-${Number(chapterIndex) + 1}`, now)
  }

  const currentStatus = getDayProgress(evidenceLedger.value, w1d1.id).status
  if (completionRequested) {
    evidenceLedger.value = setDayProgressStatus(evidenceLedger.value, w1d1.id, 'completed', now)
  } else if (currentStatus !== 'completed') {
    evidenceLedger.value = setDayProgressStatus(evidenceLedger.value, w1d1.id, 'in-progress', now)
  }

  saveEvidenceState(evidenceLedger.value)
  emit('evidence-change', evidenceLedger.value)
}

function schedulePersist(documentRef: Document) {
  if (persistTimer) window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    persistTimer = undefined
    persistReplicaDraft(documentRef)
  }, 180)
}

function recordAction(action: ReplicaAction) {
  const previous = actions.at(-1)
  if (action.kind === 'input' && previous?.kind === 'input' && previous.key === action.key) {
    actions[actions.length - 1] = action
    return
  }
  actions.push(action)
}

function assignReplicaKeys(documentRef: Document) {
  documentRef.querySelectorAll<HTMLElement>('button, input, textarea, summary').forEach((element, index) => {
    element.dataset.replicaKey = `control-${index}`
  })
}

function replayActions(documentRef: Document) {
  const view = documentRef.defaultView
  if (!view) return
  replaying = true
  try {
    for (const action of actions) {
      const element = documentRef.querySelector<HTMLElement>(`[data-replica-key="${action.key}"]`)
      if (!element) continue
      if (action.kind === 'input' && (element instanceof view.HTMLInputElement || element instanceof view.HTMLTextAreaElement)) {
        element.value = action.value ?? ''
        if (element instanceof view.HTMLInputElement && action.checked !== undefined) element.checked = action.checked
        element.dispatchEvent(new view.Event('input', { bubbles: true }))
        element.dispatchEvent(new view.Event('change', { bubbles: true }))
      } else if (action.kind === 'click') {
        element.click()
      }
    }
  } finally {
    replaying = false
  }
}

function syncReplicaDevice(documentRef: Document) {
  const view = documentRef.defaultView
  const root = documentRef.getElementById('w1d1-learning-studio-prototype')
  if (!view || !root) return

  const device = view.innerWidth <= 860 ? 'mobile' : 'desktop'
  if (root.dataset.device === device) return

  const choice = root.querySelector<HTMLButtonElement>(`[data-device-choice="${device}"]`)
  if (!choice) return

  replaying = true
  try {
    choice.click()
  } finally {
    replaying = false
  }
}

function navigateFromReplica(target: HTMLElement, event: Event): boolean {
  const navButton = target.closest<HTMLButtonElement>('.w1-global-nav button')
  if (navButton) {
    const buttons = Array.from(navButton.parentElement?.querySelectorAll('button') ?? [])
    const views: ProductView[] = ['today', 'course', 'review', 'progress', 'glossary']
    const view = views[buttons.indexOf(navButton)]
    if (view) {
      event.preventDefault()
      event.stopPropagation()
      emit('navigate', view)
      return true
    }
  }

  if (target.closest('.w1-global-brand')) {
    event.preventDefault()
    event.stopPropagation()
    emit('navigate', 'today')
    return true
  }
  return false
}

function connectReplica() {
  frameCleanup?.()
  const frame = replicaFrame.value
  const documentRef = frame?.contentDocument
  if (!frame || !documentRef) return

  assignReplicaKeys(documentRef)
  replayActions(documentRef)

  const root = documentRef.getElementById('w1d1-learning-studio-prototype')
  const view = documentRef.defaultView
  if (!root || !view) return

  syncReplicaDevice(documentRef)

  const handleInput = (event: Event) => {
    if (replaying) return
    const target = event.target
    if (!(target instanceof view.HTMLInputElement || target instanceof view.HTMLTextAreaElement)) return
    const key = target.dataset.replicaKey
    if (!key) return
    recordAction({ kind: 'input', key, value: target.value, checked: target instanceof view.HTMLInputElement ? target.checked : undefined })
    schedulePersist(documentRef)
  }

  const handleClick = (event: Event) => {
    const target = event.target
    if (!(target instanceof view.HTMLElement) || replaying) return
    if (navigateFromReplica(target, event)) return

    const control = target.closest<HTMLElement>('button, summary')
    const key = control?.dataset.replicaKey
    if (!control || !key || control.matches('.w1-route-item')) return
    recordAction({ kind: 'click', key })
    if (control.hasAttribute('data-finish')) completionRequested = true
    schedulePersist(documentRef)
  }

  const handleResize = () => syncReplicaDevice(documentRef)

  root.addEventListener('input', handleInput, true)
  root.addEventListener('click', handleClick, true)
  view.addEventListener('resize', handleResize)
  frameCleanup = () => {
    root.removeEventListener('input', handleInput, true)
    root.removeEventListener('click', handleClick, true)
    view.removeEventListener('resize', handleResize)
  }
}

onBeforeUnmount(() => {
  frameCleanup?.()
  if (persistTimer) window.clearTimeout(persistTimer)
  persistReplicaDraft(replicaFrame.value?.contentDocument ?? undefined)
})
</script>

<template>
  <main class="w1d1-reference-replica" aria-label="W1D1 正式学习页面">
    <iframe
      ref="replicaFrame"
      :srcdoc="referenceHtml"
      title="W1D1 单列学习工作台"
      sandbox="allow-scripts allow-same-origin"
      referrerpolicy="no-referrer"
      @load="connectReplica"
    />
  </main>
</template>

<style scoped>
.w1d1-reference-replica {
  width: 100%;
  height: 100dvh;
  min-height: 760px;
  overflow: hidden;
  background: #05283a;
}

.w1d1-reference-replica iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #05283a;
}

@media (max-width: 860px) {
  .w1d1-reference-replica {
    min-height: 100dvh;
  }
}
</style>
