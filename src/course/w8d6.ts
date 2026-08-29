import type { DailyCourse, Exercise } from './types'

const conceptIds = [
  'summary-input-contract',
  'source-record-normalization',
  'metric-snapshot-assembly',
  'text-template-assembly',
  'repeatable-run-command',
  'evidence-limit-boundary',
  'fallback-on-schema-mismatch',
  'daily-summary-script',
] as const

const prerequisiteConceptIds = [
  'python-runtime-boundary',
  'statement-sequence',
  'input-output-boundary',
  'type-conversion-boundary',
  'branch-condition',
  'script-input-contract',
  'raw-value-capture',
  'transformation-step',
  'output-contract',
  'flow-trace',
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
    hint: '先把输入契约、清洗规则、统计快照和文本模板拆开，再判断哪一步越界了。',
    options: options.map((label, index) => ({
      label,
      rationale: index === answerIndex
        ? '这项把输入、统计和模板边界分开，最适合作为 W8D6 的摘要判断。'
        : '这项要么把输出当证明，要么把清洗、统计和模板拼成一件事。',
      couldBeTrueWhen: index === answerIndex
        ? '当脚本只要求把每日摘要路径画清，而不要求证明真实生产已经自动化时。'
        : '只有在补齐更完整的数据管道或后续课程后，才可能重新判断。',
    })),
    answerIndex,
    referenceAnswer,
    reasoning: [
      'W8D6 先把输入契约、清洗规则、指标快照和文本模板串起来，再交出自动摘要脚本。',
      '原始记录、统计结果和输出文件各有边界，不能彼此冒充。',
      '本日成果只能证明本地教学模拟中的摘要路径，不能证明真实业务自动化已经上线。',
    ],
    rubric: ['路径和边界清楚', '原始数据与快照分开', '没有越界到真实生产'],
    commonErrors: [
      { error: '把摘要输出当成全量证明', reason: '输出只能说明脚本走到了出口，不能证明每条原始记录都正确。' },
      { error: '把统计快照当成最终业务结论', reason: '快照只是加工后的中间结果，不是业务真相本身。' },
    ],
    remediation: {
      label: remediationLabel,
      sectionId: 'concepts',
      anchor: 'concept-summary-input-contract',
    },
  }
}

export const w8d6: DailyCourse = {
  id: 'W8D6',
  contentVersion: 'w8d6-daily-summary-day01-v1',
  week: 8,
  day: 6,
  title: '生成每日业务摘要',
  subtitle: '把脱敏的每日业务源整理成可重复运行的摘要脚本；先守住输入契约、清洗规则、指标快照、文本模板和证据边界，不把本地教学模拟写成真实生产自动化。',
  duration: { core: 30, standard: 45, extension: 70, full: 130 },
  coreConceptGroups: [
    {
      id: 'source-and-cleaning',
      title: '先看输入契约和源记录清洗',
      conceptIds: ['summary-input-contract', 'source-record-normalization', 'fallback-on-schema-mismatch'],
      summary: '先说清脚本要吃什么数据，再把字段缺口、类型转换和停步分支写出来，避免一上来就把摘要结论写进原始记录。',
      boundary: '能说明输入字段、清洗规则和 schema mismatch 处理；不能证明原始数据本身已经可信。',
    },
    {
      id: 'snapshot-and-template',
      title: '指标快照和文本模板',
      conceptIds: ['metric-snapshot-assembly', 'text-template-assembly', 'daily-summary-script'],
      summary: '统计快照负责把一天的记录压成可复核指标，文本模板负责把这些指标组织成给人看的摘要。',
      boundary: '能说明计数、汇总和段落填充如何接力；不能把模板输出误写成生产结果已被证明。',
    },
    {
      id: 'repeatability-and-boundary',
      title: '重复运行和证据边界',
      conceptIds: ['repeatable-run-command', 'evidence-limit-boundary'],
      summary: '同一输入、同一命令和同一输出路径应当产生同类摘要；但这仍然只是本地教学模拟，不是生产自动化承诺。',
      boundary: '能说明命令、日志和输出路径如何稳定；不能证明真实业务系统已经按同样规则上线。',
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
      deliverableMinimumContributionCharacters: 240,
    },
    '45': {
      guidedStepIndices: [0, 1, 2, 3],
      guidedRecordIndices: [0, 1, 2],
      exerciseCount: 5,
      deliverablePromptCount: 5,
      deliverableChecklistIndices: [0, 1, 2, 3, 4],
      deliverableMinimumContributionCharacters: 340,
    },
  },
  primaryGoal: '提交一份 `daily-summary-script.py`：把脱敏的每日业务记录清洗、统计并拼装成可复跑的摘要脚本，同时写清能证明和不能证明的边界。',
  scenario: {
    role: '你是把运营、交易和客服数据整理成每日摘要的产品经理。',
    situation: '每天傍晚都会收到一份脱敏数据源，要求在很短时间内输出一页摘要。你想先把脚本写成可复跑的流程，再决定哪些地方必须停步或降级。',
    question: '怎样把清洗、统计和文本输出串成一个脚本，同时不把本地模拟写成真实自动化上线？',
    stakes: '如果输入契约、清洗规则、指标快照和模板拼装混在一起，摘要就会看起来完整，却无法复核、无法重跑，也无法说明哪些只是教学模拟。',
  },
  objectives: [
    { id: 'w8d6-objective-source', text: '能区分输入契约和源记录清洗，不把字段缺口写成摘要结论。', evidence: '在 `daily-summary-script.py` 中写清 input_source 和 cleaning_rule。' },
    { id: 'w8d6-objective-snapshot', text: '能把指标快照和文本模板分开说明。', evidence: '在成果里分别写出 metric_snapshot 和 summary_template。' },
    { id: 'w8d6-objective-repeat', text: '能区分重复运行与真实上线。', evidence: '在成果中同时写出 run_command、run_log 和 evidence_limit。' },
    { id: 'w8d6-objective-deliverable', text: '能交出可复核的自动摘要脚本说明。', evidence: '成果文件包含 script_id、cannot_prove 和 next_step 等字段。' },
  ],
  prerequisites: [
    {
      id: 'w8d6-source-readiness',
      conceptIds: ['python-runtime-boundary', 'statement-sequence', 'input-output-boundary', 'type-conversion-boundary', 'script-input-contract', 'raw-value-capture'],
      prompt: '你能把脚本入口、输入契约和第一批原始值分开说吗？',
      passDescription: '能说明脚本先读到了什么，再谈后面的统计和摘要。',
      remediationLabel: '补学 W8D1 / W8D2：输入边界',
      remediationTarget: '#/lesson/W8D2',
      remediation: {
        purpose: '先确认脚本入口、输入和原始值，后面才不会把摘要结论写进源数据。',
        steps: [
          '回看 W8D1 的运行边界和语句顺序。',
          '回看 W8D2 的输入契约和原始值捕获。',
          '把一条输入记录说清楚它先落到哪里。',
        ],
        successCheck: '能说出输入、原始值和摘要结论各自负责什么。',
      },
    },
    {
      id: 'w8d6-transform-readiness',
      conceptIds: ['branch-condition', 'transformation-step', 'output-contract', 'flow-trace'],
      prompt: '你能把中间转换和最后输出分开说吗？',
      passDescription: '能说出哪一步只是加工，哪一步才是交付。',
      remediationLabel: '补学 W8D2：流程和输出',
      remediationTarget: '#/lesson/W8D2',
      remediation: {
        purpose: '先会看转换和输出边界，才不会把快照、模板和摘要混成一个结论。',
        steps: [
          '回看 W8D2 的变量接力。',
          '把一条流程线画成输入、转换和出口三段。',
          '再说出哪些结果还不能证明真实业务成立。',
        ],
        successCheck: '能把流程痕迹和最终摘要分开。',
      },
    },
  ],
  concepts: [
    {
      id: 'summary-input-contract',
      prerequisiteConceptIds: ['script-input-contract', 'raw-value-capture'],
      term: '每日摘要输入契约',
      english: 'Daily Summary Input Contract',
      definition: '每日摘要输入契约是脚本在接收业务源之前先约定好的字段规则：日期、来源、数量、金额、状态和备注怎样出现，缺少什么时要先停步或降级，而不是先把摘要写出来。',
      why: '如果不先写清输入契约，脚本就会把看起来像数据的任何文本都当成可用输入，后面的清洗和统计也会站在错误前提上。',
      problemSolved: '回答“这份每日摘要脚本到底需要什么源数据才能开始”。',
      input: '脱敏 CSV、JSON、手工粘贴的行文本或一小段待处理记录。',
      output: '一组可被脚本继续处理的输入条件，或者一条说明字段缺失的停步信息。',
      systemPosition: '位于外部数据源和第一批本地变量之间，是摘要流程的入口约束。',
      process: [
        '先列出必填字段和可选字段。',
        '再检查格式、空值和最小长度。',
        '最后决定继续、停步还是降级。',
      ],
      owner: '脚本作者负责把输入契约写进代码；产品经理负责知道哪些源数据可以进入摘要，哪些必须先补齐。',
      notResponsibleFor: '输入契约不负责证明数据是真的，只负责说明什么样的数据可以进入脚本。',
      compareWith: '契约像门口的清单，源记录像刚送到桌上的材料；前者是约定，后者是内容。',
      evidence: [
        '缺少一个必填字段时，脚本会先进入停步分支。',
        '只要输入格式变化，后续统计快照就会不同。',
      ],
      failureModes: [
        '把标题行也当成业务记录。',
        '把字段缺失直接当成零值。',
      ],
      pmUse: '先判断源数据是否满足流程，再谈摘要应该长什么样。',
      correctExample: '脚本要求 day、channel 和 amount 都存在，才会开始生成每日摘要。',
      incorrectExample: '只要脚本收到了任何文字，就说明输入契约已经满足。',
    },
    {
      id: 'source-record-normalization',
      prerequisiteConceptIds: ['input-output-boundary', 'type-conversion-boundary'],
      term: '源记录归一化',
      english: 'Source Record Normalization',
      definition: '源记录归一化是把原始字符串整理成统一形状的过程：去掉多余空格、统一日期格式、把能比较的值转成同一类型、把缺失和异常标成可追踪状态，方便后面的统计快照读取。',
      why: '如果源记录没有先归一化，同一个字段可能在不同记录里长得不一样，统计时就会把同类数据分成几堆，摘要看起来也会很稳，但其实只是混乱被藏起来了。',
      problemSolved: '回答“脚本先如何把一批脏记录整理成可统计的样子”。',
      input: '原始文本、数字字符串、空值标记、混合日期格式和异常状态。',
      output: '一批字段对齐、类型统一、异常可追踪的规范记录。',
      systemPosition: '位于输入契约之后、指标快照之前，是摘要处理的整理台。',
      process: [
        '去掉无意义空格和格式噪声。',
        '把日期、金额和数量转成统一类型。',
        '为缺失或异常字段保留可追踪标记。',
      ],
      owner: '写脚本的人负责让归一化规则稳定；产品经理负责知道归一化不是改结论，而是给统计准备材料。',
      notResponsibleFor: '归一化不负责证明业务结果正确，也不负责替代后面的统计和模板。',
      compareWith: '它像整理桌面文件夹；先把材料摆齐，后面才方便算数。',
      evidence: [
        '同一类记录归一化后具有相同字段形状。',
        '日志能看出哪一条记录因格式异常被单独标记。',
      ],
      failureModes: [
        '把异常行悄悄删掉却不留痕迹。',
        '把字符串数字直接当成最终数字结论。',
      ],
      pmUse: '先看数据有没有被整理成同一种形状，再谈摘要里的统计数字。',
      correctExample: '把 2026/08/27 和 2026-08-27 统一成同一种日期格式，再做当天统计。',
      incorrectExample: '只要看起来像数字，就不用区分原始字符串和归一化后的值。',
    },
    {
      id: 'metric-snapshot-assembly',
      prerequisiteConceptIds: ['transformation-step', 'output-contract'],
      term: '指标快照装配',
      english: 'Metric Snapshot Assembly',
      definition: '指标快照装配是把清洗后的记录压成一组当天可复核的统计：记录数、总额、空值数、异常数和关键分组变化等。它让摘要有一个清楚的中间台账，而不是只剩下一段口语化结论。',
      why: '如果没有指标快照，摘要就只能直接从原始记录跳到文字描述，中间发生了什么就很难复核，出错时也说不清是哪一段出了问题。',
      problemSolved: '回答“脚本怎样把当天数据压成能写进摘要的数值台账”。',
      input: '归一化后的记录、分组键、汇总字段和规则参数。',
      output: '一组数值快照，能够支持后面的摘要文本填充。',
      systemPosition: '位于数据整理和文本拼装之间，是脚本的统计台账。',
      process: [
        '统计记录数量和关键字段总和。',
        '计算缺失、异常和分组差异。',
        '把可复核数值交给文本模板。',
      ],
      owner: '脚本作者负责让快照可读可查；产品经理负责知道它只是统计中间层，不是业务结论本身。',
      notResponsibleFor: '指标快照不负责证明生产结果已经正确，只负责把当天的数值整理出来。',
      compareWith: '它像账本里的汇总页；能说明怎么算的，但还不是最终报告。',
      evidence: [
        '快照里的数字可以对应回原始记录。',
        '同一批输入再次运行，快照应保持一致或可解释变化。',
      ],
      failureModes: [
        '把快照直接写成结论句。',
        '把少量样本的数字当成全量证明。',
      ],
      pmUse: '先问“这个数字从哪来”，再问“这句话是不是已经能发给同事”。',
      correctExample: 'valid_rows=21, missing_amount=1, total_amount=12840 先作为快照，再交给模板。',
      incorrectExample: '总额看起来不错，所以真实业务已经完全正确。',
    },
    {
      id: 'text-template-assembly',
      prerequisiteConceptIds: ['output-contract', 'flow-trace'],
      term: '文本模板拼装',
      english: 'Text Template Assembly',
      definition: '文本模板拼装是把指标快照塞进固定结构，生成给人看的摘要段落、列表和提醒，而不是临场自由发挥。模板决定什么必须出现，什么只能留在有限结论里。',
      why: '如果模板不固定，今天写出来像日报，明天像复盘，后天像公告，读者根本看不出摘要里哪些部分是数字、哪些部分是解释、哪些部分只是边界说明。',
      problemSolved: '回答“脚本怎样把统计结果变成稳定的摘要文本”。',
      input: '指标快照、固定段落、标题、提示词和有限结论规则。',
      output: '可复核的摘要文本或 Markdown 草稿。',
      systemPosition: '位于快照之后、输出文件之前，是文本组织层。',
      process: [
        '把快照字段映射到段落结构。',
        '把说明句和有限结论分开放置。',
        '保留不能证明的边界说明。',
      ],
      owner: '脚本作者负责模板稳定；产品经理负责知道模板只是输出容器，不是事实本身。',
      notResponsibleFor: '模板不负责计算指标，也不负责证明生产自动化已经上线。',
      compareWith: '它像填空式周报；先定好空格，再把数字放进去。',
      evidence: [
        '同一个快照可以生成同一结构的文本。',
        '模板字段缺失时，脚本应该先提醒而不是悄悄补写。',
      ],
      failureModes: [
        '把自由发挥写成固定模板。',
        '把模板中的一句解释当成数据证据。',
      ],
      pmUse: '看摘要时先检查结构，再看里面的数字和结论是否一致。',
      correctExample: '“今日摘要”固定分成输入、清洗、指标、提醒四段，数字只填进对应位置。',
      incorrectExample: '看到哪儿写到哪儿，模板不需要固定。',
    },
    {
      id: 'repeatable-run-command',
      prerequisiteConceptIds: ['python-runtime-boundary', 'statement-sequence', 'output-contract'],
      term: '重复运行命令',
      english: 'Repeatable Run Command',
      definition: '重复运行命令是脚本入口和参数组合，它让同一份输入在同一条命令下每次都能得到同类输出与同类日志。这个命令说明了怎样跑，但并不自动说明业务结果已经在生产成立。',
      why: '如果没有稳定命令，脚本今天能跑、明天却找不到路径，或者输出位置每次都变，团队就很难把它当成可以复用的小工具。',
      problemSolved: '回答“脚本怎样被稳定地再次运行”。',
      input: '脚本路径、源文件路径、输出目录、运行参数和当前工作目录。',
      output: '可重复执行的命令、稳定日志和同类摘要文件。',
      systemPosition: '位于脚本入口和结果文件之间，是重复执行的手柄。',
      process: [
        '固定脚本路径和参数。',
        '固定输入源和输出位置。',
        '记录本次运行日志，便于比较。',
      ],
      owner: '脚本作者负责把命令写稳定；产品经理负责知道“可重复运行”不等于“真实上线”。',
      notResponsibleFor: '重复运行命令不负责证明数据真相，也不负责证明生产自动化已经部署。',
      compareWith: '它像标准化操作步骤；同样按这一步做，不代表外部世界已经完全正确。',
      evidence: [
        '同一命令对同一输入应能再次生成同类摘要。',
        '日志里应记录输入、输出和跳过原因。',
      ],
      failureModes: [
        '把一次成功当成稳定复用。',
        '把路径变化当成脚本逻辑没问题。',
      ],
      pmUse: '先确认命令是否稳定，再谈这脚本能不能交给别人复跑。',
      correctExample: 'python scripts/daily-summary-script.py --source sample.csv --out out/summary.md',
      incorrectExample: '今天随手跑通就算可重复运行，路径随便写也没关系。',
    },
    {
      id: 'evidence-limit-boundary',
      prerequisiteConceptIds: ['output-contract', 'flow-trace'],
      term: '证据边界',
      english: 'Evidence Limit Boundary',
      definition: '证据边界是脚本运行记录能说明的范围：能证明本地样本如何被处理、命令是否可重跑、日志是否完整；不能证明真实业务口径已经在生产中生效。',
      why: '如果不写清证据边界，摘要脚本一旦跑通就容易被误解成“业务已经自动化完成”，这会让沟通、排期和验收都偏离事实。',
      problemSolved: '回答“本地教学模拟能证明到哪里，不能证明到哪里”。',
      input: '运行日志、摘要草稿、输入样本和输出路径。',
      output: '有限结论、不能证明项和下一步。',
      systemPosition: '位于脚本输出和团队判断之间，是证据说明层。',
      process: [
        '说明本地运行能证明什么。',
        '说明它不能证明什么。',
        '把下一步交给后续验证或人工评审。',
      ],
      owner: '脚本作者负责不越界；产品经理负责把能证明和不能证明说清。',
      notResponsibleFor: '证据边界不负责扩大结论，只负责压缩夸张。',
      compareWith: '它像验收说明书里的限制条款；先把不能证明的地方写出来，读者才知道该怎么用结果。',
      evidence: [
        '文档里明确区分本地样本与真实生产。',
        '文档里明确写出 cannot_prove。',
      ],
      failureModes: [
        '把教学模拟写成真实上线。',
        '把摘要文本当成业务真相证明。',
      ],
      pmUse: '先看证据边界，再决定是否能把脚本交给别的团队接着用。',
      correctExample: '本地样本可复跑，但不能证明生产排班已经自动生效。',
      incorrectExample: '脚本跑通了，所以真实业务结果一定已经正确。',
    },
    {
      id: 'fallback-on-schema-mismatch',
      prerequisiteConceptIds: ['script-input-contract', 'branch-condition'],
      term: '格式不匹配的停步分支',
      english: 'Fallback on Schema Mismatch',
      definition: '格式不匹配的停步分支是当输入列名、字段类型或必填项对不上时，脚本进入降级或停步路径，把缺口写进日志和摘要草稿，而不是静默吞掉错误继续生成好看的文本。',
      why: '如果输入格式错了却不提示，脚本就会把错误记录也一起算进去，摘要看起来像是成功了，实际上只是错误被藏了起来。',
      problemSolved: '回答“脚本碰到坏格式时应该怎么做”。',
      input: '缺字段的记录、类型错误的值、列名变化和空白行。',
      output: '停步提示、跳过记录、降级摘要或异常说明。',
      systemPosition: '位于输入校验和统计之前，是脚本的安全岔路。',
      process: [
        '检测字段缺失或类型冲突。',
        '决定停步、跳过还是降级。',
        '把原因写进日志和摘要说明。',
      ],
      owner: '脚本作者负责把异常分支写出来；产品经理负责知道何时该停、何时该降级。',
      notResponsibleFor: '这个分支不负责补齐真实数据，也不负责把错误变成正确。',
      compareWith: '它像门口的安检；不过线就先别进去，不能假装已经通过。',
      evidence: [
        '坏格式会触发可见提示。',
        '日志里能看见被跳过的记录和原因。',
      ],
      failureModes: [
        '把空值悄悄当成正常值。',
        '把整日结果直接判定成功而不留痕迹。',
      ],
      pmUse: '当数据源变化时，先问脚本会停在哪里，再问摘要还能不能继续写。',
      correctExample: 'amount 字段缺失时，脚本先写日志并跳过该行，而不是直接生成完整摘要。',
      incorrectExample: '反正还有别的字段，少一个也没关系。',
    },
    {
      id: 'daily-summary-script',
      prerequisiteConceptIds: ['summary-input-contract', 'source-record-normalization', 'metric-snapshot-assembly', 'text-template-assembly', 'repeatable-run-command', 'evidence-limit-boundary', 'fallback-on-schema-mismatch'],
      term: '自动摘要脚本',
      english: 'Daily Summary Script',
      definition: '自动摘要脚本是把输入契约、清洗、统计、模板、命令和证据边界放在同一条可重复路径里的完整工具。它能帮助团队快速生成一页摘要，但它自己仍然只是一段本地教学模拟脚本，不等于生产自动化已经成立。',
      why: '把这些环节串起来，团队才会看到摘要是怎么被造出来的；一旦某一步错了，也能顺着脚本把问题定位回去。',
      problemSolved: '回答“这份脚本怎样把每日数据变成可复核的摘要”。',
      input: '一批脱敏业务记录、命令参数和输出路径。',
      output: '一份带有限结论的 Markdown 摘要草稿和对应日志。',
      systemPosition: '位于数据源、统计过程和团队沟通之间，是一天一份的小工具。',
      process: [
        '读取输入并检查契约。',
        '清洗记录并生成快照。',
        '把快照填进模板并写出结果。',
        '同时记录能证明与不能证明的边界。',
      ],
      owner: '脚本作者负责写出可复跑流程；产品经理负责知道摘要脚本能帮什么、不能帮什么。',
      notResponsibleFor: '自动摘要脚本不负责证明真实业务已经上线，也不负责替代后续人工评审。',
      compareWith: '它像一套标准日报模版生成器；能把材料整理好，但不能替你对外担保。',
      evidence: [
        '同一输入和同一命令能够再次生成同类摘要。',
        '摘要和日志都明确写出有限结论。',
      ],
      failureModes: [
        '把脚本运行成功误写成生产自动化成功。',
        '把摘要格式正确误写成数据已经完全正确。',
      ],
      pmUse: '先看脚本链路，再决定它是否适合作为每天的重复工具。',
      correctExample: '脚本把一天的数据整理成固定结构的摘要，并明确说明哪些内容只是教学模拟。',
      incorrectExample: '摘要格式整齐，所以生产结果已经被证明正确。',
    },
  ],
  diagram: {
    title: '每日摘要脚本的输入到输出路径',
    caption: '先把源记录、清洗、快照、模板和输出文件分开，再说这条路径能证明什么。',
    nodes: [
      { id: 'input-contract', label: '输入契约', description: '先确认日期、来源、数量、金额和状态等字段是否齐全。', input: '脱敏业务源', output: '可处理或停步的输入', owner: '脚本作者', evidence: '缺字段会先被写进停步说明。' },
      { id: 'cleaning-gate', label: '清洗门', description: '把脏格式、空值和类型冲突整理成统一记录。', input: '原始记录', output: '规范记录', owner: '脚本作者', evidence: '日志会留下跳过或降级记录。' },
      { id: 'metric-snapshot', label: '指标快照', description: '把规范记录压成记录数、总额、异常数和分组变化。', input: '规范记录', output: '统计快照', owner: '脚本作者', evidence: '数字可以回指到原始样本。' },
      { id: 'template-fill', label: '模板拼装', description: '把快照填入固定段落，形成摘要草稿。', input: '统计快照', output: '摘要 Markdown', owner: '脚本作者', evidence: '结构固定，有限结论单独出现。' },
      { id: 'output-boundary', label: '输出边界', description: '将草稿、日志和不能证明的部分交给团队阅读。', input: '摘要草稿', output: '可复核交付物', owner: '产品经理', evidence: '不能证明项不会被写成生产真相。' },
    ],
    branches: [
      { from: 'input-contract', to: 'cleaning-gate', label: '格式匹配', kind: 'normal' },
      { from: 'input-contract', to: 'output-boundary', label: 'schema mismatch', kind: 'failure' },
    ],
    evidenceNotes: [
      '先看输入字段，再看清洗规则。',
      '指标快照和文本模板不是同一个层。',
      '输出边界必须保留 cannot_prove。',
    ],
  },
  demonstration: {
    title: '从原始源到摘要草稿的完整示范',
    businessProblem: '运营每天下午都要把脱敏记录整理成一页摘要，团队希望脚本能复跑、能留痕、能说明限制，但不希望把一个本地模拟误写成生产上线。',
    finalConclusion: '这条本地脚本可以把清洗、统计和文本拼装串成一页摘要草稿；它能证明路径和边界，但不能证明真实业务自动化已经成立。',
    conclusionLimit: '教学模拟只说明摘要是如何被生成的，不说明生产口径已经被批准或系统已经部署。',
    steps: [
      {
        title: '先检查输入契约',
        action: '查看输入源的日期、来源和必填字段，确认缺口会先触发停步或降级。',
        reason: '如果源字段都不齐，后面的清洗和统计就会建立在错误前提上。',
        evidence: '日志里会出现字段缺失、格式不一致或停步提示。',
        proves: '能证明脚本先核对了输入契约。',
        limitation: '不能证明所有源数据都真实或完整。',
      },
      {
        title: '再归一化源记录',
        action: '把日期、金额和状态统一成可比较的形状，并为异常行保留标记。',
        reason: '统计前先统一形状，才能让同类记录进入同一快照。',
        evidence: '同一条记录在日志里能看出格式被修正或异常被标出。',
        proves: '能证明清洗规则已被执行。',
        limitation: '不能证明清洗后的数值就是业务真相。',
      },
      {
        title: '装配指标快照',
        action: '把规范记录压成记录数、总额、空值数和异常数等快照字段。',
        reason: '快照让摘要可复核，也方便排查哪一项数字发生了变化。',
        evidence: '输出里会出现固定的统计字段和可追踪的值。',
        proves: '能证明统计结果被收拢成快照。',
        limitation: '不能证明生产指标已经经过审批。',
      },
      {
        title: '填充摘要模板并写出边界',
        action: '把快照字段填进固定模板，同时保留 cannot_prove 和 next_step。',
        reason: '模板保证摘要结构稳定，边界说明避免把教学模拟写成真实上线。',
        evidence: 'Markdown 草稿里能看到固定段落、有限结论和日志引用。',
        proves: '能证明摘要文本和边界说明都被写出。',
        limitation: '不能证明真实业务已经自动运行在生产环境。',
      },
      {
        title: '记录重复运行条件',
        action: '保存运行命令、输入路径、输出路径和日志，确保下一次可以按同样方式复跑。',
        reason: '稳定命令是复用脚本的前提，但不是生产真实性的证明。',
        evidence: '命令和日志都能再次对应到同一份样本。',
        proves: '能证明脚本具备重复运行的入口和痕迹。',
        limitation: '不能证明未来所有数据源都能直接接入。',
      },
    ],
  },
  guidedLab: {
    title: '教学模拟：先把摘要路径跑清楚',
    goal: '在不碰真实生产系统的前提下，观察输入契约、清洗规则、指标快照和文本模板如何接力。',
    safety: '只处理教学模拟样本，不连接真实排班、CRM、订单或分析仓库。',
    conceptIds: ['summary-input-contract', 'source-record-normalization', 'metric-snapshot-assembly', 'text-template-assembly', 'repeatable-run-command', 'evidence-limit-boundary', 'fallback-on-schema-mismatch', 'daily-summary-script'],
    predictionPrompt: '先判断哪一段最容易让摘要失真：输入契约、清洗规则、指标快照还是模板拼装？',
    steps: [
      {
        title: '确认输入和缺口',
        action: '读取一小批教学样本，标出字段是否齐全、哪些值需要降级。',
        observe: '能看到哪些行会先进入停步或跳过分支。',
        explanation: '先确认契约，才能避免把坏输入直接算进摘要。',
        proves: '证明脚本先检查输入契约。',
        cannotProve: '不能证明真实业务源已经完整。',
      },
      {
        title: '执行归一化',
        action: '把日期和金额格式统一，并记录被修正的字段。',
        observe: '日志中会出现清洗后的统一格式。',
        explanation: '清洗让后面的统计有可比较的材料。',
        proves: '证明清洗规则真的生效了。',
        cannotProve: '不能证明清洗后的值就是最终真相。',
      },
      {
        title: '生成指标快照',
        action: '统计记录数、总额和异常数，观察快照是否能回指原始记录。',
        observe: '摘要面板里会出现固定统计字段。',
        explanation: '快照是摘要的中间台账，不是直接结论。',
        proves: '证明统计结果已经被压成快照。',
        cannotProve: '不能证明生产指标已被批准。',
      },
      {
        title: '拼装摘要草稿',
        action: '把快照填入模板，写出有限结论、cannot_prove 和 next_step。',
        observe: '草稿结构固定，边界说明独立存在。',
        explanation: '模板和边界一起保证摘要不会越界。',
        proves: '证明脚本完成了文本拼装和边界说明。',
        cannotProve: '不能证明真实自动化已经上线。',
      },
    ],
    recordPrompts: [
      '这一版输入里哪些字段会先让脚本停步？',
      '哪一条清洗规则真的改变了记录形状？',
      '快照里的哪一个数字可以回指到原始记录？',
    ],
    comparePrompt: '把你写下的预测和实际观察逐条对照，说明哪一步只是教学模拟里的路径，哪一步已经能稳定复跑。',
    passCriteria: [
      '先写出预测，再看观察结果。',
      '四个步骤都被完整勾选并记录。',
      '能说明能证明和不能证明的边界。',
      '日志里保留了命令和输出路径。',
    ],
  },
  independentLab: {
    title: '独立变式：坏格式进来时怎么办',
    scenario: '同一份每日摘要脚本收到了一条缺少 amount 的记录，以及一条日期格式不同的记录。你要判断脚本应该停步、跳过还是降级，并把原因写进摘要和日志。',
    conceptIds: ['summary-input-contract', 'source-record-normalization', 'metric-snapshot-assembly', 'text-template-assembly', 'repeatable-run-command', 'evidence-limit-boundary', 'fallback-on-schema-mismatch', 'daily-summary-script'],
    changedConditions: [
      '源文件少了 amount 字段',
      '日期格式从 2026-08-27 变成 2026/08/27',
      '同一天同时出现 JSON 和 CSV 样本',
    ],
    task: '在不删改模板边界的前提下，写出停步或降级方案，并说明哪些记录被跳过、哪些数字仍然可以保留。',
    predictionPrompt: '先预测格式变化最先影响的是输入契约、清洗规则还是最终摘要。',
    evidenceRequirements: [
      '保留停步或跳过原因',
      '保留运行命令和输出路径',
      '写出 cannot_prove',
    ],
    passCriteria: [
      '条件变化与处理方式一一对应。',
      '日志里能看见被跳过的记录。',
      '有限结论与不能证明项都在。',
    ],
    remediation: {
      label: '回看输入契约和格式分支',
      sectionId: 'concepts',
      anchor: 'concept-fallback-on-schema-mismatch',
    },
  },
  exercises: [
    exercise(
      'w8d6-1',
      ['概念与边界'],
      ['summary-input-contract', 'evidence-limit-boundary'],
      '同事说“只要脚本输出了一页摘要，就说明原始数据已经可信”。你最先纠正什么？',
      ['先看输入契约和清洗规则，再看输出摘要', '直接认为摘要正确', '先跳到模板排版'],
      0,
      '摘要输出只能说明脚本走到了出口，不能替代输入契约和清洗规则的检查。',
      '补学 W8D6：输入契约和边界',
    ),
    exercise(
      'w8d6-2',
      ['机制推演'],
      ['source-record-normalization', 'fallback-on-schema-mismatch'],
      '一条记录缺少 amount 字段时，脚本最稳妥的路径是什么？',
      ['先停步并写明缺字段或降级原因', '把空值直接当成 0 就一定没问题', '直接把整日结果判为失败而不留日志'],
      0,
      '格式不匹配时应先走停步或降级分支，并把原因写进日志，而不是静默吞掉错误。',
      '补学 W8D6：格式不匹配分支',
    ),
    exercise(
      'w8d6-3',
      ['证据判断'],
      ['metric-snapshot-assembly', 'repeatable-run-command'],
      '哪组证据最能证明脚本可重复运行？',
      ['同一输入、同一命令、两次运行得到同类摘要与日志', '一次运行成功', '截图看起来很整齐'],
      0,
      '重复运行要看同一输入、同一命令和同类输出是否可复核，而不是只看一次成功。',
      '补学 W8D6：重复运行证据',
    ),
    exercise(
      'w8d6-4',
      ['工作场景'],
      ['text-template-assembly', 'daily-summary-script'],
      '运营要看懂每日摘要时，哪种交付最合适？',
      ['摘要模板里有固定字段、有限结论和日志引用', '只贴原始 CSV', '只写一句口头总结'],
      0,
      '工作场景里最重要的是稳定结构、边界说明和可复核字段，不是把原始数据直接丢给读者。',
      '补学 W8D6：摘要模板',
    ),
    exercise(
      'w8d6-5',
      ['综合变式'],
      ['summary-input-contract', 'source-record-normalization', 'metric-snapshot-assembly', 'text-template-assembly', 'repeatable-run-command', 'evidence-limit-boundary', 'fallback-on-schema-mismatch', 'daily-summary-script'],
      '如果同一脚本今天处理 JSON，明天处理 CSV，最应该保持不变的是什么？',
      ['输入契约、清洗规则和证据边界', '文件扩展名', '摘要标题颜色'],
      0,
      '真正稳定的是输入契约、清洗规则和证据边界；文件格式只是一种承载方式。',
      '补学 W8D6：跨格式稳定性',
    ),
  ],
  deliverable: {
    title: '自动摘要脚本',
    conceptIds: ['summary-input-contract', 'source-record-normalization', 'metric-snapshot-assembly', 'text-template-assembly', 'repeatable-run-command', 'evidence-limit-boundary', 'fallback-on-schema-mismatch', 'daily-summary-script'],
    purpose: '把输入契约、清洗规则、指标快照、文本模板、运行命令和证据边界放在同一份脚本说明里，形成可复核的自动摘要工具。',
    whenToUse: '当团队每天都要把一份脱敏业务源整理成相同结构的一页摘要时。',
    audience: '产品经理、数据同学和脚本维护者。',
    fields: [
      { name: 'script_id', meaning: '脚本的唯一标识，能对应到具体工具文件。', source: '脚本文件名和运行命令。' },
      { name: 'summary_id', meaning: '当天摘要草稿或输出文件的唯一标识。', source: '输出路径和日期参数。' },
      { name: 'input_source', meaning: '脚本读取的源数据位置和类型。', source: '输入契约与命令参数。' },
      { name: 'cleaning_rule', meaning: '哪些字段被归一化、跳过或降级。', source: '清洗逻辑与日志。' },
      { name: 'metric_snapshot', meaning: '当天统计出来的记录数、总额和异常数等快照。', source: '归一化后的记录和汇总结果。' },
      { name: 'summary_template', meaning: '摘要文本的固定结构和段落安排。', source: '模板内容和填充规则。' },
      { name: 'output_target', meaning: '摘要草稿写到哪里、文件叫什么。', source: '输出路径和文件名。' },
      { name: 'run_command', meaning: '脚本如何被重复执行。', source: '命令行或任务入口。' },
      { name: 'run_log', meaning: '本次运行留下的可追踪痕迹。', source: '控制台输出或日志文件。' },
      { name: 'evidence_limit', meaning: '能证明什么、不能证明什么。', source: '教学模拟边界说明。' },
      { name: 'can_prove', meaning: '脚本这次运行真正能证明的有限事实。', source: '运行结果和日志。' },
      { name: 'cannot_prove', meaning: '脚本这次运行不能证明的真实业务结论。', source: '证据边界说明。' },
      { name: 'next_step', meaning: '离开本课后下一步要进入的课程或验证。', source: '课程衔接。' },
    ],
    badExample: `# daily-summary-script.py
mode: 教学模拟
script_id: summary.py
input_source: any file
cleaning_rule: just clean it
metric_snapshot: looks good
summary_template: done
output_target: production report
run_command: python summary.py
run_log: executed
evidence_limit: none
can_prove: script ran
cannot_prove: data is correct
next_step: complete`,
    badReasons: [
      '没有把输入契约、清洗规则和统计快照分开。',
      '把脚本跑通写成了真实业务正确。',
      '没有保留教学模拟和不能证明的边界。',
    ],
    revisionSteps: [
      '把 input_source、cleaning_rule、metric_snapshot 和 summary_template 分开写。',
      '补上 run_command、run_log、evidence_limit、can_prove 和 cannot_prove。',
      '把 next_step 改成具体课程衔接，而不是“complete”。',
    ],
    goodExample: `# daily-summary-script.py
mode: 教学模拟
script_id: daily-summary-script.py
summary_id: daily-summary-2026-08-27.md
input_source: sample/daily_feed.csv
cleaning_rule: trim whitespace, normalize dates, skip rows with missing amount, log every fallback
metric_snapshot: row_count=24; valid_count=21; missing_amount=1; total_amount=12840; channel_delta=app:+3
summary_template: 固定分为输入、清洗、指标、提醒四段
output_target: summary/daily-summary-2026-08-27.md
run_command: python scripts/daily-summary-script.py --source sample/daily_feed.csv --out summary/daily-summary-2026-08-27.md
run_log: 教学模拟运行完成，跳过2条缺字段记录，输出已写入本地草稿
evidence_limit: 只能证明教学模拟样本的清洗、统计和文本拼装路径，不能证明真实业务口径或生产调度
can_prove: 同一输入和同一命令可重复得到同类摘要与日志
cannot_prove: 真实业务指标已经在生产上线且完全正确
next_step: W9D1`,
    guidedPrompts: [
      '先把脚本 ID、输入源和输出路径写出来，再谈摘要内容。',
      '清洗规则和指标快照必须分开记录，不能混成一句话。',
      '把教学模拟和不能证明的边界写清，避免把草稿当成生产结果。',
      '如果时间允许，再补一条重复运行的命令和日志。',
    ],
    blankTemplate: `# daily-summary-script.py
mode: 教学模拟
script_id: 
summary_id: 
input_source: 
cleaning_rule: 
metric_snapshot: 
summary_template: 
output_target: 
run_command: 
run_log: 
evidence_limit: 
can_prove: 
cannot_prove: 
next_step: `,
    standardTemplate: `# daily-summary-script.py
mode: 教学模拟
script_id: daily-summary-script.py
summary_id: daily-summary-2026-08-27.md
input_source: sample/daily_feed.csv
cleaning_rule: 
metric_snapshot: 
summary_template: 
output_target: summary/daily-summary-2026-08-27.md
run_command: python scripts/daily-summary-script.py --source sample/daily_feed.csv --out summary/daily-summary-2026-08-27.md
run_log: 教学模拟
evidence_limit: 只能证明教学模拟样本的路径，不能证明真实业务或生产调度
can_prove: 
cannot_prove: 
next_step: W9D1`,
    checklist: [
      '脚本 ID、摘要 ID、输入源和输出路径都已写出。',
      '清洗规则、指标快照和模板结构彼此分开。',
      'run_command、run_log 和 evidence_limit 都已经填写。',
      'can_prove 与 cannot_prove 都说明了边界。',
      'next_step 只指向 W9D1，而不是宣告本课完结。',
    ],
  },
  memory: {
    conceptIds: ['summary-input-contract', 'source-record-normalization', 'metric-snapshot-assembly', 'text-template-assembly', 'repeatable-run-command', 'evidence-limit-boundary', 'fallback-on-schema-mismatch', 'daily-summary-script'],
    anchors: [
      '先校验输入契约，再谈摘要结论。',
      '先清洗记录，再生成指标快照。',
      '模板负责结构，边界负责克制。',
      '重复运行看命令，真实上线看审批。',
    ],
    closedBookPrompt: '闭卷说明：把一份每日业务源变成自动摘要时，输入契约、清洗规则、指标快照、文本模板、运行命令和证据边界分别负责什么？再说出一个不能越界的地方。',
    microOperation: '拿一份五行的教学样本，把输入契约、清洗规则、指标快照、模板和证据边界各圈一遍。',
    unresolvedPrompt: '如果某一天源文件同时换了格式和字段名，脚本应该先停步还是先降级？为什么？',
    reviewStages: [
      { stage: 'D1', task: '回看输入契约和源记录清洗，确认字段缺口先于摘要结论。' },
      { stage: 'D3', task: '复述指标快照和文本模板怎样接力生成摘要。' },
      { stage: 'D7', task: '用一份新样本再跑一次重复运行命令与日志。' },
      { stage: 'D14', task: '对比两种格式变化，说明哪些分支会停步或降级。' },
      { stage: 'D30', task: '说出摘要脚本能证明什么，不能证明什么。' },
      { stage: 'D60', task: '说明 W8D6 与 W9D1 的边界：本地摘要脚本 vs 下一周主题。' },
    ],
  },
  nextLesson: {
    id: 'W9D1',
    title: '下一周的数据处理起点',
    bridge: 'W8D6 先把每日业务摘要脚本写成可复跑、可复核的本地工具；W9D1 再进入下一周的数据处理主题。',
  },
}

export function getW8D6(dayId: string): DailyCourse | undefined {
  return dayId === 'W8D6' ? w8d6 : undefined
}
