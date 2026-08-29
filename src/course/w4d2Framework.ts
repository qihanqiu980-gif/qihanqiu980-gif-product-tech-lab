import type { DayId } from './types'
import type { Day01FrameworkPlan } from './day01Framework'

export const w4d2Framework: Day01FrameworkPlan = {
  dayId: 'W4D2',
  label: '从口径表到聚合逻辑图',
  chapters: [
    {
      id: 'chapter-1', number: 1, session: 1, timeMinutes: 8,
      title: '建立任务：先看输入行，再看数字',
      lead: 'W4D2 承接 W4D1 的口径表，只把“这些行要怎么数”变成可执行的聚合逻辑，不提前进入 JOIN 或真实生产结论。',
      conceptIds: [], semanticSections: ['scenario', 'objectives', 'prerequisites'],
      practice: {
        prompt: '运营问“曝光到支付转化怎么算”，W4D2 最先交付什么？',
        options: ['aggregation-logic.md 聚合逻辑图', '直接给真实生产转化率', 'JOIN 对账报告'],
        answerIndex: 0,
        explanation: 'W4D2 先说明输入行、函数和分组；W4D3 才写完整指标 SQL。',
      },
      retellPrompt: '用两三句话说明：为什么 W4D2 不能直接把 COUNT 结果当成业务结论？',
      retellRubric: ['提到先固定输入行', '提到聚合函数只算本地教学样本', '没有提前进入真实生产结论'],
    },
    {
      id: 'chapter-2', number: 2, session: 1, timeMinutes: 14,
      title: '模型一：COUNT 与 COUNT(DISTINCT)',
      lead: 'COUNT 数行，COUNT(DISTINCT) 数唯一对象；先决定数谁，再决定怎么数。',
      conceptIds: ['aggregation-input-set', 'count-aggregate', 'distinct-aggregate'], semanticSections: ['concepts'],
      practice: {
        prompt: 'payment_success 有重复事件时，哪条写法更适合“支付订单数”？',
        options: ['COUNT(DISTINCT order_id)', 'COUNT(*)', 'SUM(amount)'],
        answerIndex: 0,
        explanation: '支付订单数按订单粒度去重，不能把重复成功事件当成两笔订单。',
      },
      retellPrompt: '闭卷解释 COUNT、COUNT(DISTINCT) 和去重键的区别，并给一个 O05 重复事件例子。',
      retellRubric: ['数行和数唯一对象分开', '去重键明确', '没有把重复事件写成新订单'],
    },
    {
      id: 'chapter-3', number: 3, session: 1, timeMinutes: 14,
      title: '模型二：SUM、AVG 和异常值',
      lead: 'SUM 表示总量，AVG 表示平均水平；异常大单会把 AVG 拉得很高，因此要同时看中位数和最大值。',
      conceptIds: ['sum-aggregate', 'avg-aggregate', 'aggregation-logic-map'], semanticSections: ['concepts', 'diagram'],
      practice: {
        prompt: 'average_amount=2077.00 时，哪条解释最稳妥？',
        options: ['平均值受 9999 元大单影响，需要和中位数一起看', '典型订单就是 2077 元', '这已经证明运营策略成功'],
        answerIndex: 0,
        explanation: 'AVG 反映平均水平，但不能单独代表典型样本。',
      },
      retellPrompt: '按“总量／平均／异常值”复述 SUM、AVG 和中位数为何要一起看。',
      retellRubric: ['SUM 和 AVG 区分清楚', '提到异常值', '没有把平均值写成典型值'],
    },
    {
      id: 'chapter-4', number: 4, session: 1, timeMinutes: 10,
      title: '第一次复述检查：聚合不是业务结论',
      lead: '这一章不增加新术语。你要把输入行、COUNT、DISTINCT、SUM、AVG 串起来，并说明为什么这些数字仍只是本地教学结果。',
      conceptIds: ['aggregation-input-set', 'count-aggregate', 'distinct-aggregate', 'sum-aggregate', 'avg-aggregate'], semanticSections: ['concepts', 'diagram'],
      practice: {
        prompt: '哪条 W4D2 表述没有越界？',
        options: ['教学表中 exposed_users=10，后续还要写聚合逻辑图和 W4D3 指标 SQL', '结果已经证明真实生产正确', 'JOIN 已经完成'],
        answerIndex: 0,
        explanation: 'W4D2 的证据停在聚合逻辑和本地样本，不得宣称真实生产正确。',
      },
      retellPrompt: '用“输入行 → 函数 → 数字 → 边界”复述一条聚合。',
      retellRubric: ['链路完整', '输入行先行', '不提前算成生产结论'],
    },
    {
      id: 'chapter-5', number: 5, session: 2, timeMinutes: 16,
      title: '操作模型：GROUP BY 与 HAVING',
      lead: 'GROUP BY 先把输入拆成组，再让每个组单独聚合；HAVING 只筛选已经聚合好的组。',
      conceptIds: ['group-by-bucket', 'having-group-filter'], semanticSections: ['diagram', 'demonstration', 'guided-lab'],
      practice: {
        prompt: '哪句话最符合 GROUP BY / HAVING 的顺序？',
        options: ['先分组算数，再用 HAVING 过滤组', '先 HAVING 再 GROUP BY', 'HAVING 用来过滤原始行'],
        answerIndex: 0,
        explanation: 'GROUP BY 负责分桶，HAVING 负责组级筛选。',
      },
      retellPrompt: '解释 GROUP BY 先分桶、HAVING 再过滤的原因，并给一个 event_name 示例。',
      retellRubric: ['先分组后过滤说清', 'WHERE 和 HAVING 分开', '没有把 HAVING 当行过滤'],
    },
    {
      id: 'chapter-6', number: 6, session: 2, timeMinutes: 12,
      title: '责任与证据边界：分母、去重键和时间窗口',
      lead: '同一数据换分母、去重键或时间窗口，结论就会变化；W4D2 只证明聚合逻辑可复核，不证明真实生产指标正确。',
      conceptIds: ['aggregation-input-set', 'distinct-aggregate', 'aggregation-logic-map'], semanticSections: ['independent-lab', 'feedback'],
      practice: {
        prompt: '哪条 cannot_prove 最符合 W4D2？',
        options: ['不能证明真实生产指标正确、JOIN、归因、趋势或 W4D3 已完成', '已经证明看板可发布', '已经证明真实生产转化率正确'],
        answerIndex: 0,
        explanation: 'W4D2 只停在教学聚合逻辑，不得越界到真实业务审计。',
      },
      retellPrompt: '用“能证明／不能证明／下一步”说明 W4D2 的边界。',
      retellRubric: ['能证明逻辑图', '不能证明真实生产', '下一步指向 W4D3'],
    },
    {
      id: 'chapter-7', number: 7, session: 2, timeMinutes: 18,
      title: '实验、aggregation-logic.md 与最终复述',
      lead: '最后完成 W4 events 六路径观察、针对性练习和 aggregation-logic.md：字段齐全，教学模拟、平均值和边界样本分开，下一步只进入 W4D3。',
      conceptIds: [...['aggregation-input-set', 'count-aggregate', 'distinct-aggregate', 'sum-aggregate', 'avg-aggregate', 'group-by-bucket', 'having-group-filter', 'aggregation-logic-map']],
      semanticSections: ['guided-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion'],
      practice: {
        prompt: '一份合格 aggregation-logic.md 最关键的组合是什么？',
        options: ['input_rows、aggregate_function、group_key、having_rule、result_value 和 cannot_prove', '一句“转化率已算完”', '直接贴 JOIN 对账结果'],
        answerIndex: 0,
        explanation: '成果必须可解释、可复核、不过界；JOIN 和真实生产结论都不属于 W4D2。',
      },
      retellPrompt: '最终复述八个首次教学概念，并说明 aggregation-logic.md 能证明什么、不能证明什么。',
      retellRubric: ['八个概念进入同一聚合链', '字段齐全', '不提前完成 W4D3 或 JOIN'],
    },
  ],
}

export function getW4D2FrameworkPlan(dayId: DayId): Day01FrameworkPlan | undefined {
  return dayId === 'W4D2' ? w4d2Framework : undefined
}
