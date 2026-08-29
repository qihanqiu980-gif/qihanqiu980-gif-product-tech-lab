import type { DailyCourse, Exercise } from './types'

const conceptIds = [
  'orders-data-contract',
  'data-quality-snapshot',
  'pandas-copy-and-coerce',
  'issue-flag-columns',
  'clean-vs-quarantine-split',
  'rule-impact-log',
  'reconciliation-check',
  'order-cleaning-script',
] as const

const prerequisiteConceptIds = [
  'script-input-contract',
  'raw-value-capture',
  'type-conversion-boundary',
  'branch-condition',
  'flow-trace',
  'output-contract',
  'transformation-step',
]

function exercise(
  id: string,
  categories: Exercise['categories'],
  conceptIdsForExercise: string[],
  prompt: string,
  options: string[],
  answerIndex: number,
  referenceAnswer: string,
  remediationLabel: string,
): Exercise {
  return {
    id,
    kind: 'single-choice',
    categories,
    conceptIds: conceptIdsForExercise,
    prompt,
    hint: '先把输入契约、质量体检、问题标记、分流和对账分开，再判断哪一步越界了。',
    options: options.map((label, index) => ({
      label,
      rationale: index === answerIndex
        ? '这项把原始文件、布尔标记、清洁数据和隔离数据分开，最适合作为 W9D3 的清洗判断。'
        : '这项要么把清洗结果当成原始真相，要么把删行、填值和对账混成一件事。',
      couldBeTrueWhen: index === answerIndex
        ? '当脚本只要求把脏订单的清洗路径画清，而不要求证明真实业务口径已经稳定时。'
        : '只有在补齐后续规则影响分析或数据契约后，才可能重新判断。',
    })),
    answerIndex,
    referenceAnswer,
    reasoning: [
      'W9D3 先把原始订单的输入契约、质量六维、问题标记和 clean/quarantine 分流串起来。',
      '原始表、清洁表、隔离表和规则日志各有边界，不能彼此冒充。',
      '本日成果只能证明本地 pandas 清洗路径和对账方式，不能证明真实业务已经完全正确。',
    ],
    rubric: ['路径和边界清楚', '原始数据与隔离数据分开', '没有越界到真实生产'],
    commonErrors: [
      { error: '把 clean 表当成全量真相', reason: '清洁表只能说明清洗后的可用部分，不能替代原始与隔离对账。' },
      { error: '把删除行当成完整处理', reason: '删除会丢失证据；W9D3 要保留 quarantine 和规则日志。' },
    ],
    remediation: {
      label: remediationLabel,
      sectionId: 'concepts',
      anchor: 'concept-orders-data-contract',
    },
  }
}

export const w9d3: DailyCourse = {
  id: 'W9D3',
  contentVersion: 'w9d3-pandas-clean-orders-day01-v1',
  week: 9,
  day: 3,
  title: '清洗订单',
  subtitle: '把脏订单整理成可复核的 clean 与 quarantine 输出；先守住输入契约、质量六维、布尔标记、规则日志和对账边界，不把本地教学模拟写成真实生产已经稳定。',
  duration: { core: 30, standard: 45, extension: 75, full: 135 },
  coreConceptGroups: [
    {
      id: 'source-contract-and-quality',
      title: '先看输入契约和质量体检',
      conceptIds: ['orders-data-contract', 'data-quality-snapshot', 'pandas-copy-and-coerce'],
      summary: '先说清 orders_dirty.csv 需要什么字段、编码和类型，再把完整性、唯一性、有效性、一致性、及时性和准确性扫一遍，最后复制原始表准备安全转换。',
      boundary: '能说明输入字段、六维体检和原始表复制；不能证明脏数据已经被修好或真实业务已经可信。',
    },
    {
      id: 'flags-and-split',
      title: '问题标记和 clean/quarantine 分流',
      conceptIds: ['issue-flag-columns', 'clean-vs-quarantine-split', 'rule-impact-log'],
      summary: '把缺失、重复、异常金额、未知状态和越界时间变成布尔标记，再按标记把订单拆成 clean 与 quarantine，并记录每条规则影响了多少行。',
      boundary: '能说明问题如何被标记、分流和留痕；不能把隔离表删掉后装作数据已经正常。',
    },
    {
      id: 'reconcile-and-script',
      title: '对账和脚本闭环',
      conceptIds: ['reconciliation-check', 'order-cleaning-script'],
      summary: '用 raw = clean + quarantine 的对账式检查收尾，再把整个流程整理成 clean_orders.py、orders_clean.csv、orders_quarantine.csv 和 quality_report.md。',
      boundary: '能说明如何对账和交付；不能证明生产数据口径已经被全部批准。',
    },
  ],
  prerequisiteConceptIds,
  learningPaths: {
    '30': {
      guidedStepIndices: [0, 1, 2, 3],
      guidedRecordIndices: [0, 1, 2],
      exerciseCount: 3,
      deliverablePromptCount: 4,
      deliverableChecklistIndices: [0, 1, 2, 3],
      deliverableMinimumContributionCharacters: 260,
    },
    '45': {
      guidedStepIndices: [0, 1, 2, 3],
      guidedRecordIndices: [0, 1, 2],
      exerciseCount: 5,
      deliverablePromptCount: 5,
      deliverableChecklistIndices: [0, 1, 2, 3, 4],
      deliverableMinimumContributionCharacters: 360,
    },
  },
  primaryGoal: '提交一份 `clean_orders.py`：把 `orders_dirty.csv` 清洗成 `orders_clean.csv` 和 `orders_quarantine.csv`，并附上 `quality_report.md` 与规则日志。',
  scenario: {
    role: '你是负责把脏订单发给下游前先做体检和分流的产品经理。',
    situation: '每天都会收到一份带空值、重复、字符串金额和未知状态的订单表。你需要先把它整理成 clean 与 quarantine 两份输出，再决定哪些规则必须保留证据。',
    question: '怎样把 pandas 清洗、问题标记、分流和对账串成一个脚本，同时不把原始订单改没了？',
    stakes: '如果直接删行、直接填 0 或把隔离数据当废数据，clean 表会看起来很好，却无法对账、无法复核，也无法说明哪些规则代价最高。',
  },
  objectives: [
    { id: 'w9d3-objective-contract', text: '能区分输入契约和质量体检，不把缺字段直接当成清洗完成。', evidence: '在 `clean_orders.py` 里写清 source_file 和 quality_rules。' },
    { id: 'w9d3-objective-flags', text: '能把问题标记和分流分开说明。', evidence: '在成果里分别写出 issue_flags、clean_output 和 quarantine_output。' },
    { id: 'w9d3-objective-reconcile', text: '能把对账和规则日志分开说明。', evidence: '在成果中同时写出 rule_log 和 reconciliation_summary。' },
    { id: 'w9d3-objective-deliverable', text: '能交出可复核的清洗脚本说明。', evidence: '成果文件包含 script_id、can_prove、cannot_prove 和 next_step 等字段。' },
  ],
  prerequisites: [
    {
      id: 'w9d3-contract-readiness',
      conceptIds: ['script-input-contract', 'raw-value-capture', 'type-conversion-boundary'],
      prompt: '你能把输入契约、原始值和类型转换分开说吗？',
      passDescription: '能说明脚本先接住输入和原始值，再谈后面的清洗和对账。',
      remediationLabel: '补学 W8D2：输入与原始值',
      remediationTarget: '#/lesson/W8D2',
      remediation: {
        purpose: '先确认输入契约、原始值和类型处理，后面才不会把原始表直接改坏。',
        steps: [
          '回看 W8D2 的脚本输入契约和原始值捕获。',
          '确认输入、原始值和类型转换的职责。',
          '把一条订单记录说清楚它先落到哪里。',
        ],
        successCheck: '能说出输入、原始值和转换后的值各自负责什么。',
      },
    },
    {
      id: 'w9d3-quality-readiness',
      conceptIds: ['branch-condition', 'flow-trace', 'output-contract', 'transformation-step'],
      prompt: '你能把分支、流程痕迹、输出边界和转换步骤分开说吗？',
      passDescription: '能说出哪一步在选路、哪一步在留痕、哪一步在出口、哪一步在转换。',
      remediationLabel: '补学 W8D1 / W8D2：结构与流程',
      remediationTarget: '#/lesson/W8D2',
      remediation: {
        purpose: '先会看分支、流程痕迹、输出边界和转换步骤，才不会把清洗规则写成随手删行。',
        steps: [
          '回看 W8D1 的分支与函数边界。',
          '回看 W8D2 的输出契约和流程痕迹。',
          '再说出分流和对账分别在什么地方收尾。',
        ],
        successCheck: '能把选路、留痕、输出和对账分开讲清。',
      },
    },
  ],
  concepts: [
    {
      id: 'orders-data-contract',
      prerequisiteConceptIds: ['script-input-contract', 'raw-value-capture'],
      term: '订单输入契约',
      english: 'Order Input Contract',
      definition: '订单输入契约是脚本在读取 `orders_dirty.csv` 之前先约定好的字段规则：订单号、用户号、支付金额、状态、支付时间、编码和分隔符怎样出现，缺少什么时要先停步或隔离，而不是先把结果写出来。',
      why: '如果不先写清输入契约，脚本就会把看起来像表格的任何文本都当成可用订单，后面的体检和清洗也会站在错误前提上。',
      problemSolved: '回答“这份订单清洗脚本到底需要什么源文件才能开始”。',
      input: '带有空值、重复、字符串金额和未知状态的订单 CSV、以及它的编码和分隔方式。',
      output: '一组可被 pandas 继续处理的读取条件，或者一条说明字段缺失的停步信息。',
      systemPosition: '位于原始 CSV 和第一批 DataFrame 变量之间，是清洗流程的入口约束。',
      process: [
        '先列出必填字段和可选字段。',
        '再确认编码、分隔符和最小可读形状。',
        '最后决定继续、停步还是隔离。',
      ],
      owner: '脚本作者负责把输入契约写进代码；产品经理负责知道哪些订单文件可以进入清洗，哪些必须先补齐。',
      notResponsibleFor: '输入契约不负责证明订单内容是真的，只负责说明什么样的文件可以进入脚本。',
      compareWith: '契约像门口的清单，源文件像刚送到桌上的材料；前者是约定，后者是内容。',
      evidence: [
        '缺少一个必填字段时，脚本会先进入停步分支。',
        '只要编码或列名变化，后续质量体检就会不同。',
      ],
      failureModes: [
        '把标题行也当成业务记录。',
        '把字段缺失直接当成零值或默认状态。',
      ],
      pmUse: '先判断源文件是否满足流程，再谈清洗脚本应该输出什么。',
      correctExample: '脚本要求 order_id、paid_amount 和 status 都存在，才会开始清洗订单。',
      incorrectExample: '只要脚本收到了任何 CSV，就说明输入契约已经满足。',
    },
    {
      id: 'data-quality-snapshot',
      prerequisiteConceptIds: ['orders-data-contract'],
      term: '质量六维快照',
      english: 'Six-Dimension Quality Snapshot',
      definition: '质量六维快照是先在原始订单上读出完整性、唯一性、有效性、一致性、及时性和准确性，再把每一维整理成可追踪的现状，而不是把脏数据直接改写成漂亮结果。',
      why: '如果不先做六维体检，脚本就会看见一堆看起来像订单的行，却不知道问题是缺字段、重复、金额异常、状态冲突还是跨天时间错位。',
      problemSolved: '回答“脚本先怎样判断这批订单脏在哪里”。',
      input: '原始订单、字段类型、空值分布、重复键、状态值和时间戳。',
      output: '一份质量快照，能说明脏数据主要落在哪些维度。',
      systemPosition: '位于输入契约之后、问题标记之前，是清洗前的体检台。',
      process: [
        '扫描空值、重复和异常范围。',
        '把六个维度各自记成可比较的快照。',
        '把最明显的问题交给后续标记列。',
      ],
      owner: '写脚本的人负责让体检规则稳定；产品经理负责知道六维快照只是整理现状，不是修复动作。',
      notResponsibleFor: '六维快照不负责修数据，也不负责替代后面的分流和对账。',
      compareWith: '它像体检报告；先列出症状，再决定怎么治。',
      evidence: [
        '同一批输入再次运行时，六维快照应保持一致或可解释变化。',
        '快照里的问题可以回指到具体行和具体字段。',
      ],
      failureModes: [
        '只看总行数，不看每个维度的分布。',
        '把快照直接写成修复后的结论。',
      ],
      pmUse: '先看数据在哪些维度出问题，再决定规则是否要删、改或隔离。',
      correctExample: '快照显示唯一性和有效性问题最多，于是先处理重复订单和异常金额。',
      incorrectExample: '体检结果很长，所以订单已经被清洗好了。',
    },
    {
      id: 'pandas-copy-and-coerce',
      prerequisiteConceptIds: ['orders-data-contract', 'data-quality-snapshot', 'type-conversion-boundary'],
      term: 'pandas 复制与类型转换',
      english: 'Pandas Copy and Coercion',
      definition: 'pandas 复制与类型转换是先把 raw DataFrame 复制成工作副本，再用 `to_numeric`、`to_datetime` 和合适的 `astype` 去整理类型，避免在原始表上直接改写，也避免把字符串假装成数字。',
      why: '如果不先复制，原始数据会被悄悄覆盖；如果不先转换，字符串金额、空时间和混合状态就会让后续布尔判断失真。',
      problemSolved: '回答“脚本先怎样把脏订单变成能计算的表”。',
      input: 'raw DataFrame、字符串金额、混合日期、空值标记和未知状态。',
      output: '一份字段形状更统一、类型更可比较的工作 DataFrame。',
      systemPosition: '位于原始读取和问题标记之间，是 pandas 的整理台。',
      process: [
        '复制 raw，保住原始表。',
        '把金额和时间转成可比较类型。',
        '为后续标记保留未能转换的痕迹。',
      ],
      owner: '脚本作者负责让转换规则稳定；产品经理负责知道转换是在准备材料，不是在修改真相。',
      notResponsibleFor: '类型转换不负责证明业务正确，只负责让后续比较和统计能够进行。',
      compareWith: '它像把纸质表格抄成同一种字体再算数，也就是 type-coercion 之前的准备。',
      evidence: [
        'raw 和工作副本可以同时对照。',
        '转换失败的值不会被静默吞掉。',
      ],
      failureModes: [
        '把原始表直接改成工作表。',
        '把字符串数字当成已经验证的业务结果。',
      ],
      pmUse: '先确认数据已经变成可比较的类型，再决定哪些行该进入 quarantine。',
      correctExample: '把 `paid_amount` 从字符串转成数值后，再判断它是否小于 0。',
      incorrectExample: '看起来像数字就不需要先转换。',
    },
    {
      id: 'issue-flag-columns',
      prerequisiteConceptIds: ['data-quality-snapshot', 'branch-condition', 'flow-trace'],
      term: '问题标记列',
      english: 'Issue Flag Columns',
      definition: '问题标记列是把缺失订单号、重复订单号、无效金额、未知状态、异常时间和其他问题各自变成布尔列，让脚本先把“哪里有问题”写成事实，再决定是否隔离、降级或继续处理。',
      why: '如果不先把问题显式标成布尔列，脚本就只能靠肉眼挑行，规则也会越来越像临场判断而不是可复跑逻辑。',
      problemSolved: '回答“脚本怎样把每类脏点变成可复查的标记”。',
      input: '已经转换过类型的工作 DataFrame、六维快照和质量规则。',
      output: '一组布尔问题列以及按行聚合出的 issue_any。',
      systemPosition: '位于类型整理和 clean/quarantine 分流之间，是问题显式化的标记台。',
      process: [
        '给每类问题各建一列布尔标记。',
        '把多列标记合并成总问题掩码。',
        '保留每个标记对应的解释。',
      ],
      owner: '脚本作者负责让标记稳定可读；产品经理负责知道标记只是诊断，不是最终结论。',
      notResponsibleFor: '问题标记列不负责删除记录，只负责把问题写出来。',
      compareWith: '它像红黄灯；先告诉你哪里有风险，再决定怎么走。',
      evidence: [
        '每一类问题都有自己的布尔列。',
        '同一行可以同时带多个问题标记。',
      ],
      failureModes: [
        '只留下一个总问题列却不保留原因。',
        '把标记列写成直接删除行的借口。',
      ],
      pmUse: '先看问题是否被显式标出，再决定能不能进入 clean。',
      correctExample: '`is_duplicate_order_id` 和 `is_invalid_amount` 都为 True 的行进入隔离区。',
      incorrectExample: '没有问题列也没关系，反正最后都删掉。',
    },
    {
      id: 'clean-vs-quarantine-split',
      prerequisiteConceptIds: ['issue-flag-columns', 'output-contract'],
      term: 'clean 与 quarantine 分流',
      english: 'Clean and Quarantine Split',
      definition: 'clean 与 quarantine 分流是按问题标记把订单拆成两份输出：clean 保留可继续使用的行，quarantine 保留有问题的行和原因，不删除原始记录，也不把坏行悄悄混进好表。',
      why: '如果没有分流，清洗后的表会混着问题行；如果直接删除，证据就没了，后面也无法说明规则到底影响了多少数据。',
      problemSolved: '回答“脚本怎样把可用订单和待复核订单分开”。',
      input: '问题标记列、原始行和输出路径。',
      output: '清洁表、隔离表和对应的原因字段。',
      systemPosition: '位于问题标记之后、规则日志之前，是输出分岔口。',
      process: [
        '用总问题掩码切出 clean。',
        '把问题行保留到 quarantine。',
        '给隔离行附上原因和来源。',
      ],
      owner: '写脚本的人负责让分流稳定；产品经理负责知道 quarantine 不是废数据，而是证据区。',
      notResponsibleFor: '分流不负责掩盖问题，只负责把可用和待复核分开。',
      compareWith: '它像把合格品和返工品分到不同托盘。',
      evidence: [
        'clean 与 quarantine 的行数之和应回到原始行数。',
        '隔离表保留了可追踪的原因。',
      ],
      failureModes: [
        '把 quarantine 直接丢掉。',
        '把问题行悄悄混进 clean 表。',
      ],
      pmUse: '先确认哪些行可继续用，哪些行必须留下证据。',
      correctExample: '重复且金额异常的订单进入 quarantine，并带上 `reason` 字段。',
      incorrectExample: '把坏行删掉就等于清洗完成。',
    },
    {
      id: 'rule-impact-log',
      prerequisiteConceptIds: ['clean-vs-quarantine-split', 'transformation-step'],
      term: '规则影响日志',
      english: 'Rule Impact Log',
      definition: '规则影响日志是把每条清洗规则影响了多少行、为什么这么处理、由谁定义的版本写成日志表或 Markdown 记录，让后面的人知道 clean/quarantine 是怎么来的。',
      why: '如果没有规则日志，脚本看起来会很顺，但没人知道哪条规则最贵、最伤数据、最需要复查。',
      problemSolved: '回答“脚本怎样记录每条规则的代价和原因”。',
      input: '问题标记、分流结果、规则编号和处理版本。',
      output: '按规则汇总的影响行数和原因说明。',
      systemPosition: '位于分流之后、对账之前，是清洗的留痕层。',
      process: [
        '给每条规则写编号和描述。',
        '统计每条规则影响的行数。',
        '把版本和说明写进日志。',
      ],
      owner: '脚本作者负责把影响日志写完整；产品经理负责知道规则成本和收益不能靠感觉判断。',
      notResponsibleFor: '规则日志不负责替你决定规则对错，只负责把影响显出来。',
      compareWith: '它像手术记录；先记下做了什么，再谈后果。',
      evidence: [
        '每条规则都能对应到影响数。',
        '日志能解释为什么某些行进了 quarantine。',
      ],
      failureModes: [
        '只留最终结果，不留规则影响。',
        '把“看起来正常”当成规则已经合理。',
      ],
      pmUse: '先看每条规则影响了多少行，再决定要不要放宽或重写。',
      correctExample: '`invalid_amount` 规则影响了 7 行，于是日志里写明了原因和版本。',
      incorrectExample: '只要 clean 表变小，规则就一定更好。',
    },
    {
      id: 'reconciliation-check',
      prerequisiteConceptIds: ['clean-vs-quarantine-split', 'rule-impact-log'],
      term: '对账检查',
      english: 'Reconciliation Check',
      definition: '对账检查是把原始行数与 clean、quarantine 的行数加总，再抽样核对几条行记录，确认 raw = clean + quarantine 并不丢证据，也不偷偷多造行。',
      why: '如果不做对账，clean 与 quarantine 看起来都对，但总数可能已经错位，说明脚本在某一步丢行或重复了行。',
      problemSolved: '回答“脚本怎样证明分流后没有丢行或重造行”。',
      input: '原始行数、clean 行数、quarantine 行数和抽样样本。',
      output: '一份对账结论，明确原始、清洁和隔离是否闭合。',
      systemPosition: '位于规则日志之后、交付报告之前，是清洗闭环的收口层。',
      process: [
        '比较原始行数与 clean + quarantine。',
        '抽样核对原始、清洁和隔离中的对应行。',
        '把差异写成有限结论和下一步。',
      ],
      owner: '脚本作者负责让对账结果可复核；产品经理负责知道闭合不等于业务完全正确。',
      notResponsibleFor: '对账不负责证明所有规则都完美，只负责说明数据有没有被丢掉。',
      compareWith: '它像收银对账；钱和单子要能对上。',
      evidence: [
        '原始 = clean + quarantine 可以成立。',
        '抽样行可以回到原始记录与原因。',
      ],
      failureModes: [
        '只看 clean 表漂亮不漂亮，不看总数。',
        '对账不过关仍然把结果发出去。',
      ],
      pmUse: '先确认总数闭合，再讨论规则是否需要再调。',
      correctExample: '原始 24 行 = clean 19 行 + quarantine 5 行，并能抽样回查。',
      incorrectExample: 'clean 表看起来顺眼，所以总数一定没问题。',
    },
    {
      id: 'order-cleaning-script',
      prerequisiteConceptIds: ['orders-data-contract', 'data-quality-snapshot', 'pandas-copy-and-coerce', 'issue-flag-columns', 'clean-vs-quarantine-split', 'rule-impact-log', 'reconciliation-check'],
      term: '订单清洗脚本',
      english: 'Order Cleaning Script',
      definition: '订单清洗脚本是把输入契约、六维体检、类型转换、问题标记、分流、规则日志和对账放在同一条可重复路径里的完整工具。它能帮助团队快速生成 clean_orders.py 的结果，但它仍然只是一段本地教学模拟脚本，不等于生产数据已经完全可信。',
      why: '把这些环节串起来，团队才会知道 clean_orders.py 是怎么把脏订单分出来的；一旦某一步出错，也能顺着脚本把问题定位回去。',
      problemSolved: '回答“这份脚本怎样把脏订单变成可复核的 clean 与 quarantine 输出”。',
      input: '一批脏订单、脚本参数和输出路径。',
      output: '一份 clean 表、一份 quarantine 表和一份质量报告。',
      systemPosition: '位于订单源文件、清洗过程和团队沟通之间，是一天一版的小工具。',
      process: [
        '读取输入并检查契约。',
        '清洗类型并生成问题标记。',
        '分流到 clean 和 quarantine。',
        '记录规则影响并做对账。',
      ],
      owner: '脚本作者负责写出可复跑流程；产品经理负责知道脚本能帮什么、不能帮什么。',
      notResponsibleFor: '订单清洗脚本不负责证明真实业务口径已经被批准，也不负责替代后续规则评审。',
      compareWith: '它像一套标准清洗流水线；能把材料整理好，但不能替你对外担保。',
      evidence: [
        '同一输入和同一命令能够再次生成同类 clean、quarantine 与报告。',
        '报告里明确写出有限结论和不能证明项。',
      ],
      failureModes: [
        '把脚本运行成功误写成生产数据已经完全正确。',
        '把 clean 表格式整齐误写成数据已经无风险。',
      ],
      pmUse: '先看脚本链路，再决定它是否适合作为每天的重复工具。',
      correctExample: '脚本把订单整理成 clean_orders.py、orders_clean.csv、orders_quarantine.csv 和 quality_report.md。',
      incorrectExample: 'clean 表排版整齐，所以真实业务已经被证明正确。',
    },
  ],
  diagram: {
    title: '脏订单到 clean / quarantine 的路径',
    caption: '先把原始文件、质量体检、问题标记、分流和对账分开，再说这条路径能证明什么。',
    nodes: [
      { id: 'raw-orders', label: '原始订单', description: '先确认 orders_dirty.csv 的字段、编码和类型是否满足读取契约。', input: '脏订单 CSV', output: '可读的原始 DataFrame', owner: '脚本作者', evidence: '缺字段或编码异常会先停步。' },
      { id: 'quality-scan', label: '质量体检', description: '在原始表上扫六维质量，找出最明显的脏点。', input: '原始 DataFrame', output: '质量快照', owner: '脚本作者', evidence: '六维体检能回指到具体字段。' },
      { id: 'issue-flags', label: '问题标记', description: '把缺失、重复、异常金额、未知状态和越界时间变成布尔列。', input: '工作 DataFrame', output: 'issue flags', owner: '脚本作者', evidence: '每一类问题都有自己的标记列。' },
      { id: 'split-output', label: 'clean / quarantine', description: '按问题标记拆出 clean 和 quarantine，并保留原因。', input: 'issue flags', output: 'clean/quarantine 两份输出', owner: '脚本作者', evidence: '坏行进入 quarantine，原始行不被悄悄删除。' },
      { id: 'reconcile-report', label: '对账报告', description: '核对 raw = clean + quarantine，并写出规则影响。', input: '清洗结果', output: 'quality_report.md', owner: '产品经理', evidence: '总数闭合后再讨论规则代价。' },
    ],
    branches: [
      { from: 'raw-orders', to: 'quality-scan', label: '字段与编码可读', kind: 'normal' },
      { from: 'quality-scan', to: 'reconcile-report', label: 'schema mismatch', kind: 'failure' },
      { from: 'quality-scan', to: 'issue-flags', label: '体检完成', kind: 'normal' },
      { from: 'issue-flags', to: 'split-output', label: '布尔标记可用', kind: 'normal' },
      { from: 'split-output', to: 'reconcile-report', label: 'raw = clean + quarantine', kind: 'normal' },
    ],
    evidenceNotes: [
      '先看输入契约，再看六维体检。',
      'issue flags 不是结果，而是分流依据。',
      'quarantine 不是废数据，必须保留原因。',
      '观察器路径标签：input-contract / quality-snapshot / type-coercion / issue-flags / split-and-log / reconciliation / qualified-clean-script。',
    ],
  },
  demonstration: {
    title: '从原始订单到质量报告的完整示范',
    businessProblem: '运营把一份脏订单 CSV 交给你，要求把可用订单送给下游，把问题订单保留下来，并且说清每条规则为什么会影响数据。',
    finalConclusion: '这条本地 pandas 脚本可以把 clean_orders.py 的输入契约、quality_rules、issue_flags、clean_output、quarantine_output、rule_log 和 reconciliation_summary 串成一份质量报告；它能证明路径和边界，但不能证明真实业务已经完全正确。',
    conclusionLimit: '教学模拟只说明订单是如何被分成 clean 与 quarantine 的，不说明生产口径已经被批准或所有规则都无争议；它仍然不能把 quality_report.md 变成生产证据。',
    steps: [
      {
        title: '先确认输入契约',
        action: '查看 orders_dirty.csv 的字段、编码和列形状，确认缺口会先触发停步或隔离。',
        reason: '如果源字段不齐，后面的质量体检和分流都会站在错误前提上。',
        evidence: '日志里会出现字段缺失、编码不一致或停步提示。',
        proves: '能证明脚本先核对了输入契约。',
        limitation: '不能证明所有订单内容都真实或完整。',
      },
      {
        title: '再做六维体检',
        action: '在原始表上扫描完整性、唯一性、有效性、一致性、及时性和准确性。',
        reason: '先看脏点在哪里，才知道该用哪条规则去标记。',
        evidence: '体检快照里能看到每一维的状态和主要问题。',
        proves: '能证明质量快照已经被生成。',
        limitation: '不能证明脏数据已经被修好。',
      },
      {
        title: '把问题变成布尔标记',
        action: '为缺失订单号、重复订单号、无效金额、未知状态和异常时间各建一列标记。',
        reason: '标记列让规则变成可复查的事实，而不是临场判断。',
        evidence: '同一行可以同时带多个问题标记。',
        proves: '能证明问题已经被显式化。',
        limitation: '不能证明这条规则就是最终业务口径。',
      },
      {
        title: '分流到 clean 和 quarantine',
        action: '按总问题掩码拆出 clean 与 quarantine，并为隔离行保留原因。',
        reason: 'clean 只保留可继续使用的行，quarantine 则留下证据。',
        evidence: '输出里会同时出现 clean.csv 和 quarantine.csv。',
        proves: '能证明可用订单和待复核订单被分开了。',
        limitation: '不能证明坏行已经消失。',
      },
      {
        title: '记录规则影响并对账',
        action: '把每条规则影响了多少行写进日志，再核对 raw = clean + quarantine。',
        reason: '对账让清洗闭环，规则日志让代价可见。',
        evidence: '报告里会出现规则影响数和总数闭合检查。',
        proves: '能证明数据没有被悄悄丢掉。',
        limitation: '不能证明生产数据已经完全可信。',
      },
    ],
  },
  guidedLab: {
    title: '教学模拟：先把脏订单摸清楚',
    goal: '在不碰真实生产系统的前提下，观察 orders_dirty.csv、质量六维、问题标记、clean/quarantine 和对账如何接力。',
    safety: '只处理教学模拟样本，不连接真实订单、支付、财务或分析仓库。',
    conceptIds: ['orders-data-contract', 'data-quality-snapshot', 'pandas-copy-and-coerce', 'issue-flag-columns', 'clean-vs-quarantine-split', 'rule-impact-log', 'reconciliation-check', 'order-cleaning-script'],
    predictionPrompt: '先判断哪一类问题最容易影响 clean 表：缺失、重复、无效金额、未知状态还是时间越界？',
    steps: [
      {
        title: '确认输入和缺口',
        action: '读取一小批教学样本，标出哪些列缺失、哪些值需要降级。',
        observe: '能看到哪些行会先进入停步或隔离分支。',
        explanation: '先确认契约，才能避免把坏输入直接算进 clean。',
        proves: '证明脚本先检查了输入契约。',
        cannotProve: '不能证明真实订单源已经完整。',
      },
      {
        title: '执行质量体检',
        action: '在原始表上读取六维质量，找出最明显的脏点。',
        observe: '体检面板里会出现完整性、唯一性和有效性等快照。',
        explanation: '体检让规则有了证据，再决定怎样标记。',
        proves: '证明六维质量快照真的生成了。',
        cannotProve: '不能证明数据已经被修复。',
      },
      {
        title: '生成问题标记',
        action: '为缺失、重复、无效金额、未知状态和异常时间各建布尔列。',
        observe: '同一行可能同时带多个 issue flag。',
        explanation: '问题标记把判断变成可追踪列，而不是口头判断。',
        proves: '证明每类问题都被显式标出。',
        cannotProve: '不能证明规则永远正确。',
      },
      {
        title: '分流并对账',
        action: '把数据拆成 clean 和 quarantine，再核对 raw = clean + quarantine。',
        observe: '输出里能同时看到 clean、quarantine 和对账结果。',
        explanation: '分流保留证据，对账保证没有丢行。',
        proves: '证明分流后还能闭合回原始行数。',
        cannotProve: '不能证明生产口径已经批准。',
      },
    ],
    recordPrompts: [
      '哪一类问题最先影响 clean 表？',
      '哪条 issue flag 最值得单独留痕？',
      '原始 = clean + quarantine 是否成立？',
    ],
    comparePrompt: '对照你的预测，解释哪条规则最贵、哪条规则最适合保留到 quarantine。',
    passCriteria: [
      '能说出输入契约、六维体检和问题标记的关系。',
      '能说明 clean 与 quarantine 为什么都要保留。',
      '能用对账结果证明没有丢行。',
    ],
  },
  independentLab: {
    title: '独立变式：只改一类脏点',
    scenario: '某天 `paid_amount` 里出现了带逗号的字符串、`status` 多了一个 `review` 值、`paid_at` 多出跨天行。你不能直接删掉“看着不对”的行，而要把它们保留进 quarantine，并让 clean_orders.py、quality_rules 和 issue_flags 继续可追溯。',
    conceptIds: ['orders-data-contract', 'data-quality-snapshot', 'pandas-copy-and-coerce', 'issue-flag-columns', 'clean-vs-quarantine-split', 'rule-impact-log', 'reconciliation-check', 'order-cleaning-script'],
    changedConditions: [
      '金额字段改成带千分位的字符串',
      '状态值新增 review',
      '支付时间出现跨天边界行',
      '订单号重复且用户号缺失',
    ],
    task: '在不覆盖原始表的前提下，把这批订单拆成 clean 与 quarantine，并写出每条规则的影响数。',
    predictionPrompt: '先预测哪一类问题会把最多行送进 quarantine，以及为什么。',
    evidenceRequirements: [
      'quarantine 里保留原因字段',
      '每条规则都有影响行数',
      'raw = clean + quarantine 可以对账',
    ],
    passCriteria: [
      '清洗前后原始表仍可追溯。',
      '至少一类问题有独立的布尔标记。',
      '最终报告写清能证明和不能证明的边界。',
    ],
    remediation: {
      label: '回看质量体检和布尔标记',
      sectionId: 'concepts',
      anchor: 'concept-issue-flag-columns',
    },
  },
  exercises: [
    exercise(
      'w9d3-q1',
      ['概念与边界'],
      ['orders-data-contract', 'data-quality-snapshot'],
      '哪句话最符合 W9D3 的输入契约和六维体检关系？',
      ['先确认 orders_dirty.csv 的字段、编码和质量快照，再决定继续、停步还是隔离', '只要 clean 表能导出，原始文件就不重要了', '把所有坏行直接删掉最省事'],
      0,
      'W9D3 先看输入契约和六维体检，再决定继续、停步还是隔离；clean 只是结果，不是证据全部。',
      '补学 W8D2：输入和流程痕迹',
    ),
    exercise(
      'w9d3-q2',
      ['机制推演'],
      ['pandas-copy-and-coerce', 'issue-flag-columns'],
      '哪条流程最准确地描述了 pandas 清洗的顺序？',
      ['先 copy 原始表，再转类型、生成 issue flags，最后按标记分流', '先把坏行删掉，再回头补类型', '先导出 clean.csv，再决定是否要 quarantine'],
      0,
      'W9D3 的顺序是先复制原始表，再做类型转换和问题标记，最后才分流到 clean 与 quarantine。',
      '补学 W8D1 / W8D2：复制和类型转换',
    ),
    exercise(
      'w9d3-q3',
      ['证据判断'],
      ['clean-vs-quarantine-split', 'reconciliation-check'],
      '哪条判断最适合作为 W9D3 的证据结论？',
      ['raw = clean + quarantine 可以成立，并且 quarantine 保留了原因', 'clean 表很整齐，所以脏数据已经不存在', '只要 quarantine 为空，说明规则一定完美'],
      0,
      '对账式结论要说明 raw = clean + quarantine，并保留 quarantine 原因；clean 整齐不等于真相。',
      '补学 W8D2：输出和对账边界',
    ),
    exercise(
      'w9d3-q4',
      ['工作场景'],
      ['issue-flag-columns', 'clean-vs-quarantine-split'],
      '如果 `fillna(0)` 会把“未知金额”伪装成“0 元”，最稳妥的做法是什么？',
      ['按字段语义选择隔离、保留或标记，并在 rule_log 里写明影响', '全部填 0，反正能算', '把这类行删掉就不会误导'],
      0,
      '字段语义不同，处理方式也不同；W9D3 要保留证据并记录规则影响，而不是统一填 0 或直接删行。',
      '补学 W8D6：字段语义和证据边界',
    ),
    exercise(
      'w9d3-q5',
      ['综合变式', '证据判断'],
      ['order-cleaning-script', 'reconciliation-check', 'rule-impact-log'],
      '一份合格的 clean_orders.py 最关键的组合是什么？',
      ['输入契约、六维体检、issue flags、clean/quarantine、rule_log、reconciliation_summary、can_prove、cannot_prove', '只写“清洗完成了”', '直接贴 W9D4 的规则影响结论'],
      0,
      '合格脚本必须可解释、可复核、不过界；它不替后续课程完成规则影响分析。',
      '补学 W8D6：证据边界与脚本输出',
    ),
  ],
  deliverable: {
    title: '清洗脚本',
    conceptIds: ['orders-data-contract', 'data-quality-snapshot', 'pandas-copy-and-coerce', 'issue-flag-columns', 'clean-vs-quarantine-split', 'rule-impact-log', 'reconciliation-check', 'order-cleaning-script'],
    purpose: '把 `orders_dirty.csv` 清洗成 `orders_clean.csv` 和 `orders_quarantine.csv`，并把质量报告 `quality_report.md` 与规则日志一起交出去；这仍然是教学模拟。',
    whenToUse: '当你需要把一份脏订单整理成可继续使用的 clean 表，同时保留隔离证据和对账结论时。',
    audience: '产品经理、数据分析和研发都能读懂的清洗说明。',
    fields: [
      { name: 'script_id', meaning: '脚本名、版本和入口，例如 `clean_orders.py`。', source: '来自脚本文件名和运行方式。' },
      { name: 'source_file', meaning: '原始输入文件与读取条件，例如 `orders_dirty.csv` 和编码。', source: '来自输入契约和读取代码。' },
      { name: 'quality_rules', meaning: '完整性、唯一性、有效性、一致性、及时性和准确性六维规则。', source: '来自质量快照和 `quality-rules.md`。' },
      { name: 'issue_flags', meaning: '每类问题对应的布尔列和判定条件。', source: '来自 pandas 布尔标记。' },
      { name: 'clean_output', meaning: '可继续使用的 clean 输出路径和行数。', source: '来自分流结果。' },
      { name: 'quarantine_output', meaning: '保留原因和来源的隔离输出路径。', source: '来自问题行分流。' },
      { name: 'rule_log', meaning: '每条规则影响了多少行、为什么这样处理。', source: '来自规则日志。' },
      { name: 'reconciliation_summary', meaning: 'raw = clean + quarantine 的对账结论。', source: '来自总数和抽样核对。' },
      { name: 'can_prove', meaning: '本地 pandas 流程能证明什么有限事实。', source: '来自清洗、分流和对账证据。' },
      { name: 'cannot_prove', meaning: '这份脚本不能证明什么真实业务结论。', source: '来自证据边界。' },
      { name: 'next_step', meaning: '只指向 W9D4 的规则影响分析。', source: '来自课程衔接。' },
    ],
    badExample: `# clean_orders.py
script_id: clean_orders.py
source_file: orders_dirty.csv
quality_rules: 直接把空值填 0，然后删掉坏行
issue_flags: 不需要，反正最后只保留 clean
clean_output: orders_clean.csv
quarantine_output: 不输出
rule_log: 没必要记录
reconciliation_summary: clean 表看起来正确就行
can_prove: 脏数据已经被修好
cannot_prove: 没有写
next_step: W9D4`,
    badReasons: [
      '把未知值伪装成 0，会混淆字段语义。',
      '删除坏行会丢失 quarantine 证据。',
      '没有 rule_log 和 reconciliation 就无法复核。',
    ],
    revisionSteps: [
      '先保留 raw，明确 source_file 和质量规则。',
      '为每类问题建布尔标记，再分流到 clean 与 quarantine。',
      '为每条规则记录影响数和原因。',
      '最后写出 raw = clean + quarantine 的对账结论。',
    ],
    goodExample: `# clean_orders.py
script_id: clean_orders.py
source_file: orders_dirty.csv
quality_rules:
  - completeness: 订单号、金额、状态和支付时间必须可读
  - uniqueness: order_id 不能重复
  - validity: paid_amount 不能是负数，status 只能取允许值
  - consistency: 状态和金额必须彼此一致
  - timeliness: paid_at 不能越过当天边界
  - accuracy: 数值和时间格式必须可比较
issue_flags:
  - is_missing_order_id
  - is_duplicate_order_id
  - is_invalid_amount
  - is_unknown_status
  - is_bad_paid_at
clean_output: outputs/orders_clean.csv
quarantine_output: outputs/orders_quarantine.csv
rule_log:
  - missing_order_id: 2 rows
  - invalid_amount: 4 rows
  - duplicate_order_id: 3 rows
reconciliation_summary:
  raw_rows: 24
  clean_rows: 19
  quarantine_rows: 5
  raw = clean + quarantine: true
can_prove: local pandas pipeline reproduces the same split for the same input
cannot_prove: real production data is already trustworthy
next_step: W9D4`,
    guidedPrompts: [
      '写出 source_file 和 quality_rules，说明输入契约先管什么。',
      '列出 issue_flags，并说出哪类问题最先进入 quarantine。',
      '写出 clean_output、quarantine_output 和 rule_log 的关系。',
      '补上 reconciliation_summary，说明 raw = clean + quarantine。',
      '最后写 can_prove、cannot_prove 和 next_step。',
    ],
    blankTemplate: `# clean_orders.py
script_id:
source_file:
quality_rules:
issue_flags:
clean_output:
quarantine_output:
rule_log:
reconciliation_summary:
can_prove:
cannot_prove:
next_step:`,
    standardTemplate: `# clean_orders.py
script_id: clean_orders.py
source_file: orders_dirty.csv
quality_rules:
  - completeness:
  - uniqueness:
  - validity:
  - consistency:
  - timeliness:
  - accuracy:
issue_flags:
  - is_missing_order_id
  - is_duplicate_order_id
  - is_invalid_amount
  - is_unknown_status
  - is_bad_paid_at
clean_output: outputs/orders_clean.csv
quarantine_output: outputs/orders_quarantine.csv
rule_log:
  - rule_id:
    affected_rows:
    reason:
reconciliation_summary:
  raw_rows:
  clean_rows:
  quarantine_rows:
  raw = clean + quarantine:
can_prove:
cannot_prove:
next_step: W9D4`,
    checklist: [
      '原始文件仍然保留，且 source_file 写清楚。',
      '每一类问题都有对应的 issue flag。',
      'clean 与 quarantine 都有明确输出。',
      'rule_log 记录了每条规则的影响行数。',
      'reconciliation_summary 说明 raw = clean + quarantine。',
    ],
  },
  memory: {
    conceptIds: ['orders-data-contract', 'data-quality-snapshot', 'pandas-copy-and-coerce', 'issue-flag-columns', 'clean-vs-quarantine-split', 'rule-impact-log', 'reconciliation-check', 'order-cleaning-script'],
    anchors: [
      '先复制原始 DataFrame，再做类型转换。',
      '先做六维体检，再建问题标记列。',
      'clean 与 quarantine 都要保留。',
      'raw = clean + quarantine 需要对账。',
    ],
    closedBookPrompt: '不看笔记，用自己的话解释：为什么 W9D3 先复制原始表、再建问题标记、最后才分流到 clean 和 quarantine？',
    microOperation: '把一行脏订单按照“输入契约→六维体检→问题标记→分流→对账”的顺序口头走一遍。',
    unresolvedPrompt: '如果某条规则影响了很多行，你会先改规则、先改数据，还是先保留 quarantine 再继续追问？',
    reviewStages: [
      { stage: 'D1', task: '回看 clean 与 quarantine 的边界。' },
      { stage: 'D3', task: '复述一条 issue flag 如何生成。' },
      { stage: 'D7', task: '用一条样本解释 rule_log。' },
      { stage: 'D14', task: '重新做一次 raw = clean + quarantine 对账。' },
      { stage: 'D30', task: '独立解释为什么不能直接 fillna(0)。' },
      { stage: 'D60', task: '用一个真实但脱敏的订单案例复盘整条清洗链。' },
    ],
  },
  nextLesson: {
    id: 'W9D4',
    title: '规则影响分析',
    bridge: '先量化每条清洗规则的代价和收益，再决定哪些规则应当保留、放宽或改写。',
  },
}

export function getW9D3(dayId: string): DailyCourse | undefined {
  return dayId === 'W9D3' ? w9d3 : undefined
}
