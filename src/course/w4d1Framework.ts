import type { DayId } from './types'
import type { Day01FrameworkPlan } from './day01Framework'

export const w4d1Framework: Day01FrameworkPlan = {
  dayId: 'W4D1',
  label: '从行级查询到指标口径表',
  chapters: [
    {
      id: 'chapter-1', number: 1, session: 1, timeMinutes: 8,
      title: '建立任务：先定义指标再计算',
      lead: 'W4D1 承接 W3D6 的行级查询集，只把“app 支付表现”改写成可审核指标口径，不提前写聚合 SQL 或给出指标数字。',
      conceptIds: [], semanticSections: ['scenario', 'objectives', 'prerequisites'],
      practice: {
        prompt: '运营问“app 支付率是多少”，W4D1 最先交付什么？',
        options: ['metric-contract-table.md 口径表', 'COUNT 和 GROUP BY 计算结果', 'JOIN 对账报告'],
        answerIndex: 0,
        explanation: 'W4D1 先定义口径；聚合计算和 JOIN 都是后续课程。',
      },
      retellPrompt: '用两三句话说明：为什么 W4D1 不能直接从 W3D6 明细行跳到指标数字？',
      retellRubric: ['提到先定义口径', '提到行级证据边界', '没有提前计算'],
    },
    {
      id: 'chapter-2', number: 2, session: 1, timeMinutes: 14,
      title: '模型一：决策目的和指标信号',
      lead: '指标先服务一个决策，再表达一个有限信号。没有目的和信号，指标名称无法指导分子、分母和排除规则。',
      conceptIds: ['metric-decision-purpose', 'metric-signal'], semanticSections: ['concepts'],
      practice: {
        prompt: '哪句话最符合“指标信号”边界？',
        options: ['app paid 订单数反映符合口径的支付订单规模，但不能单独证明原因', 'app paid 订单数证明运营策略成功', '支付率下降一定是后端故障'],
        answerIndex: 0,
        explanation: '信号只提供有限解释，不能直接证明原因或策略效果。',
      },
      retellPrompt: '闭卷解释决策目的和指标信号的区别，并各给一个 app paid 示例。',
      retellRubric: ['目的是使用场景', '信号是有限解释', '不过界成因果'],
    },
    {
      id: 'chapter-3', number: 3, session: 1, timeMinutes: 14,
      title: '模型二：分子、分母和指标粒度',
      lead: '分子定义达成集合，分母定义机会集合，粒度说明按订单、用户还是会话计数；三者决定指标数字到底是什么意思。',
      conceptIds: ['metric-numerator', 'metric-denominator', 'metric-grain'], semanticSections: ['concepts', 'diagram'],
      practice: {
        prompt: '“app 支付转化率”只有 paid app orders，最先缺什么？',
        options: ['有机会支付的 app 分母和计数粒度', '更漂亮的图表', 'JOIN 对账结论'],
        answerIndex: 0,
        explanation: '比例指标没有分母就不能解释转化；粒度决定按单还是按人。',
      },
      retellPrompt: '按“达成集合／机会集合／数谁”复述分子、分母和粒度。',
      retellRubric: ['分子清楚', '分母清楚', '粒度清楚'],
    },
    {
      id: 'chapter-4', number: 4, session: 1, timeMinutes: 10,
      title: '第一次复述检查：指标口径不等于 SQL 结果',
      lead: '这一章不增加新术语。你要把决策目的、信号、分子、分母和粒度串起来，并说明为什么还不能计算。',
      conceptIds: ['metric-decision-purpose', 'metric-signal', 'metric-numerator', 'metric-denominator', 'metric-grain'], semanticSections: ['concepts', 'diagram'],
      practice: {
        prompt: '哪条 W4D1 表述没有越界？',
        options: ['已定义 app paid 订单指标口径；W4D2 再学习聚合计算', '指标已经正确', 'JOIN 已经完成'],
        answerIndex: 0,
        explanation: 'W4D1 的证据停在口径定义，不能宣称后续计算完成。',
      },
      retellPrompt: '用“指标名 → 决策目的 → 信号 → 分子 → 分母 → 粒度”复述一条口径。',
      retellRubric: ['链路完整', '分子分母不混', '不提前算数'],
    },
    {
      id: 'chapter-5', number: 5, session: 2, timeMinutes: 16,
      title: '操作模型：时间窗口和排除规则',
      lead: '把 W3D6 的 TEST1、O1018、NULL、0 元和 O1014 跨天边界转成指标计算前的时间窗口、排除规则和质量风险。',
      conceptIds: ['metric-time-window', 'metric-exclusion-rule', 'metric-contract-table'], semanticSections: ['diagram', 'demonstration', 'guided-lab'],
      practice: {
        prompt: 'O1014 的 paid_at 是 2026-09-01 00:00:00，W4D1 应该怎么处理？',
        options: ['写进 time_window 边界和待确认业务日规则', '自动算入 8 月 31 日', '删除这行并说数据已修复'],
        answerIndex: 0,
        explanation: '边界行必须进入口径表，不能凭直觉归属或删除。',
      },
      retellPrompt: '解释时间窗口、排除规则和质量风险如何在计算前保护指标。',
      retellRubric: ['时间闭开边界清楚', '排除规则清楚', '质量风险不过界'],
    },
    {
      id: 'chapter-6', number: 6, session: 2, timeMinutes: 12,
      title: '责任与证据边界：口径表只能证明定义完整',
      lead: 'metric-contract-table.md 能证明口径字段齐全、风险被暴露、下一步可计算；不能证明真实生产指标、收入、原因、GROUP BY 或 JOIN 已经完成。',
      conceptIds: ['metric-time-window', 'metric-exclusion-rule', 'metric-contract-table'], semanticSections: ['independent-lab', 'feedback'],
      practice: {
        prompt: '哪条 cannot_prove 最符合 W4D1？',
        options: ['不能证明真实生产指标、原因、GROUP BY、JOIN 或 W4D2 已完成', '已经证明指标正确', '已经证明数据质量已修复'],
        answerIndex: 0,
        explanation: '口径定义是后续计算前提，不是计算结果或生产审计。',
      },
      retellPrompt: '用“能证明／不能证明／下一步”说明指标口径表边界。',
      retellRubric: ['能证明定义', '不能证明计算', '下一步指向 W4D2'],
    },
    {
      id: 'chapter-7', number: 7, session: 2, timeMinutes: 18,
      title: '实验、metric-contract-table.md 与最终复述',
      lead: '最后完成指标口径六路径观察、针对性练习和 metric-contract-table.md：13 个字段齐全，教学模拟和真实生产边界分开，下一步只进入 W4D2。',
      conceptIds: ['metric-decision-purpose', 'metric-signal', 'metric-numerator', 'metric-denominator', 'metric-grain', 'metric-time-window', 'metric-exclusion-rule', 'metric-contract-table'],
      semanticSections: ['guided-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion'],
      practice: {
        prompt: '一份合格 metric-contract-table.md 最关键的组合是什么？',
        options: ['决策目的、信号、分子、分母、粒度、时间、排除、风险和 cannot_prove', '一句“支付率已定义”', '直接贴 GROUP BY 结果'],
        answerIndex: 0,
        explanation: '成果必须可审核、可后续计算且不过界；聚合 SQL 是 W4D2。',
      },
      retellPrompt: '最终复述八个首次教学概念，并说明 metric-contract-table.md 能证明什么、不能证明什么。',
      retellRubric: ['八个概念进入同一口径链', '13 字段齐全', '不提前完成 W4D2'],
    },
  ],
}

export function getW4D1FrameworkPlan(dayId: DayId): Day01FrameworkPlan | undefined {
  return dayId === 'W4D1' ? w4d1Framework : undefined
}
