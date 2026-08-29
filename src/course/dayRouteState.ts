import { getDailyCourse } from './registry.ts'
import { inspectDailyCourseImplementation } from './implementationRegistry.ts'
import type { DailyCourseImplementationInspection } from './implementationRegistry.ts'
import type { DailyCourse, DayId } from './types'

export type DailyCourseRouteStatus = 'available' | 'implementation-pending' | 'content-missing'

export interface DailyCourseRouteState {
  readonly dayId: DayId
  readonly week: number
  readonly day: number
  readonly intendedTitle: string
  readonly lesson?: DailyCourse
  readonly implementationInspection: DailyCourseImplementationInspection
  readonly status: DailyCourseRouteStatus
  readonly access: {
    readonly mode: 'independent-preview'
    readonly requiresPriorDayCompletion: false
  }
}

const plannedTitles: Partial<Record<DayId, string>> = {
  W1D2: 'URL、域名、DNS 与服务器地址',
  W1D3: 'HTTP 请求与响应',
  W1D4: 'API、后端与数据库',
  W1D5: '使用 Network 读取证据',
  W1D6: '完整请求链路与综合诊断',
  W3D1: '打开 SQLite 实验环境',
  W3D2: 'SELECT 执行逻辑',
  W3D3: '用户与订单基础查询',
  W3D4: '查询为何不可信',
  W3D5: '向数据研发确认口径',
  W3D6: '回答真实业务问题',
  W11D1: 'AI 功能不是一个 Prompt',
  W11D2: '工具调用',
  W11D3: '构建最小评测集',
  W11D4: '幻觉从哪里产生',
  W11D5: '成本、延迟与安全',
  W11D6: '评测 AI 客服',
  W12D1: '定义值得解决的问题',
  W12D2: '系统与数据方案',
  W12D3: '最大未知的可运行验证日志',
  W12D4: '风险登记册编写',
  W12D5: '跨职能评审与修订',
  W12D6: '作品集装配、10 分钟答辩和复盘',
  W4D2: '聚合与分组入门',
  W4D3: '活跃、转化与客单价',
  W4D4: '三种上涨假象',
  W8D1: '程序如何表达步骤',
  W8D2: '从输入到输出',
  W8D6: '生成每日业务摘要',
}

export function getDailyCourseRouteState(dayId: DayId): DailyCourseRouteState {
  const week = Number(/^W(\d+)D/.exec(dayId)?.[1] ?? 1)
  const day = Number(/D(\d+)$/.exec(dayId)?.[1] ?? 1)
  const lesson = getDailyCourse(dayId)
  const implementationInspection = inspectDailyCourseImplementation(dayId, lesson)
  const available = Boolean(lesson && implementationInspection.resolved && implementationInspection.implementation?.reviewed)

  return {
    dayId,
    week,
    day,
    intendedTitle: lesson?.title ?? plannedTitles[dayId] ?? `第 ${week} 周第 ${day} 天`,
    lesson,
    implementationInspection,
    status: available ? 'available' : lesson ? 'implementation-pending' : 'content-missing',
    access: {
      mode: 'independent-preview',
      requiresPriorDayCompletion: false,
    },
  }
}
