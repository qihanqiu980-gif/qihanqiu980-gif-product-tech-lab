import type { DayId } from './types'
import type { Day01FrameworkPlan } from './day01Framework'

const w5d3Framework: Day01FrameworkPlan = {
  dayId: 'W5D3',
  label: '从表角色到多表 SQL 记录',
  chapters: [
    {
      id: 'chapter-1', number: 1, session: 1, timeMinutes: 8,
      title: '建立任务：先看三张表各负责什么',
      lead: 'W5D3 先把 users、events、orders 的角色和连接顺序说清，再开始记录 step-by-step 的行数、唯一键和金额，不直接把最后结果当结论。',
      conceptIds: [], semanticSections: ['scenario', 'objectives', 'prerequisites'],
      practice: {
        prompt: '运营说“多表 SQL 已经跑通了”，W5D3 最先交付什么？',
        options: ['multi-table-sql-log.md 多表 SQL 记录', '直接给最终分析报告', '把三张表随便连起来看一眼'],
        answerIndex: 0,
        explanation: 'W5D3 先交过程记录，再谈后续分析。',
      },
      retellPrompt: '用两三句话说明：为什么 W5D3 不能把最终结果直接当成业务结论？',
      retellRubric: ['提到表角色', '提到逐步记录', '没有提前写成分析结论'],
    },
    {
      id: 'chapter-2', number: 2, session: 1, timeMinutes: 14,
      title: '模型一：先写表角色地图，再定连接顺序',
      lead: '多表 SQL 不是先写长 SQL，而是先说清 users、events、orders 各自负责什么，以及应该按什么顺序连起来。',
      conceptIds: ['source-table-map', 'join-chain-grain'], semanticSections: ['concepts'],
      practice: {
        prompt: '哪句话最符合 W5D3 的起点？',
        options: ['先分清表角色，再开始连接', '先打开 answers.sql 再决定写法', '先贴最终结果再回头解释'],
        answerIndex: 0,
        explanation: '先有表角色和连接顺序，后面才有可复核的多表 SQL。',
      },
      retellPrompt: '闭卷解释表角色地图和连接链路的区别，并各给一个 users/events/orders 例子。',
      retellRubric: ['表角色说清', '连接顺序说清', '没有混成结果结论'],
    },
    {
      id: 'chapter-3', number: 3, session: 1, timeMinutes: 14,
      title: '模型二：每一步都要记 row count、unique key 和 amount',
      lead: 'W5D3 的关键不是“连通了没有”，而是每一步 JOIN 后 row count、unique key 和 amount 有没有被改变。',
      conceptIds: ['step-row-count-audit', 'step-unique-key-audit', 'step-amount-audit'], semanticSections: ['concepts', 'diagram'],
      practice: {
        prompt: '哪句话最准确地描述逐步审计？',
        options: ['每一步都记 rows_before、rows_after、unique_keys 和 amount', '只看最后一个结果数字', '只要 SQL 没报错就算完成'],
        answerIndex: 0,
        explanation: 'W5D3 要把变化点拆开看，不能只看最终结果。',
      },
      retellPrompt: '按“行数 → 唯一键 → 金额”复述每一步审计为什么要同时记录。',
      retellRubric: ['三项都说清', '每一步都说清', '没有把最终值当全部证据'],
    },
    {
      id: 'chapter-4', number: 4, session: 1, timeMinutes: 10,
      title: '第一次复述检查：逐步证据不是最终结果',
      lead: '这一章不增加新术语。你要把表角色、连接链路、逐步行数、唯一键和金额串起来，并说明为什么“跑通了”不等于“可直接下结论”。',
      conceptIds: ['source-table-map', 'join-chain-grain', 'step-row-count-audit', 'step-unique-key-audit', 'step-amount-audit'], semanticSections: ['concepts', 'diagram'],
      practice: {
        prompt: '哪条 W5D3 表述没有越界？',
        options: ['multi-table-sql-log 可说明过程，但不能证明真实生产结论', '最后一条 SQL 结果已经足够', '只要金额相等就不用记录行数'],
        answerIndex: 0,
        explanation: 'W5D3 的证据停在日志和本地教学包，不得越界成真实生产结论。',
      },
      retellPrompt: '用“表角色 → 连接链路 → 逐步数值 → 结果边界”复述一条多表 SQL。',
      retellRubric: ['链路完整', '三类数值明确', '不提前下生产结论'],
    },
    {
      id: 'chapter-5', number: 5, session: 2, timeMinutes: 16,
      title: '操作模型：缺口、边界和日志草稿',
      lead: '多表链路里既有缺口，也有答案边界。要把 NULL 键、练习文件和答案文件分开看，再把过程写进日志。',
      conceptIds: ['null-link-gap-audit', 'exercise-boundary', 'multi-table-sql-log'], semanticSections: ['diagram', 'demonstration', 'guided-lab'],
      practice: {
        prompt: '哪句话最符合多表 SQL 的缺口审查？',
        options: ['NULL 键和答案边界要分别写进日志', '看到 NULL 就直接删掉', '只看 final SQL 就够了', '答案文件可以提前当教程'],
        answerIndex: 0,
        explanation: '缺口和边界都要留痕，不能混成一件事。',
      },
      retellPrompt: '解释缺口、练习和答案边界为什么不能混成一个问题。',
      retellRubric: ['缺口说清', '边界说清', '日志说清'],
    },
    {
      id: 'chapter-6', number: 6, session: 2, timeMinutes: 12,
      title: '责任与证据边界：日志不是分析报告',
      lead: '多表 SQL 记录只能证明过程可复核；它不能证明真实生产行为、收入、报告已完成，也不能替代后续的分析工作。',
      conceptIds: ['exercise-boundary', 'multi-table-sql-log', 'null-link-gap-audit'], semanticSections: ['independent-lab', 'feedback'],
      practice: {
        prompt: '哪条 cannot_prove 最符合 W5D3？',
        options: ['不能证明真实生产行为、收入、报告或 answers.sql 已提前暴露', '已经证明真实生产已经完全正确', '已经证明最后一条 SQL 就等于分析结论'],
        answerIndex: 0,
        explanation: 'W5D3 只停在日志和本地教学包，不得越界成真实生产结论。',
      },
      retellPrompt: '用“能证明／不能证明／下一步”说明 W5D3 的边界。',
      retellRubric: ['能证明过程可复核', '不能证明真实生产', '下一步指向 W5D4'],
    },
    {
      id: 'chapter-7', number: 7, session: 2, timeMinutes: 18,
      title: '实验、multi-table-sql-log.md 与最终复述',
      lead: '最后完成用户、行为与订单的三步记录：字段齐全、逐步数值齐全、边界清楚，下一步只进入 W5D4。',
      conceptIds: ['source-table-map', 'join-chain-grain', 'step-row-count-audit', 'step-unique-key-audit', 'step-amount-audit', 'null-link-gap-audit', 'exercise-boundary', 'multi-table-sql-log'],
      semanticSections: ['guided-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion'],
      practice: {
        prompt: '一份合格 multi-table-sql-log.md 最关键的组合是什么？',
        options: ['step_id、rows_before、rows_after、unique_keys、amount_before、amount_after、gap_note、cannot_prove', '一句“SQL 看起来对了”', '直接贴最终结果数字'],
        answerIndex: 0,
        explanation: '日志必须可复核、不过界；结论前要有逐步记录。',
      },
      retellPrompt: '最终复述八个首次教学概念，并说明 multi-table-sql-log.md 能证明什么、不能证明什么。',
      retellRubric: ['八个概念进入同一多表链路', '字段齐全', '不提前完成 W5D4 或分析报告'],
    },
  ],
}

export function getW5D3FrameworkPlan(dayId: DayId): Day01FrameworkPlan | undefined {
  return dayId === 'W5D3' ? w5d3Framework : undefined
}
