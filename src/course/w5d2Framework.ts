import type { DayId } from './types'
import type { Day01FrameworkPlan } from './day01Framework'

const w5d2Framework: Day01FrameworkPlan = {
  dayId: 'W5D2',
  label: '从粒度到 JOIN 对照图',
  chapters: [
    {
      id: 'chapter-1', number: 1, session: 1, timeMinutes: 8,
      title: '建立任务：先看保留规则，再看结果',
      lead: 'W5D2 承接 W4D4 的证据边界，只把“这次连接后谁会留下”变成可解释的 JOIN 对照，不提前写完整分析报告。',
      conceptIds: [], semanticSections: ['scenario', 'objectives', 'prerequisites'],
      practice: {
        prompt: '运营问“JOIN 后数字为什么变了”，W5D2 最先交付什么？',
        options: ['reconciliation.md JOIN 对账记录', '直接给最终分析报告', '把所有表直接 INNER JOIN 一遍'],
        answerIndex: 0,
        explanation: 'W5D2 先说明保留规则、连接键和缺口；分析报告属于后续迁移。',
      },
      retellPrompt: '用两三句话说明：为什么 W5D2 不能直接把 JOIN 后数字当成业务结论？',
      retellRubric: ['提到保留规则', '提到一对多放大和缺口', '没有提前写成分析结论'],
    },
    {
      id: 'chapter-2', number: 2, session: 1, timeMinutes: 14,
      title: '模型一：连接键先决定能不能配对',
      lead: 'JOIN 先看连接键，再谈保留规则。没有 key，就没有可复核的匹配，也看不出一行会连到几行。',
      conceptIds: ['join-key-matching', 'join-preserve-rule'], semanticSections: ['concepts'],
      practice: {
        prompt: '哪句话最符合 JOIN 连接键的作用？',
        options: ['连接键决定哪些行能配对，再决定保留规则怎么生效', '连接键只是写在 SQL 里好看', '连接键会自动修复缺失数据'],
        answerIndex: 0,
        explanation: 'JOIN 的第一步是匹配，不是结论。',
      },
      retellPrompt: '闭卷解释连接键和保留规则的区别，并各给一个 users/orders 例子。',
      retellRubric: ['连接键说清', '保留规则说清', '没有混成结论'],
    },
    {
      id: 'chapter-3', number: 3, session: 1, timeMinutes: 14,
      title: '模型二：INNER、LEFT、RIGHT、FULL 的保留侧',
      lead: 'INNER 只留交集，LEFT 保留左表，RIGHT 保留右表，FULL 保留两边；未匹配的一侧会补 NULL。',
      conceptIds: ['inner-join-filter', 'left-join-preserve-left', 'right-join-preserve-right', 'full-join-preserve-both'], semanticSections: ['concepts', 'diagram'],
      practice: {
        prompt: '哪句话最准确地描述 LEFT JOIN？',
        options: ['保留左表全部行，右表没配上就补 NULL', '只留匹配交集', '只保留右表'],
        answerIndex: 0,
        explanation: 'LEFT JOIN 的保留侧是左表，未匹配的右表字段会变成 NULL。',
      },
      retellPrompt: '按“保留谁 → 丢掉谁 → NULL 去哪边”复述四种 JOIN 的差别。',
      retellRubric: ['四种 JOIN 说清', 'NULL 补位说清', '没有把 LEFT/RIGHT 说反'],
    },
    {
      id: 'chapter-4', number: 4, session: 1, timeMinutes: 10,
      title: '第一次复述检查：匹配和保留不是一回事',
      lead: '这一章不增加新术语。你要把连接键、INNER、LEFT、RIGHT、FULL 串起来，并说明为什么“匹配成功”与“是否保留”是两件事。',
      conceptIds: ['join-key-matching', 'join-preserve-rule', 'inner-join-filter', 'left-join-preserve-left', 'right-join-preserve-right', 'full-join-preserve-both'], semanticSections: ['concepts', 'diagram'],
      practice: {
        prompt: '哪条 W5D2 表述没有越界？',
        options: ['JOIN 对照图可说明保留规则，但不能证明真实生产结论', 'INNER JOIN 已经证明所有缺口都消失', 'LEFT JOIN 等于把数据清洗好了'],
        answerIndex: 0,
        explanation: 'W5D2 的证据停在对照图和本地样本，不得越界成生产结论。',
      },
      retellPrompt: '用“连接键 → 保留规则 → 结果边界”复述一条 JOIN。',
      retellRubric: ['链路完整', '保留规则明确', '不提前下生产结论'],
    },
    {
      id: 'chapter-5', number: 5, session: 2, timeMinutes: 16,
      title: '操作模型：NULL、放大和 Anti Join',
      lead: '外连接会补 NULL；一对多 JOIN 会放大订单级字段；LEFT JOIN 再筛 NULL 是找缺口的最直接方法。',
      conceptIds: ['join-grain-amplification', 'anti-join-gap-audit'], semanticSections: ['diagram', 'demonstration', 'guided-lab'],
      practice: {
        prompt: '哪句话最符合 JOIN 缺口审查？',
        options: ['LEFT JOIN 后筛选右表键 IS NULL 可以找出未匹配行', 'NULL 一定代表业务不存在', 'INNER JOIN 更适合找缺口', 'FULL JOIN 不能看见缺口'],
        answerIndex: 0,
        explanation: 'Anti Join 先保留左表，再把右表 NULL 行筛出来。',
      },
      retellPrompt: '解释 NULL、放大和缺口为什么不能混成一个问题。',
      retellRubric: ['NULL 是缺口标记', '放大是粒度问题', '缺口审查有独立步骤'],
    },
    {
      id: 'chapter-6', number: 6, session: 2, timeMinutes: 12,
      title: '责任与证据边界：对照图不是分析报告',
      lead: 'JOIN 对照图只能证明哪一边被保留、哪里会放大、哪里存在缺口；不能证明真实生产 GMV、原因、趋势或后续分析报告已完成。',
      conceptIds: ['join-audit-map', 'anti-join-gap-audit', 'join-grain-amplification'], semanticSections: ['independent-lab', 'feedback'],
      practice: {
        prompt: '哪条 cannot_prove 最符合 W5D2？',
        options: ['不能证明真实生产 GMV、原因、趋势或分析报告已完成', '已经证明订单收入真的涨了', '已经证明缺口一定是业务错误'],
        answerIndex: 0,
        explanation: 'W5D2 只停在教学 JOIN 对照，不得越界到真实业务审计。',
      },
      retellPrompt: '用“能证明／不能证明／下一步”说明 W5D2 的边界。',
      retellRubric: ['能证明保留规则', '不能证明真实生产', '下一步指向 W5D3'],
    },
    {
      id: 'chapter-7', number: 7, session: 2, timeMinutes: 18,
      title: '实验、reconciliation.md 与最终复述',
      lead: '最后完成三张表 JOIN 对照、缺口审查和 reconciliation.md：字段齐全、保留规则清楚、下一步只进入 W5D3。',
      conceptIds: ['join-key-matching', 'join-preserve-rule', 'inner-join-filter', 'left-join-preserve-left', 'right-join-preserve-right', 'full-join-preserve-both', 'join-grain-amplification', 'anti-join-gap-audit', 'join-audit-map'],
      semanticSections: ['guided-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion'],
      practice: {
        prompt: '一份合格 reconciliation.md 最关键的组合是什么？',
        options: ['join_type、preserve_rule、join_key、rows_before、rows_after、unmatched_keys 和 amount_gap', '一句“JOIN 看起来对了”', '直接贴一个最终 GMV'],
        answerIndex: 0,
        explanation: '成果必须可解释、可复核、不过界；结论前要有对账记录。',
      },
      retellPrompt: '最终复述九个首次教学概念，并说明 reconciliation.md 能证明什么、不能证明什么。',
      retellRubric: ['九个概念进入同一 JOIN 链', '字段齐全', '不提前完成 W5D3 或分析报告'],
    },
  ],
}

export function getW5D2FrameworkPlan(dayId: DayId): Day01FrameworkPlan | undefined {
  return dayId === 'W5D2' ? w5d2Framework : undefined
}
