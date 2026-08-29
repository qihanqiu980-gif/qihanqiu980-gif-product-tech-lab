export interface SimulatorControl {
  key: string
  label: string
  min: number
  max: number
  step: number
  unit: string
  default: number
  help: string
}

export interface SimulatorMetric {
  label: string
  value: string
  tone: 'neutral' | 'good' | 'warn' | 'bad'
}

export interface SimulatorResult {
  metrics: SimulatorMetric[]
  verdict: string
  evidence: string
  chart: Array<{ label: string; value: number; max: number; tone: 'neutral' | 'good' | 'warn' | 'bad' }>
}

export interface LessonFramework {
  why: string
  caseTitle: string
  caseContext: string
  caseConflict: string
  caseEvidence: string[]
  simulator: {
    title: string
    purpose: string
    controls: SimulatorControl[]
  }
  remember: string[]
  next: string
}

export const completeLessonOrder = ['为什么学', '概念关系', '交互观察', '产品案例', '代码实验', '快速自测', '记忆清单', '下一步']

export const completeLessonSectionCount = completeLessonOrder.length

const round = (value: number, digits = 1) => Number(value.toFixed(digits))
const percent = (value: number, digits = 1) => `${round(value, digits)}%`

export const lessonFrameworks: Record<number, LessonFramework> = {
  1: {
    why: '需求评审、线上故障和排期讨论都依赖同一件事：你能否说清一次用户动作经过了哪些系统，以及每一层能提供什么证据。',
    caseTitle: '提交按钮一直转圈',
    caseContext: '用户点击提交后页面没有结果，群里同时出现“可能是前端”“接口超时”“数据库慢”三种猜测。',
    caseConflict: '产品经理需要先找到请求是否发出、是否返回、返回了什么，再决定拉谁排查。',
    caseEvidence: ['Network 中是否产生请求', '状态码与总耗时', '响应体与 request_id'],
    simulator: { title: '请求链路观察器', purpose: '运行请求并逐步查看用户点击、前端、API、后端、数据库和页面反馈。', controls: [] },
    remember: ['一次点击通常跨越前端、网络、接口、后端和数据库。', '页面现象只能说明用户看到了什么，不能直接证明根因。', 'Network 是产品经理定位链路问题的第一现场。', '状态码、响应体、耗时和 request_id 要一起看。', '先收集证据再判断责任层。'],
    next: '下一周把正常链路主动破坏，学习如何区分鉴权、权限、缓存和服务异常。',
  },
  2: {
    why: '研发最难处理的不是 Bug 多，而是信息不足。你需要把“页面坏了”转换为可复现、可定位、可验收的故障证据。',
    caseTitle: '同一页面出现四种失败',
    caseContext: '一个用户看到 401，另一个用户看到 403；运营说数据没更新，日志却出现 500。',
    caseConflict: '相似的用户抱怨可能来自完全不同的系统层，恢复动作也不同。',
    caseEvidence: ['环境、版本与发生时间', 'HTTP/业务错误码', '日志中的第一处明确异常'],
    simulator: { title: '故障注入观察器', purpose: '切换故障后比较页面现象、状态码、日志与恢复动作。', controls: [] },
    remember: ['401 是未认证，403 是已认证但无权限。', '缓存异常常表现为请求成功但数据陈旧。', '500 是服务端失败的结果，不等于数据库一定故障。', 'Bug 报告必须包含环境、步骤、预期、实际和证据。', '错误提示必须给用户恢复路径。'],
    next: '下一周开始用 SQL 把业务问题翻译成可执行的数据筛选。',
  },
  3: {
    why: '数据同学不会直接回答“昨天新人券效果怎么样”。产品经理必须先把时间、状态、金额和去重写成可执行条件。',
    caseTitle: '新人券使用量到底是多少',
    caseContext: '运营要一小时内拿到昨日数据，但支付跨零点、取消订单和重复支付记录混在一起。',
    caseConflict: '同一句业务问题，用不同时间边界和状态筛选会得到不同答案。',
    caseEvidence: ['SQL WHERE 条件', '边界样本', 'COUNT 与 COUNT DISTINCT 对账'],
    simulator: { title: 'SQL 条件与边界观察器', purpose: '调整查询窗口、已支付占比和去重强度，观察结果如何变化。', controls: [
      { key: 'hours', label: '查询窗口', min: 6, max: 48, step: 6, unit: '小时', default: 24, help: '窗口越大，覆盖订单越多，也更容易混入不属于“昨天”的记录。' },
      { key: 'paidRate', label: '已支付记录', min: 40, max: 100, step: 5, unit: '%', default: 78, help: '对应 WHERE status = paid 的筛选结果。' },
      { key: 'duplicateRate', label: '重复用户', min: 0, max: 35, step: 5, unit: '%', default: 15, help: '决定 COUNT(*) 与 COUNT(DISTINCT user_id) 的差距。' },
      { key: 'boundaryLoss', label: '边界遗漏', min: 0, max: 20, step: 2, unit: '%', default: 6, help: '错误的时区或闭区间会遗漏或重复计算边界记录。' },
    ] },
    remember: ['先定义一行代表什么，再写 SELECT。', 'WHERE 是业务口径，不只是语法。', '时间范围应明确时区并优先使用左闭右开。', 'COUNT(*) 和 COUNT DISTINCT 回答不同问题。', '查询结果只能支持口径覆盖范围内的结论。'],
    next: '下一周在查询基础上定义指标的分子、分母、窗口和护栏。',
  },
  4: {
    why: '“转化率上涨”并不是一个完整结论。没有分子、分母、去重和时间窗口，指标无法复现，也无法用于决策。',
    caseTitle: '三个团队算出三种支付转化率',
    caseContext: '产品、运营和数据分别使用访问、结算、下单作为分母，结果相差 11 个百分点。',
    caseConflict: '指标名字相同但口径不同，任何趋势比较都会失真。',
    caseEvidence: ['指标口径表', '分母覆盖量', '异常大单和护栏指标'],
    simulator: { title: '指标口径观察器', purpose: '调整分子、分母、去重和归因窗口，观察指标如何被口径改变。', controls: [
      { key: 'numerator', label: '完成支付人数', min: 120, max: 900, step: 20, unit: '人', default: 420, help: '分子必须对应可唯一识别的完成行为。' },
      { key: 'denominator', label: '进入结算人数', min: 500, max: 1800, step: 50, unit: '人', default: 1200, help: '分母决定指标覆盖哪一段用户旅程。' },
      { key: 'duplicateRate', label: '重复用户', min: 0, max: 30, step: 5, unit: '%', default: 10, help: '没有去重会同时放大分子和分母，但比例不一定等幅变化。' },
      { key: 'windowBoost', label: '延长窗口新增转化', min: 0, max: 25, step: 1, unit: '%', default: 8, help: '自然日、24小时和7天窗口会纳入不同转化。' },
    ] },
    remember: ['指标必须服务一个明确决策。', '完整口径至少包含分子、分母、去重、时间和排除规则。', '样本量和分母变化可能制造“上涨”。', '均值要与分布和异常值一起看。', '主指标必须配护栏指标。'],
    next: '下一周连接多张表，学习如何避免 JOIN 让指标被重复放大。',
  },
  5: {
    why: '产品经理常需要把用户、行为和订单拼在一起。JOIN 写得能运行不代表结论可信，粒度错一次就会放大整份报告。',
    caseTitle: 'GMV 被 JOIN 放大 2.7 倍',
    caseContext: '订单表连接订单明细后，每个订单被商品行重复，财务金额因此异常。',
    caseConflict: '问题不是 SUM 函数，而是金额字段和连接后行粒度不一致。',
    caseEvidence: ['连接前后行数', '唯一订单数', '金额基线和未匹配样本'],
    simulator: { title: 'JOIN 粒度放大观察器', purpose: '调整订单数、每单明细数、未匹配率和预聚合开关，观察错误 GMV。', controls: [
      { key: 'orders', label: '支付订单', min: 100, max: 1500, step: 100, unit: '单', default: 800, help: '订单表的一行应代表一笔订单。' },
      { key: 'itemsPerOrder', label: '平均商品行', min: 1, max: 5, step: 0.5, unit: '行/单', default: 2.5, help: '一对多连接会让订单字段随商品行重复。' },
      { key: 'unmatchedRate', label: '未匹配订单', min: 0, max: 20, step: 2, unit: '%', default: 4, help: 'INNER JOIN 会丢掉未匹配订单，LEFT JOIN 会保留。' },
      { key: 'preAggregate', label: '连接前预聚合', min: 0, max: 1, step: 1, unit: '', default: 0, help: '设为 1 表示先把明细聚合回订单粒度。' },
    ] },
    remember: ['JOIN 前先写清每张表一行的含义。', '连接键是否唯一决定关系是一对一还是一对多。', '每增加一次 JOIN 都要重新对账。', '订单金额不能直接在明细粒度重复求和。', '未匹配记录也是重要业务证据。'],
    next: '下一周把需求翻译为接口的输入、输出、错误与兼容契约。',
  },
  6: {
    why: '接口文档是产品、前端和后端共享的行为契约。字段边界和错误语义没写清，开发完成后也无法判断是否符合需求。',
    caseTitle: '“新增会员标签接口”无法开工',
    caseContext: '需求只写了创建标签，但没有长度、空值、枚举、重复名、鉴权和错误提示。',
    caseConflict: '每个团队都会按自己的默认理解实现，最终在联调阶段集中返工。',
    caseEvidence: ['请求/响应 JSON', 'HTTP 状态与业务 code', '字段级错误和 request_id'],
    simulator: { title: 'API 契约观察器', purpose: '调整字段长度、空字段、鉴权和重复请求，观察接口语义与恢复动作。', controls: [
      { key: 'nameLength', label: '标签名称长度', min: 0, max: 40, step: 1, unit: '字', default: 6, help: '0 表示空字符串，超过 20 触发长度边界。' },
      { key: 'missingFields', label: '缺失必填字段', min: 0, max: 3, step: 1, unit: '个', default: 0, help: '字段缺失与显式 null 需要分别定义。' },
      { key: 'auth', label: '鉴权状态', min: 0, max: 2, step: 1, unit: '', default: 2, help: '0 未登录，1 无权限，2 已授权。' },
      { key: 'duplicate', label: '重复提交', min: 0, max: 1, step: 1, unit: '', default: 0, help: '测试同名资源或相同幂等键的处理。' },
    ] },
    remember: ['URL 和 Method 表达资源与动作。', '字段契约必须定义类型、必填、默认、边界和示例。', 'null、空字符串和缺失字段不等价。', 'HTTP 状态与业务错误要能稳定映射恢复动作。', '接口变更必须考虑旧客户端兼容。'],
    next: '下一周进一步处理重复提交、并发修改、分页和限流。',
  },
  7: {
    why: '正常路径只证明“能用”，异常与并发才决定“能不能上线”。产品经理要把权限、重复提交和冲突恢复写进需求。',
    caseTitle: '网络重试产生两笔订单',
    caseContext: '客户端超时后自动重试，服务端第一次其实已经成功；同时运营编辑活动时又发生覆盖。',
    caseConflict: '前端防抖无法覆盖网络重试，并发冲突也不能静默以最后写入者为准。',
    caseEvidence: ['幂等键与业务订单数', '版本号与 409', '429 Retry-After 和重试次数'],
    simulator: { title: '幂等、并发与限流观察器', purpose: '调整重试次数、幂等保护、并发编辑和限流，观察业务副作用。', controls: [
      { key: 'retries', label: '客户端重试', min: 0, max: 6, step: 1, unit: '次', default: 3, help: '网络抖动时客户端可能自动重试。' },
      { key: 'idempotency', label: '后端幂等保护', min: 0, max: 1, step: 1, unit: '', default: 1, help: '设为 1 时同一业务操作只产生一个结果。' },
      { key: 'editors', label: '同时编辑人数', min: 1, max: 5, step: 1, unit: '人', default: 2, help: '无版本校验时后提交者可能覆盖他人修改。' },
      { key: 'rateLimit', label: '限流阈值', min: 1, max: 10, step: 1, unit: '请求', default: 5, help: '阈值过低影响可用性，过高可能放大重试风暴。' },
    ] },
    remember: ['防抖不等于业务幂等。', '幂等保证重复请求产生同一业务结果。', '409 应保留用户输入并提供合并或刷新路径。', '429 后应遵循 Retry-After 并限制重试次数。', '验收矩阵要覆盖正常、边界、异常、权限和并发。'],
    next: '下一周开始用 Python 把重复的数据处理工作变成可运行工具。',
  },
  8: {
    why: '产品经理不需要成为 Python 工程师，但应能读懂、修改和运行小脚本，把重复的数据整理变成可复现流程。',
    caseTitle: '每天手工生成渠道摘要',
    caseContext: '同一份 CSV 每天都要筛选支付订单、按渠道汇总并写摘要，人工复制容易漏行和改错口径。',
    caseConflict: '自动化只有在输入、异常和输出都可控时才比手工更可靠。',
    caseEvidence: ['脚本输入与参数', 'Traceback/异常数量', '重复运行的一致输出'],
    simulator: { title: 'Python 执行流观察器', purpose: '调整数据量、异常率、严格模式和重复运行次数，观察处理结果。', controls: [
      { key: 'rows', label: '输入记录', min: 50, max: 2000, step: 50, unit: '行', default: 600, help: '输入规模影响处理量，但不是代码正确性的证据。' },
      { key: 'invalidRate', label: '异常记录', min: 0, max: 30, step: 2, unit: '%', default: 8, help: '模拟缺字段、数字字符串或非法状态。' },
      { key: 'strictMode', label: '严格模式', min: 0, max: 1, step: 1, unit: '', default: 0, help: '严格模式遇到第一条异常就停止；宽容模式记录后继续。' },
      { key: 'runs', label: '重复运行', min: 1, max: 5, step: 1, unit: '次', default: 2, help: '检查脚本是否会重复追加输出或产生副作用。' },
    ] },
    remember: ['变量保存值，类型决定可执行的操作。', '条件和循环表达重复业务规则。', '函数让输入、处理和输出可以单独验证。', '读 Traceback 先看最后一行，再找自己的代码位置。', '自动化脚本必须可重复运行并清楚报告异常。'],
    next: '下一周用 pandas 将清洗规则做成可审计的数据管道。',
  },
  9: {
    why: '“删掉脏数据”会让问题消失在报表里，也让结果无法审计。可靠清洗必须保留原始数据、规则和隔离记录。',
    caseTitle: '订单脏数据该删还是留',
    caseContext: 'CSV 中同时有空用户、重复订单、负数金额、非法状态和字符串数字。',
    caseConflict: '一些问题可以自动修复，另一些必须隔离等待业务判断。',
    caseEvidence: ['原始=清洁+隔离对账', '规则命中数量', '行 ID、原值和规则版本'],
    simulator: { title: '数据清洗规则观察器', purpose: '调整问题率、自动修复率和直接删除率，观察审计性与数据损失。', controls: [
      { key: 'rows', label: '原始数据', min: 200, max: 3000, step: 100, unit: '行', default: 1000, help: '所有后续结果都应能与原始行数对账。' },
      { key: 'issueRate', label: '问题记录', min: 0, max: 40, step: 2, unit: '%', default: 18, help: '同一行可能命中多条规则，这里按问题行估算。' },
      { key: 'autoFixRate', label: '可自动修复', min: 0, max: 100, step: 5, unit: '%', default: 45, help: '例如安全的类型转换；不确定业务含义的记录不应自动修复。' },
      { key: 'deleteRate', label: '直接删除问题行', min: 0, max: 100, step: 5, unit: '%', default: 0, help: '删除会造成不可追溯的数据损失。' },
    ] },
    remember: ['原始数据不可覆盖。', '先标记问题，再决定修复、隔离或保留。', '0 不等于未知，不能把所有空值填 0。', '清洗前后必须能按行数和业务键对账。', '规则、原值和受影响记录必须可追溯。'],
    next: '下一周把可靠数据用于漏斗、留存和 A/B 实验决策。',
  },
  10: {
    why: 'A/B 实验不是比较两个绿色百分比。必须先证明分流、埋点和样本健康，再结合效果量、护栏和成本做决策。',
    caseTitle: '转化上涨但实验不可信',
    caseContext: '新版支付转化率上涨，但 A/B 人数是 45:55，投诉率也明显增加。',
    caseConflict: '显著结果可能来自分流异常、埋点缺失或提前停止，主指标也可能与用户体验冲突。',
    caseEvidence: ['样本比例与 SRM', '主指标效应量和区间', '投诉、退款、延迟等护栏'],
    simulator: { title: '实验健康与决策观察器', purpose: '调整分流、埋点缺失、转化提升、投诉变化和样本量，观察实验决策。', controls: [
      { key: 'groupA', label: 'A 组占比', min: 35, max: 65, step: 1, unit: '%', default: 45, help: '预期 50:50；偏差过大时先检查 SRM。' },
      { key: 'missingRate', label: '埋点缺失', min: 0, max: 20, step: 1, unit: '%', default: 6, help: '两组缺失不一致会直接污染结果。' },
      { key: 'lift', label: '支付转化提升', min: -5, max: 12, step: 0.5, unit: 'pp', default: 3, help: '百分点变化需与最小可接受效果比较。' },
      { key: 'complaintLift', label: '投诉率变化', min: -1, max: 5, step: 0.25, unit: 'pp', default: 1.5, help: '护栏恶化可能否决主指标收益。' },
      { key: 'sample', label: '有效样本', min: 500, max: 20000, step: 500, unit: '人', default: 4000, help: '样本越小，不确定性越大。' },
    ] },
    remember: ['先验证埋点和分流，再读实验效果。', 'SRM 表示样本比例异常，需要暂停结论。', '显著不等于效果足够大或值得上线。', '主指标与护栏冲突时按预先规则决策。', '样本、周期和停止规则必须事先定义。'],
    next: '下一周把同样的可复现评测思想用于 AI 产品。',
  },
  11: {
    why: 'AI 演示表现好不代表真实产品可靠。产品经理需要把事实性、安全、任务完成、延迟和成本拆成可回归的评测标准。',
    caseTitle: 'AI 客服编造退款规则',
    caseContext: '正常问题回答流畅，但知识缺失时编造政策，遇到他人订单也没有稳定拒答。',
    caseConflict: '平均分不错不能掩盖安全类失败，模型升级还可能让旧问题回归。',
    caseEvidence: ['固定评测样本', 'must_include/must_not_include', '失败根因和人工兜底'],
    simulator: { title: 'AI 评测与上线门槛观察器', purpose: '调整事实、任务、安全、延迟和高风险样本占比，观察是否满足上线门槛。', controls: [
      { key: 'factual', label: '事实正确率', min: 50, max: 100, step: 2, unit: '%', default: 86, help: '有引用不代表内容必然正确，需核对事实。' },
      { key: 'task', label: '任务完成率', min: 40, max: 100, step: 2, unit: '%', default: 82, help: '回答正确但没有完成用户任务仍是失败。' },
      { key: 'safety', label: '安全通过率', min: 70, max: 100, step: 1, unit: '%', default: 96, help: '隐私、越权和提示注入应设置更严格门槛。' },
      { key: 'latency', label: 'P95 延迟', min: 1, max: 15, step: 0.5, unit: '秒', default: 6, help: '延迟影响用户等待、超时和人工接管。' },
      { key: 'highRisk', label: '高风险样本', min: 5, max: 40, step: 5, unit: '%', default: 20, help: '样本分布需要覆盖真实任务和高风险长尾。' },
    ] },
    remember: ['AI 功能是模型、上下文、检索、工具和业务规则的系统。', 'RAG 降低知识缺失，不保证消除幻觉。', '评测集要覆盖正常、边界、对抗、隐私和兜底。', '安全失败不能被平均分抵消。', '模型、Prompt、知识库或工具变化后都要回归。'],
    next: '最后一周把需求、系统、数据、实验、AI 评测和风险串成作品集。',
  },
  12: {
    why: '作品集的价值不在页面数量，而在能否证明你如何定义问题、验证未知、做出取舍并诚实表达限制。',
    caseTitle: '10 分钟讲清一个技术产品项目',
    caseContext: '面试官不仅看最终原型，还会追问数据来源、技术边界、失败预案和你亲自完成的验证。',
    caseConflict: '功能列表很完整，但没有证据链和可复现实验时，无法证明产品判断能力。',
    caseEvidence: ['问题证据和非目标', '系统/数据/状态方案', '运行记录、风险登记和复盘'],
    simulator: { title: '作品集证据完整度观察器', purpose: '调整问题证据、技术方案、运行验证、风险与复盘的完整度，观察展示准备度。', controls: [
      { key: 'problem', label: '问题证据', min: 0, max: 100, step: 10, unit: '%', default: 70, help: '访谈、工单、行为数据或流程耗时是否能证明问题。' },
      { key: 'system', label: '系统与数据方案', min: 0, max: 100, step: 10, unit: '%', default: 60, help: '是否覆盖链路、接口、数据、状态和责任边界。' },
      { key: 'validation', label: '可运行验证', min: 0, max: 100, step: 10, unit: '%', default: 50, help: 'SQL、Python、接口或 AI 评测是否可复现。' },
      { key: 'risk', label: '风险与兜底', min: 0, max: 100, step: 10, unit: '%', default: 40, help: '高风险项是否有预防、监控和恢复。' },
      { key: 'reflection', label: '结果与反思', min: 0, max: 100, step: 10, unit: '%', default: 50, help: '是否区分事实、推测、限制和下一步。' },
    ] },
    remember: ['先证明问题值得解决，再展示方案。', '目标、非目标和约束决定技术取舍。', '至少一个关键结论要有可运行验证。', '事实、推测和待验证必须明确区分。', '优秀作品集展示决策过程、风险与反思。'],
    next: '完成后回到真实工作：选择一个脱敏功能，用同一框架重新做需求评审、数据验证和复盘。',
  },
}

export function evaluateSimulator(week: number, values: Record<string, number>): SimulatorResult {
  const v = (key: string) => values[key] ?? 0

  if (week === 3) {
    const raw = Math.round(1200 * v('hours') / 24)
    const paid = raw * v('paidRate') / 100
    const boundary = paid * v('boundaryLoss') / 100
    const rows = Math.max(0, Math.round(paid - boundary))
    const users = Math.round(rows * (1 - v('duplicateRate') / 100))
    const amount = Math.round(rows * 86)
    const risk = v('boundaryLoss') >= 10 || v('duplicateRate') >= 25
    return { metrics: [{ label: '返回订单', value: `${rows} 行`, tone: 'neutral' }, { label: '去重用户', value: `${users} 人`, tone: risk ? 'warn' : 'good' }, { label: '支付金额', value: `¥${amount.toLocaleString('zh-CN')}`, tone: 'neutral' }], verdict: risk ? '先修正时间边界和去重口径，再回答业务问题。' : '口径基本稳定，可以继续抽样核对边界记录。', evidence: `COUNT(*) 与去重用户相差 ${rows - users}；边界条件影响约 ${Math.round(boundary)} 行。`, chart: [{ label: '原始', value: raw, max: raw, tone: 'neutral' }, { label: '支付', value: Math.round(paid), max: raw, tone: 'good' }, { label: '最终', value: rows, max: raw, tone: risk ? 'warn' : 'good' }] }
  }
  if (week === 4) {
    const numerator = v('numerator') * (1 + v('windowBoost') / 100)
    const denominator = Math.max(v('denominator'), numerator)
    const rawRate = numerator / denominator * 100
    const dedupRate = numerator * (1 - v('duplicateRate') / 100) / (denominator * (1 - v('duplicateRate') * .55 / 100)) * 100
    const unstable = denominator < 700 || v('duplicateRate') > 20
    return { metrics: [{ label: '未去重转化率', value: percent(rawRate), tone: 'neutral' }, { label: '去重后转化率', value: percent(dedupRate), tone: unstable ? 'warn' : 'good' }, { label: '口径差异', value: `${round(Math.abs(rawRate - dedupRate), 1)} pp`, tone: unstable ? 'bad' : 'neutral' }], verdict: unstable ? '当前指标容易被重复用户或小分母误读，不能直接用于上线决策。' : '指标可复现，但仍需同时检查护栏与用户结构。', evidence: `窗口带来约 ${Math.round(v('numerator') * v('windowBoost') / 100)} 个新增转化；去重改变了分子与分母。`, chart: [{ label: '未去重', value: rawRate, max: 100, tone: 'neutral' }, { label: '去重后', value: dedupRate, max: 100, tone: unstable ? 'warn' : 'good' }] }
  }
  if (week === 5) {
    const avg = 128
    const correctGmv = v('orders') * avg
    const factor = v('preAggregate') ? 1 : v('itemsPerOrder')
    const wrongGmv = correctGmv * factor * (1 - v('unmatchedRate') / 100)
    const joinedRows = Math.round(v('orders') * factor)
    const bad = factor > 1.05
    return { metrics: [{ label: 'JOIN 后行数', value: `${joinedRows} 行`, tone: bad ? 'warn' : 'good' }, { label: '正确 GMV', value: `¥${correctGmv.toLocaleString('zh-CN')}`, tone: 'good' }, { label: '直接 SUM', value: `¥${Math.round(wrongGmv).toLocaleString('zh-CN')}`, tone: bad ? 'bad' : 'good' }], verdict: bad ? `金额被放大约 ${round(wrongGmv / Math.max(correctGmv, 1), 2)} 倍；应先聚合到订单粒度。` : '连接前已回到订单粒度，金额与订单基线基本一致。', evidence: `唯一订单仍约 ${Math.round(v('orders') * (1 - v('unmatchedRate') / 100))}，但连接行数为 ${joinedRows}。`, chart: [{ label: '订单基线', value: correctGmv, max: Math.max(correctGmv, wrongGmv), tone: 'good' }, { label: '直接求和', value: wrongGmv, max: Math.max(correctGmv, wrongGmv), tone: bad ? 'bad' : 'good' }] }
  }
  if (week === 6) {
    let status = 201; let code = 'TAG_CREATED'; let tone: SimulatorMetric['tone'] = 'good'; let verdict = '请求满足契约，可创建资源。'
    if (v('auth') === 0) { status = 401; code = 'UNAUTHENTICATED'; tone = 'bad'; verdict = '先完成登录或刷新凭证，再重试。' }
    else if (v('auth') === 1) { status = 403; code = 'FORBIDDEN'; tone = 'bad'; verdict = '当前身份无权创建标签，应隐藏入口并说明申请路径。' }
    else if (v('missingFields') > 0 || v('nameLength') === 0 || v('nameLength') > 20) { status = 422; code = 'FIELD_INVALID'; tone = 'warn'; verdict = '字段校验失败，应返回具体字段、规则和修正建议。' }
    else if (v('duplicate')) { status = 409; code = 'TAG_ALREADY_EXISTS'; tone = 'warn'; verdict = '资源冲突，应返回已有资源或让用户修改名称。' }
    return { metrics: [{ label: 'HTTP Status', value: String(status), tone }, { label: '业务 code', value: code, tone }, { label: '名称长度', value: `${v('nameLength')} 字`, tone: v('nameLength') > 20 ? 'bad' : 'neutral' }], verdict, evidence: `缺失字段 ${v('missingFields')} 个；鉴权状态 ${['未登录', '无权限', '已授权'][v('auth')] || '未知'}。`, chart: [{ label: '身份', value: v('auth'), max: 2, tone: v('auth') === 2 ? 'good' : 'bad' }, { label: '字段完整', value: Math.max(0, 3 - v('missingFields')), max: 3, tone: v('missingFields') ? 'warn' : 'good' }, { label: '名称边界', value: Math.min(v('nameLength'), 20), max: 20, tone: v('nameLength') > 20 || v('nameLength') === 0 ? 'bad' : 'good' }] }
  }
  if (week === 7) {
    const orders = v('idempotency') ? 1 : 1 + v('retries')
    const conflicts = Math.max(0, v('editors') - 1)
    const excess = Math.max(0, v('retries') + 1 - v('rateLimit'))
    const unsafe = orders > 1 || conflicts > 0 || excess > 2
    return { metrics: [{ label: '产生订单', value: `${orders} 笔`, tone: orders > 1 ? 'bad' : 'good' }, { label: '潜在冲突', value: `${conflicts} 次`, tone: conflicts ? 'warn' : 'good' }, { label: '被限流请求', value: `${excess} 个`, tone: excess > 2 ? 'bad' : 'neutral' }], verdict: unsafe ? '当前异常路径会产生副作用或覆盖风险，需要幂等、版本校验和有限重试。' : '重复请求被收敛为一个业务结果，异常恢复路径可控。', evidence: `共发送 ${v('retries') + 1} 次；后端幂等${v('idempotency') ? '已开启' : '未开启'}。`, chart: [{ label: '请求次数', value: v('retries') + 1, max: 7, tone: 'neutral' }, { label: '业务订单', value: orders, max: 7, tone: orders > 1 ? 'bad' : 'good' }, { label: '编辑冲突', value: conflicts, max: 4, tone: conflicts ? 'warn' : 'good' }] }
  }
  if (week === 8) {
    const invalid = Math.round(v('rows') * v('invalidRate') / 100)
    const processed = v('strictMode') && invalid ? Math.max(0, Math.round(v('rows') / (invalid + 1)) - 1) : v('rows') - invalid
    const duplicates = v('runs') > 1 ? (v('runs') - 1) * processed : 0
    const bad = Boolean(v('strictMode') && invalid) || duplicates > processed
    return { metrics: [{ label: '成功处理', value: `${processed} 行`, tone: bad ? 'warn' : 'good' }, { label: '异常记录', value: `${invalid} 行`, tone: invalid ? 'warn' : 'good' }, { label: '重复追加风险', value: `${duplicates} 行`, tone: duplicates ? 'bad' : 'good' }], verdict: bad ? '脚本会因异常提前停止或重复写入；需要逐行校验和幂等输出。' : '脚本能记录异常后继续，并保持重复运行结果一致。', evidence: `运行 ${v('runs')} 次，输入异常率 ${v('invalidRate')}%。`, chart: [{ label: '输入', value: v('rows'), max: v('rows'), tone: 'neutral' }, { label: '处理', value: processed, max: v('rows'), tone: bad ? 'warn' : 'good' }, { label: '异常', value: invalid, max: v('rows'), tone: invalid ? 'warn' : 'good' }] }
  }
  if (week === 9) {
    const issues = Math.round(v('rows') * v('issueRate') / 100)
    const fixed = Math.round(issues * v('autoFixRate') / 100)
    const remaining = issues - fixed
    const deleted = Math.round(remaining * v('deleteRate') / 100)
    const quarantine = remaining - deleted
    const clean = v('rows') - issues + fixed
    const bad = deleted > 0
    return { metrics: [{ label: 'Clean', value: `${clean} 行`, tone: 'good' }, { label: 'Quarantine', value: `${quarantine} 行`, tone: quarantine ? 'warn' : 'good' }, { label: '不可追溯删除', value: `${deleted} 行`, tone: bad ? 'bad' : 'good' }], verdict: bad ? '原始行无法通过 clean + quarantine 对账，审计链已经断裂。' : '原始数据可由 clean 与 quarantine 完整解释，规则结果可审计。', evidence: `问题行 ${issues}，自动修复 ${fixed}，保留隔离 ${quarantine}。`, chart: [{ label: 'Clean', value: clean, max: v('rows'), tone: 'good' }, { label: '隔离', value: quarantine, max: v('rows'), tone: 'warn' }, { label: '删除', value: deleted, max: v('rows'), tone: bad ? 'bad' : 'neutral' }] }
  }
  if (week === 10) {
    const splitGap = Math.abs(v('groupA') - 50)
    const srm = splitGap >= 4
    const effectiveSample = Math.round(v('sample') * (1 - v('missingRate') / 100))
    const uncertainty = 100 / Math.sqrt(Math.max(effectiveSample, 1))
    const enough = effectiveSample >= 5000 && Math.abs(v('lift')) > uncertainty
    const guardrailBad = v('complaintLift') >= 1
    const decision = srm ? '暂停结论，先定位分流或入组异常。' : v('missingRate') > 8 ? '重做埋点对账，当前数据不能支持实验判断。' : guardrailBad ? '主指标与投诉护栏冲突，不应直接全量。' : enough && v('lift') >= 2 ? '满足样本与效果阈值，可进入灰度放量评审。' : '继续实验，当前证据不足以全量。'
    const tone: SimulatorMetric['tone'] = srm || guardrailBad ? 'bad' : enough ? 'good' : 'warn'
    return { metrics: [{ label: 'SRM 风险', value: srm ? '高' : '低', tone: srm ? 'bad' : 'good' }, { label: '有效样本', value: effectiveSample.toLocaleString('zh-CN'), tone: effectiveSample >= 5000 ? 'good' : 'warn' }, { label: '主指标提升', value: `${v('lift')} pp`, tone: v('lift') >= 2 ? 'good' : 'neutral' }, { label: '投诉变化', value: `${v('complaintLift')} pp`, tone: guardrailBad ? 'bad' : 'good' }], verdict: decision, evidence: `A:B=${v('groupA')}:${100 - v('groupA')}；估算不确定性约 ±${round(uncertainty, 2)} pp。`, chart: [{ label: 'A组', value: v('groupA'), max: 100, tone: srm ? 'warn' : 'good' }, { label: 'B组', value: 100 - v('groupA'), max: 100, tone: srm ? 'warn' : 'good' }, { label: '有效样本率', value: 100 - v('missingRate'), max: 100, tone: v('missingRate') > 8 ? 'bad' : 'good' }] }
  }
  if (week === 11) {
    const weighted = v('factual') * .3 + v('task') * .25 + v('safety') * .35 + Math.max(0, 100 - v('latency') * 5) * .1
    const safetyGate = v('safety') >= 99
    const riskCoverage = v('highRisk') >= 20
    const pass = weighted >= 85 && safetyGate && riskCoverage && v('latency') <= 8
    return { metrics: [{ label: '综合通过率', value: percent(weighted), tone: pass ? 'good' : 'warn' }, { label: '安全门槛', value: safetyGate ? '通过' : '未通过', tone: safetyGate ? 'good' : 'bad' }, { label: 'P95 延迟', value: `${v('latency')} 秒`, tone: v('latency') <= 8 ? 'good' : 'bad' }, { label: '高风险覆盖', value: `${v('highRisk')}%`, tone: riskCoverage ? 'good' : 'warn' }], verdict: pass ? '达到当前上线门槛，仍应灰度并保留人工接管。' : '不能上线：安全、样本覆盖或延迟门槛至少一项未满足。', evidence: '安全门槛是硬约束，不能被事实性或表达分数的平均值抵消。', chart: [{ label: '事实', value: v('factual'), max: 100, tone: v('factual') >= 90 ? 'good' : 'warn' }, { label: '任务', value: v('task'), max: 100, tone: v('task') >= 85 ? 'good' : 'warn' }, { label: '安全', value: v('safety'), max: 100, tone: safetyGate ? 'good' : 'bad' }] }
  }
  if (week === 12) {
    const scores = ['problem', 'system', 'validation', 'risk', 'reflection'].map(v)
    const total = scores.reduce((sum, score) => sum + score, 0) / scores.length
    const weakest = Math.min(...scores)
    const ready = total >= 75 && weakest >= 50 && v('validation') >= 70
    return { metrics: [{ label: '证据完整度', value: percent(total, 0), tone: ready ? 'good' : 'warn' }, { label: '最低维度', value: `${weakest}%`, tone: weakest >= 50 ? 'good' : 'bad' }, { label: '可复现验证', value: `${v('validation')}%`, tone: v('validation') >= 70 ? 'good' : 'warn' }], verdict: ready ? '已经具备 10 分钟展示条件，接下来重点练习追问与限制说明。' : '暂不适合定稿；优先补最低维度和一项可运行验证。', evidence: `五个维度平均 ${round(total, 0)}%，但展示准备度受最弱证据链约束。`, chart: [{ label: '问题', value: v('problem'), max: 100, tone: 'neutral' }, { label: '方案', value: v('system'), max: 100, tone: 'neutral' }, { label: '验证', value: v('validation'), max: 100, tone: v('validation') >= 70 ? 'good' : 'warn' }, { label: '风险', value: v('risk'), max: 100, tone: v('risk') >= 60 ? 'good' : 'warn' }, { label: '反思', value: v('reflection'), max: 100, tone: 'neutral' }] }
  }
  return { metrics: [], verdict: '', evidence: '', chart: [] }
}
