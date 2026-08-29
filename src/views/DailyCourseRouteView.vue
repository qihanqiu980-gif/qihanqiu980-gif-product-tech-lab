<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import type { Component } from 'vue'
import type { DayId } from '../course/types'
import { getDailyCourseRouteState } from '../course/dayRouteState'
import type { EvidenceState } from '../evidenceStore'

const props = defineProps<{
  dayId: DayId
  durationMode: 30 | 45
}>()

const emit = defineEmits<{
  back: []
  requestConfirmation: []
  navigate: [view: 'today' | 'course' | 'review' | 'progress' | 'glossary']
  'update:durationMode': [mode: 30 | 45]
  'evidence-change': [state: EvidenceState]
  'next-lesson-request': [payload: { from: string; to: string }]
}>()

const routeState = computed(() => getDailyCourseRouteState(props.dayId))
const lesson = computed(() => routeState.value.lesson)

const rendererCache = new Map<string, Component>()
const implementationInspection = computed(() => routeState.value.implementationInspection)
const renderer = computed(() => {
  const inspection = implementationInspection.value
  const implementation = inspection.implementation
  if (!inspection.resolved || !implementation?.reviewed) return undefined

  const rendererImplementation = implementation.renderer
  const cached = rendererCache.get(rendererImplementation.key)
  if (cached) return cached

  const component = defineAsyncComponent(rendererImplementation.load)
  rendererCache.set(rendererImplementation.key, component)
  return component
})

const week = computed(() => routeState.value.week)
const day = computed(() => routeState.value.day)
const intendedTitle = computed(() => routeState.value.intendedTitle)
</script>

<template>
  <component
    :is="renderer"
    v-if="lesson && renderer"
    :day-id="dayId"
    :duration-mode="durationMode"
    @update:duration-mode="emit('update:durationMode', $event)"
    @evidence-change="emit('evidence-change', $event)"
    @back="emit('back')"
    @request-confirmation="emit('requestConfirmation')"
    @navigate="emit('navigate', $event)"
    @next-lesson-request="emit('next-lesson-request', $event)"
  />

  <main v-else class="missing-day" aria-labelledby="missing-day-title">
    <button type="button" class="back-action" @click="emit('back')">← 返回课程路线</button>
    <section class="missing-day-sheet">
      <p class="missing-day-code">{{ dayId }} · 计划中的第 {{ week }} 周第 {{ day }} 天</p>
      <h1 id="missing-day-title">{{ lesson?.title ?? intendedTitle }}</h1>
      <p class="missing-day-lead">这一天尚未达到 W1D1 的完整教材与证据门槛，因此不会显示旧提纲、机械练习或 W1D1 的实验沙盒。</p>

      <dl>
        <div>
          <dt>当前可确认</dt>
          <dd>{{ routeState.status === 'implementation-pending' ? '完整课程数据已经登记，但专属实验与证据渲染器尚未通过审核。' : '课程路线中已有学习意图，但权威 DailyCourse 注册表中还没有完整内容。' }}</dd>
        </div>
        <div>
          <dt>开放条件</dt>
          <dd>完整概念首次教学、教师示范、引导实验、独立变式、3–5 道专属练习、成果教学、复习计划和证据适配全部通过。</dd>
        </div>
        <div>
          <dt>为什么不展示旧页</dt>
          <dd>能解析地址不等于课程已完成。旧周页只能作为历史素材，不能替代独立日课或证明已经掌握。</dd>
        </div>
      </dl>

      <div class="missing-day-actions">
        <button type="button" class="primary-action" @click="emit('back')">查看当前课程路线</button>
        <a href="#/lesson/W1D1">查看 W1D1 质量基准</a>
      </div>
    </section>
  </main>
</template>

<style scoped>
.missing-day { max-width: 980px; min-height: 72vh; margin: 0 auto; padding: 34px clamp(16px, 4vw, 54px) 90px; }
.missing-day-sheet { margin-top: 30px; padding: clamp(28px, 5vw, 58px); background: var(--surface); border-radius: 14px; box-shadow: var(--shadow-panel); }
.missing-day-code { margin: 0 0 15px; color: var(--ink-faint); font-family: var(--mono); font-size: 12px; }
.missing-day h1 { max-width: 18ch; margin: 0; color: var(--ink); font-size: clamp(34px, 5vw, 52px); line-height: 1.2; letter-spacing: -.025em; overflow-wrap: anywhere; }
.missing-day-lead { max-width: 66ch; margin: 22px 0 36px; color: var(--ink-soft); font-size: 18px; line-height: 1.85; }
.missing-day dl { margin: 0; border-top: 1px solid var(--line-strong); }
.missing-day dl > div { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 24px; padding: 20px 0; border-bottom: 1px solid var(--line); }
.missing-day dt { color: var(--navy); font-weight: 780; }
.missing-day dd { margin: 0; color: var(--ink-soft); line-height: 1.75; overflow-wrap: anywhere; }
.missing-day-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 18px; margin-top: 32px; }
.missing-day-actions a { color: var(--navy); font-weight: 760; }
@media (max-width: 600px) {
  .missing-day { padding-inline: 12px; }
  .missing-day-sheet { padding: 24px 18px; }
  .missing-day dl > div { grid-template-columns: 1fr; gap: 6px; }
  .missing-day-actions { align-items: stretch; flex-direction: column; }
  .missing-day-actions a { min-height: 44px; padding-top: 11px; text-align: center; }
}
</style>
