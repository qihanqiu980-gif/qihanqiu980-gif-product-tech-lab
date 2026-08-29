import type { DayId } from './types'
import type { Day01FrameworkPlan } from './day01Framework'

export const w4d3Framework: Day01FrameworkPlan = {
  dayId: 'W4D3',
  label: '从聚合逻辑图到指标计算 SQL',
  chapters: [
    {
      id: 'chapter-1', number: 1, session: 1, timeMinutes: 8,
      title: '建立任务：先看同一批输入，再看指标',
      lead: 'W4D3 承接 W4D1/W4D2，只把“这批教学数据要算出哪些指标”变成可交付的 SQL 结果，不再停留在聚合顺序图。',
      conceptIds: [], semanticSections: ['scenario', 'objectives', 'prerequisites'],
      practice: {
        prompt: '运营问“活跃、转化与客单价是多少”，W4D3 最先交付什么？',
        options: ['metric-calculation.md 指标计算记录', '直接给真实生产看板', 'JOIN 对账报告'],
        answerIndex: 0,
        explanation: 'W4D3 先把指标口径、SQL 片段、结果值和边界写成可复核记录。',
      },
      retellPrompt: '用两三句话说明：为什么 W4D3 不能只给 0.4000、2077 这些结果数字？',
      retellRubric: ['提到同一 base CTE', '提到 exposure_to_pay', '提到 checkout_to_pay_24h', '提到 aov_amount', '提到分母/去重/窗口', '没有提前越界成真实生产结论'],
    },
    {
      id: 'chapter-2', number: 2, session: 1, timeMinutes: 14,
      title: '模型一：活跃用户先定活动事件集合',
      lead: '活跃不是“任意一行事件”，而是从同一批非测试活动事件中按 user_id 去重后的规模基线。',
      conceptIds: ['metric-sql-base-cte', 'active-user-sql'], semanticSections: ['concepts'],
      practice: {
        prompt: '哪条写法最接近本课的 active_users？',
        options: ['COUNT(DISTINCT user_id) FROM base_events WHERE event_name IN ("coupon_exposure","checkout_view","payment_success")', 'COUNT(*) FROM events', 'COUNT(DISTINCT order_id) FROM payment_success'],
        answerIndex: 0,
        explanation: '活跃用户按 user_id 去重，并先定义活动事件集合。',
      },
      retellPrompt: '闭卷解释为什么 active_users 不是 payment_success 人数，也不是全表 COUNT(*)。',
      retellRubric: ['活动事件集合明确', 'user_id 去重明确', '不把支付人数当活跃'],
    },
    {
      id: 'chapter-3', number: 3, session: 1, timeMinutes: 14,
      title: '模型二：自然日转化和滚动窗口不能混',
      lead: '自然日转化按统一日期边界，滚动 24 小时从每个 checkout_view 自己的时间起算；U03 会把这两个口径拉开。',
      conceptIds: ['same-day-conversion-sql', 'rolling-window-conversion-sql'], semanticSections: ['concepts', 'diagram'],
      practice: {
        prompt: 'U03 为什么会影响 24 小时转化却不影响自然日转化？',
        options: ['因为它在 checkout 后 24 小时 59 分钟才支付', '因为它是 TEST 用户', '因为它没有 coupon_exposure'],
        answerIndex: 0,
        explanation: '自然日和滚动 24 小时的边界不同，U03 正好落在边界外。',
      },
      retellPrompt: '按“分母、分子、窗口、U03”复述两种转化率的差异。',
      retellRubric: ['分母分子分开', '窗口说清', 'U03 边界说清'],
    },
    {
      id: 'chapter-4', number: 4, session: 1, timeMinutes: 10,
      title: '第一次复述检查：转化率不是一个百分比',
      lead: '这一章不增加新术语。你要把活跃用户、自然日转化和滚动 24 小时转化连起来，并说明为什么它们必须共用同一个教学底座。',
      conceptIds: ['metric-sql-base-cte', 'active-user-sql', 'same-day-conversion-sql', 'rolling-window-conversion-sql'], semanticSections: ['concepts', 'diagram'],
      practice: {
        prompt: '哪条 W4D3 表述没有越界？',
        options: ['教学样本里 active_users=10，exposure_to_pay=0.4000，checkout_to_pay_24h=0.5714', '结果已经证明真实生产很好', 'AOV 已经说明运营成功'],
        answerIndex: 0,
        explanation: '本日的证据停在教学样本和计算路径，不得宣称真实生产正确。',
      },
      retellPrompt: '用“base CTE → 活跃 → 转化”复述今天的前两类指标。',
      retellRubric: ['base CTE 先行', '活跃和转化区分清楚', '没有提前结论'],
    },
    {
      id: 'chapter-5', number: 5, session: 2, timeMinutes: 16,
      title: '操作模型：先去重订单，再算 AOV',
      lead: '唯一支付订单要先按 order_id 去重，AOV 才能站在正确分母上；同时要把中位数和最大值一起拿出来。',
      conceptIds: ['unique-paid-order-sql', 'aov-sql', 'median-outlier-guard-sql'], semanticSections: ['diagram', 'demonstration', 'guided-lab'],
      practice: {
        prompt: 'O05 有两条 payment_success，AOV 计算前最先要做什么？',
        options: ['按 order_id 去重，再计算总额和平均值', '直接 COUNT(*)', '只看 max(amount)'],
        answerIndex: 0,
        explanation: 'AOV 分母是唯一订单，不是支付事件。',
      },
      retellPrompt: '解释为什么 O06 的 9999 元必须和 median_amount 一起看。',
      retellRubric: ['去重键明确', '均值和中位数一起看', '异常值有护栏'],
    },
    {
      id: 'chapter-6', number: 6, session: 2, timeMinutes: 12,
      title: '责任与证据边界：结果数字还不是结论',
      lead: 'W4D3 只证明本地教学表按口径可以算出一组指标；它不能证明真实生产、JOIN、归因、趋势或看板发布。',
      conceptIds: ['metric-calculation-note', 'metric-sql-base-cte'], semanticSections: ['independent-lab', 'feedback'],
      practice: {
        prompt: '哪条 cannot_prove 最符合 W4D3？',
        options: ['不能证明真实生产指标、JOIN、归因、趋势或 W4D4 已完成', '已经证明看板可发布', '已经证明运营策略成功'],
        answerIndex: 0,
        explanation: 'W4D3 停在指标计算记录，不得越界成业务审计。',
      },
      retellPrompt: '用“能证明／不能证明／下一步”说明今天的指标边界。',
      retellRubric: ['能证明计算路径', '不能证明真实生产', '下一步指向 W4D4'],
    },
    {
      id: 'chapter-7', number: 7, session: 2, timeMinutes: 18,
      title: '实验、metric-calculation.md 与最终复述',
      lead: '最后完成 W4 events 六路径观察、针对性练习和 metric-calculation.md：活跃、转化和 AOV 一起写，分母/去重/窗口/护栏都要保留。',
      conceptIds: [...['metric-sql-base-cte', 'active-user-sql', 'same-day-conversion-sql', 'rolling-window-conversion-sql', 'unique-paid-order-sql', 'aov-sql', 'median-outlier-guard-sql', 'metric-calculation-note']],
      semanticSections: ['guided-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion'],
      practice: {
        prompt: '一份合格 metric-calculation.md 最关键的组合是什么？',
        options: ['metric_ref、sql_snippet、result_value、sample_check、can_prove、cannot_prove 和 next_review_task', '一句“转化率已经算完”', '直接贴 JOIN 对账结果'],
        answerIndex: 0,
        explanation: '成果必须可解释、可复核、不过界；JOIN 和真实生产结论都不属于 W4D3。',
      },
      retellPrompt: '最终复述五个指标输出，并说明 metric-calculation.md 能证明什么、不能证明什么。',
      retellRubric: ['活跃、转化、订单、AOV 一起说清', '字段齐全', '不提前完成 W4D4 或 JOIN'],
    },
  ],
}

export function getW4D3FrameworkPlan(dayId: DayId): Day01FrameworkPlan | undefined {
  return dayId === 'W4D3' ? w4d3Framework : undefined
}
