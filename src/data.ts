import { extendedQuizQuestions } from './extendedQuiz'
import { advancedQuizQuestions } from './advancedQuiz'

export type WeekStatus = 'available' | 'planned'

export interface WeekDefinition {
  id: number
  dates: string
  title: string
  focus: string
  experiment: string
  output: string
  weight: '研发沟通' | '数据分析' | '需求评审'
  status: WeekStatus
  concepts: string[]
  outcomes: string[]
  lessons: LessonUnit[]
  challenges: string[]
  assessment: string[]
}

export type LessonKind = '理解' | '读图' | '实验' | '诊断' | '评审' | '迁移'

export interface LessonUnit {
  day: string
  kind: LessonKind
  title: string
  detail: string
  minutes: number
  deliverable: string
  question: string
  rubric: string
  practice: Array<{ level: '术语与边界' | '机制推演' | '证据判读' | '场景应用' | '变式评审'; prompt: string }>
}

export interface GlossaryEntry {
  id: string
  term: string
  english: string
  plain: string
  analogy: string
  pmQuestion: string
  confusedWith?: string
  week: number
}

export interface QuizQuestion {
  id: string
  week: number
  conceptId: string
  prompt: string
  options: string[]
  answer: number
  explanation: string
  level: '概念' | '判断' | '应用' | '评审'
}

function makeLessons(items: Array<[LessonKind, string, string, string]>): LessonUnit[] {
  const days = ['周一', '周二', '周三', '周四', '周五', '周六']
  const minutes = [35, 40, 45, 40, 45, 45]
  const questionLead: Record<LessonKind, string> = {
    理解: '不看笔记，用自己的话解释',
    读图: '不看示例，重新画出或标注',
    实验: '独立操作后，只依据你观察到的证据说明',
    诊断: '面对一个不同于示例的新故障，按“现象—假设—证据—下一步”判断',
    评审: '假设你正在主持需求评审，列出必须确认的正常、边界与异常条件',
    迁移: '选择一个脱敏工作案例，把本课方法迁移过去并说明',
  }
  const rubric: Record<LessonKind, string> = {
    理解: '通过标准：定义准确；能区分职责边界；给出一个反例；说明对产品工作的意义。',
    读图: '通过标准：顺序完整；输入输出清楚；至少标出一条可观察证据和一个失败分支。',
    实验: '通过标准：记录操作步骤、结果、关键证据；能排除至少一个错误猜测；结果可复现。',
    诊断: '通过标准：不直接猜根因；至少提出两个假设；用证据排序；给出成本最低的下一步检查。',
    评审: '通过标准：覆盖正常、边界、异常、权限/数据与恢复路径；每一项都能转成验收条件。',
    迁移: '通过标准：案例已脱敏；写出已知与未知；提出研发追问；留下可进入作品集的成果。',
  }
  return items.map(([kind, title, detail, deliverable], index) => ({
    day: days[index], kind, title, detail, minutes: minutes[index], deliverable,
    question: `${questionLead[kind]}“${title}”。你的回答必须结合“${deliverable}”中的具体内容，不能只复述概念。`,
    rubric: rubric[kind],
    practice: [
      { level: '术语与边界', prompt: `不看笔记，用 3 句话说清“${title}”：它解决什么、关键边界是什么、它不是什么。` },
      { level: '机制推演', prompt: `从输入开始，按时间顺序推演“${title}”如何产生结果；至少写出 4 个中间步骤和 1 个分支。` },
      { level: '证据判读', prompt: `为“${title}”列出 3 条可观察证据，并分别说明每条证据能证明什么、不能证明什么。` },
      { level: '场景应用', prompt: `把“${title}”放入一个产品场景：写出前置条件、你会执行的动作，以及能证明结论的两条证据。` },
      { level: '变式评审', prompt: `假设“${deliverable}”中的结果与预期相反：提出至少两个竞争假设，给出成本最低的验证顺序，并补一条可验收的异常规则。` },
    ],
  }))
}

export const weeks: WeekDefinition[] = [
  { id: 1, dates: '8.17–8.23', title: '拆解一次真实请求', focus: '浏览器、DNS、前端、API、网关、后端、数据库与响应', experiment: '在 Network 中追踪请求并用证据判断故障位置', output: '功能技术链路图＋证据说明', weight: '研发沟通', status: 'available', concepts: ['frontend', 'backend', 'api', 'server', 'database'], outcomes: ['解释浏览器到数据库的完整请求链路', '用 Headers、Payload、Status、Timing 判断请求阶段', '区分页面未发请求、请求 Pending、接口报错和数据未落库'], lessons: makeLessons([
    ['理解', '系统分层与职责边界', '从用户动作开始，建立浏览器、网络、服务与数据的完整心智模型。', '六层职责对照表'],
    ['理解', 'URL、域名、DNS 与服务器寻址', '从完整 URL 出发，拆解协议、域名、端口、路径与查询，再跟踪域名如何经 DNS 变成可连接的服务器地址。', '寻址证据记录'],
    ['实验', '追踪一次订单预览请求', '预测请求路径，运行模拟请求，记录每个节点的可观察证据。', '请求观察记录'],
    ['理解', 'API、后端与数据库', '沿 HTTP → API → 后端业务处理 → 数据库读写 → Response，区分入口、规则、持久化和返回边界。', '请求处理链路说明'],
    ['实验', '使用 Network 读取请求证据', '逐字段观察请求条目、Name／URL、Method、Status、Type、Initiator、Headers、Payload、Response、Timing、Size 与缓存线索。', 'Network 观察记录'],
    ['迁移', '绘制一个工作功能链路', '用脱敏案例标出已知环节、未知环节和需要向研发确认的问题。', '功能技术链路图'],
  ]), challenges: ['点击后 Network 没有新请求，先查什么？', '接口 200 但页面空白，证据链如何继续？', '提交成功后刷新数据消失，可能在哪些环节？', '同一请求耗时突然从 200ms 变为 4s，如何分层追问？'], assessment: ['闭卷解释完整链路', '独立定位2个变式故障', '从工作案例提出5个有效研发追问', '小测至少8/10正确'] },
  { id: 2, dates: '8.24–8.30', title: '建立可复现的故障证据链', focus: '环境、版本、鉴权、权限、缓存、日志、发布、监控与回滚', experiment: '主动制造并定位 401、403、409、500 与缓存异常', output: '标准 Bug 报告＋发布验收清单', weight: '需求评审', status: 'available', concepts: ['environment', 'auth', 'cache', 'log', 'release'], outcomes: ['从现象收集环境、时间、账号、请求ID和日志证据', '区分身份失效、权限不足、重复提交、服务异常和缓存不一致', '把监控、灰度与回滚条件写入发布验收'], lessons: makeLessons([
    ['理解', '环境、配置与版本差异', '理解开发、测试、预发、生产，以及代码相同但配置不同为何仍会出错。', '环境差异矩阵'],
    ['读图', '状态码与错误链路', '把 401、403、404、409、429、500、502、504 还原成用户与系统行为。', '状态码处置图'],
    ['实验', '故障注入与日志关联', '切换故障，读取请求、错误码、request_id 与教学模拟日志。', '故障证据卡'],
    ['诊断', '缓存、并发与数据一致性', '判断旧数据、重复订单和延迟更新背后的边界。', '一致性诊断表'],
    ['评审', '发布、灰度、监控与回滚', '定义发布观察指标、异常阈值、灰度人群和回滚触发条件。', '发布验收清单'],
    ['迁移', '提交研发可立即使用的 Bug', '按事实完整、逻辑成立、边界覆盖、表达可执行四维自检。', '标准 Bug 报告'],
  ]), challenges: ['已登录却返回403，Bug里还缺哪些证据？', '新旧文案随机出现，怎样验证是否多级缓存？', '重复点击产生两笔订单，产品与研发分别补什么？', '发布后错误率上升但核心转化未降，应立即回滚吗？'], assessment: ['完成5类故障独立诊断', 'Bug报告七项信息完整', '解释灰度与回滚的决策依据', '小测至少8/10正确'] },
  { id: 3, dates: '8.31–9.6', title: '用 SQL 回答可验证的业务问题', focus: '数据表、字段类型、SELECT、WHERE、ORDER BY、CASE 与日期条件', experiment: '在订单数据集完成12道递进查询并解释结果', output: '业务查询集＋口径备注', weight: '数据分析', status: 'available', concepts: ['sql'], outcomes: ['把模糊业务问题翻译为字段、条件、时间和排序', '独立写出筛选、派生字段和日期查询', '识别空值、重复数据与时区带来的误判'], lessons: makeLessons([['理解','从业务问题到数据问题','认识表、行、列、主键、字段类型和数据字典。','问题拆解模板'],['读图','SELECT 的执行逻辑','理解 FROM、WHERE、SELECT、ORDER BY、LIMIT 的关系。','SQL执行顺序图'],['实验','用户与订单基础查询','完成筛选、排序、别名、去重和日期条件。','6道基础查询'],['诊断','为什么查询结果不可信','定位NULL、重复行、状态遗漏、时区和测试数据。','数据质量检查表'],['评审','向数据研发确认口径','写清数据源、刷新频率、权限、延迟和历史回溯。','取数需求单'],['迁移','回答一个真实业务问题','以脱敏问题独立写查询并解释不能下的结论。','12道业务查询集']]), challenges: ['退款订单是否计入GMV？','北京时间“昨天”如何避免时区错误？','用户表一人多行时如何去重？','查询为0到底是没有数据还是条件写错？'], assessment: ['完成12道SQL题', '至少3题不看提示独立写出', '为每个结果写限制条件', '阶段测验≥80%'] },
  { id: 4, dates: '9.7–9.13', title: '设计不会误导人的指标', focus: 'COUNT、SUM、AVG、GROUP BY、活跃、转化、客单价与指标口径', experiment: '计算核心指标并对比三种错误口径', output: '指标字典＋口径评审记录', weight: '数据分析', status: 'available', concepts: ['metric'], outcomes: ['写清指标分子、分母、时间、去重和排除规则', '用聚合与分组验证指标', '识别平均数、累计值与分母变化造成的误导'], lessons: makeLessons([['理解','指标不是一个数字','建立业务目标、行为信号、指标与决策的关系。','指标树'],['读图','聚合与分组','理解COUNT DISTINCT、SUM、AVG、GROUP BY和HAVING。','聚合逻辑图'],['实验','活跃、转化与客单价','用同一数据集计算三个指标并核对样本。','指标计算SQL'],['诊断','三种看似上涨的假象','分析分母变化、幸存者偏差和异常大单。','误导案例分析'],['评审','指标口径评审会','覆盖时区、去重键、状态、退款、数据延迟和版本。','指标口径表'],['迁移','给当前产品搭指标树','从北极星指标下钻到过程与护栏指标。','产品指标树']]), challenges: ['DAU用登录还是核心行为？','转化率分母选曝光还是点击？','客单价上涨为何可能是坏消息？','累计曲线为什么天然只会上升？'], assessment: ['独立定义3个指标', '用SQL复算并抽样核对', '识别3类误导', '口径表可交给研发落地'] },
  { id: 5, dates: '9.14–9.20', title: '连接数据并控制分析偏差', focus: 'INNER/LEFT JOIN、一对多、NULL、重复放大、抽样核对与结论边界', experiment: '连接用户、行为、订单三表并修复重复放大', output: '数据分析报告＋质量检查附件', weight: '数据分析', status: 'available', concepts: ['join'], outcomes: ['根据分析目的选择连接方式', '发现一对多造成的指标膨胀', '用抽样与对账证明数据结果可信'], lessons: makeLessons([['理解','连接键与数据粒度','理解一行代表什么，以及主键、外键和粒度不一致。','表关系图'],['读图','四种JOIN的保留规则','通过集合与业务例子理解匹配和未匹配记录。','JOIN对照图'],['实验','连接用户、行为与订单','从三张表构造完整用户旅程。','多表SQL'],['诊断','重复放大与数据缺口','用行数、去重计数和抽样查找错误。','质量诊断单'],['评审','分析结论的证据强度','区分相关、推测和因果，不从缺失数据过度推断。','结论分级表'],['迁移','完成小型数据分析','提出问题、取数、核验、可视化并给出有限结论。','数据分析报告']]), challenges: ['LEFT JOIN后WHERE右表字段为何像INNER JOIN？','订单明细导致GMV翻倍如何发现？','没有行为记录代表用户没操作吗？','两组差异能否直接证明功能有效？'], assessment: ['写出3种JOIN', '修复重复放大', '完成5条抽样核对', '结论明确标注限制'] },
  { id: 6, dates: '9.21–9.27', title: '把接口文档变成可执行验收', focus: 'HTTP、REST、JSON、Header、参数、认证、超时与接口调试', experiment: '构造 GET/POST/PATCH 请求并验证响应结构', output: '接口请求集合＋字段契约', weight: '需求评审', status: 'available', concepts: ['http', 'json'], outcomes: ['看懂接口文档的请求与响应结构', '构造带参数、Header和JSON Body的请求', '验证类型、必填、空值、兼容和错误返回'], lessons: makeLessons([['理解','HTTP与资源建模','理解方法、URL、资源、动作和无状态通信。','接口心智图'],['读图','请求与响应解剖','逐层读取Header、Query、Path、Body、Status与Response。','报文标注图'],['实验','构造三类接口请求','发送查询、创建和更新请求，比较不同参数位置。','请求集合'],['诊断','接口成功但功能失败','识别字段缺失、类型错误、超时、序列化和兼容问题。','接口诊断表'],['评审','字段契约与版本兼容','定义必填、默认、枚举、长度、空值和废弃策略。','字段契约'],['迁移','评审一份脱敏接口文档','列出歧义、异常和可测试条件。','接口评审意见']]), challenges: ['GET能否带Body？','空字符串、null和字段缺失是否等价？','新增枚举为何可能破坏旧客户端？','接口200但业务code失败如何验收？'], assessment: ['独立构造3类请求', '覆盖6类字段边界', '解释HTTP与业务错误差异', '提交接口评审清单'] },
  { id: 7, dates: '9.28–10.4', title: '把异常、并发与权限写进需求', focus: '权限模型、分页、幂等、并发、限流、重试、状态机与异常体验', experiment: '验证权限、重复提交、分页边界和状态冲突', output: '接口验收矩阵＋状态机', weight: '需求评审', status: 'available', concepts: ['idempotency'], outcomes: ['从角色、资源、动作建立权限矩阵', '设计重复提交和网络重试下的幂等策略', '覆盖分页、限流、并发修改和状态冲突'], lessons: makeLessons([['理解','权限模型与状态机','从谁、对什么、能做什么以及何时能做建立规则。','权限矩阵'],['读图','分页、幂等与并发','理解游标、页码、幂等键、锁与版本号。','异常机制图'],['实验','破坏式接口验收','重复提交、越权、翻到末页、并发更新并观察结果。','验收证据集'],['诊断','409、429与重试风暴','判断冲突、限流和错误重试的产品后果。','异常诊断表'],['评审','异常状态与恢复路径','为每个失败写用户提示、保留输入、重试和人工兜底。','异常体验清单'],['迁移','完成接口验收矩阵','按正常、边界、异常、权限、并发五层覆盖。','接口验收矩阵']]), challenges: ['重复支付如何做到业务幂等？','分页中新增数据会发生什么？','两个运营同时编辑如何避免覆盖？','429后客户端应怎样退避？'], assessment: ['覆盖20个验收点', '独立解释幂等与防抖差异', '画出核心状态机', '异常均有恢复路径'] },
  { id: 8, dates: '10.5–10.11', title: '用 Python 自动化产品工作', focus: '数据类型、条件、循环、函数、异常、文件、JSON与CSV', experiment: '读取接口数据并自动生成每日业务摘要', output: '可重复运行的 Python 脚本', weight: '数据分析', status: 'available', concepts: ['python'], outcomes: ['读懂并修改基础Python', '处理JSON、CSV和日期', '把重复操作封装为有输入、输出和错误提示的脚本'], lessons: makeLessons([['理解','程序如何表达步骤','变量、类型、条件、循环、函数和模块。','代码结构标注'],['读图','从输入到输出','沿变量变化读懂一段业务脚本。','执行流程图'],['实验','处理JSON和CSV','读取、筛选、计算并导出结果。','数据处理脚本'],['诊断','报错不是失败而是线索','读取Traceback，区分语法、类型、键缺失和文件路径。','错误排查表'],['评审','自动化的边界与安全','处理敏感数据、异常输入、日志和可重复运行。','脚本验收清单'],['迁移','生成每日业务摘要','将数据清洗、统计和文本输出串成小工具。','自动摘要脚本']]), challenges: ['字符串数字为何不能直接相加？','字典缺少字段怎样不中断全批数据？','脚本重复运行会不会重复写入？','何时不应把工作自动化？'], assessment: ['修改5处代码', '解决4类报错', '脚本可重复运行', '输出包含数据限制说明'] },
  { id: 9, dates: '10.12–10.18', title: '建立可复现的数据清洗管道', focus: 'pandas、缺失、重复、异常、类型转换、合并与质量报告', experiment: '清洗脏数据并自动输出质量摘要', output: '清洗脚本＋数据质量报告', weight: '数据分析', status: 'available', concepts: ['pandas'], outcomes: ['用pandas完成读取、筛选、变换和聚合', '为缺失、重复和异常制定可解释规则', '保留原始数据并输出可审计质量报告'], lessons: makeLessons([['理解','DataFrame与可复现处理','理解列运算、索引和链式处理。','pandas操作图'],['读图','数据质量六维','完整性、唯一性、有效性、一致性、及时性、准确性。','质量检查框架'],['实验','清洗订单数据','修复类型、空值、重复、异常价格和非法状态。','清洗脚本'],['诊断','清洗规则会不会伤害数据','比较删除、填充、截断和保留标记的代价。','规则影响分析'],['评审','数据输入输出契约','定义字段、类型、编码、时区和失败处理。','数据契约'],['迁移','生成自动质量报告','输出处理前后行数、问题分布和规则日志。','自动分析文件']]), challenges: ['缺失值填0何时会误导？','重复订单按哪一列判断？','异常值应该删除还是标记？','类型转换失败的数据如何保留证据？'], assessment: ['完成8项质量检查', '清洗前后可对账', '每条规则有理由', '报告可复现'] },
  { id: 10, dates: '10.19–10.25', title: '从埋点到实验做可信决策', focus: '事件模型、漏斗、留存、分群、A/B测试、显著性与护栏指标', experiment: '模拟埋点缺失、样本偏差和实验指标波动', output: '指标与埋点方案＋实验设计', weight: '数据分析', status: 'available', concepts: ['funnel'], outcomes: ['设计事件、属性、触发时机与去重规则', '构建漏斗、留存和分群分析', '识别实验污染、样本偏差与指标冲突'], lessons: makeLessons([['理解','从用户行为到事件数据','定义事件、用户、会话、属性和触发时机。','事件模型'],['读图','漏斗、留存与分群','理解窗口、顺序、去重和 cohort。','分析框架图'],['实验','模拟埋点与样本变化','调整缺失率、分流和指标口径观察结论。','模拟实验记录'],['诊断','为什么实验结果不可信','识别SRM、污染、新奇效应和多重检验。','实验风险表'],['评审','埋点与实验设计评审','定义主指标、护栏、最小效果、周期与停止规则。','评审清单'],['迁移','设计一个产品实验','从假设到决策阈值形成完整方案。','指标与埋点方案']]), challenges: ['漏斗步骤能否跨天？','次日留存以自然日还是24小时？','实验主指标涨但投诉率也涨怎么办？','中途看显著就停止有什么问题？'], assessment: ['设计10个事件字段', '完成漏斗与留存口径', '识别4类实验风险', '方案能支持上线决策'] },
  { id: 11, dates: '10.26–11.1', title: '设计可评测、可兜底的 AI 功能', focus: 'LLM、Prompt、RAG、工具调用、幻觉、上下文、成本、延迟与安全', experiment: '构建并运行 AI 客服评测集与失败分类', output: 'AI评测集＋系统方案', weight: '研发沟通', status: 'available', concepts: ['rag'], outcomes: ['画出模型、知识库、检索、工具与业务系统链路', '把“回答得好”拆成可评分维度', '覆盖幻觉、隐私、注入、成本、延迟和人工兜底'], lessons: makeLessons([['理解','AI功能不是一个Prompt','理解模型、上下文、RAG、工具、业务规则和审计。','AI系统链路'],['读图','工具调用','理解工具目录、调用提案、参数、权限、确认、执行和结果回执。','AI调用图'],['实验','构建最小评测集','编写正常、边界、对抗、隐私和拒答案例。','20条评测样本'],['诊断','幻觉从哪里产生','区分检索失败、资料冲突、推理错误和表达过度确定。','失败分类表'],['评审','成本、延迟与安全','定义模型选择、缓存、降级、权限和人工兜底。','AI风险清单'],['迁移','评测一个AI客服','运行样本、记录分数和失败原因，提出迭代方案。','AI评测报告']]), challenges: ['RAG有资料为何仍会幻觉？','工具调用成功但业务结果错误怎么办？','用户提示词要求泄露系统信息如何处理？','模型升级后为何必须回归评测？'], assessment: ['至少20条评测样本', '覆盖6类失败', '评分标准可复现', '系统方案包含兜底'] },
  { id: 12, dates: '11.2–11.8', title: '完成端到端产品技术作品集', focus: '需求、架构、接口、数据、实验、AI评测、风险与汇报', experiment: '从问题定义到验证交付完成综合项目', output: '完整产品技术作品集', weight: '需求评审', status: 'available', concepts: ['evaluation'], outcomes: ['独立拆解一个AI或数据产品功能', '用API、SQL、Python和评测证据验证方案', '向研发、数据和业务清晰说明权衡与风险'], lessons: makeLessons([['理解','定义值得解决的问题','明确用户、场景、现状、目标、约束和非目标。','项目Brief'],['读图','系统与数据方案','绘制链路、接口、数据表、状态机和AI模块。','方案蓝图'],['实验','建立可运行验证','完成接口请求、SQL分析、Python处理或AI评测。','验证证据'],['诊断','风险与失败预案','覆盖隐私、权限、错误、成本、延迟、数据质量和运营。','风险登记册'],['评审','模拟跨职能评审','回应研发、数据、算法、设计和运营问题。','评审纪要'],['迁移','作品集叙事与复盘','展示决策过程、证据、结果、限制和下一步。','完整作品集']]), challenges: ['如何证明问题值得做？','技术方案的关键未知是什么？','上线成功与技术成功如何分别定义？','哪些结论必须标注为推测？'], assessment: ['所有关键图与文档齐全', '至少一次可运行验证', '覆盖风险与兜底', '能在10分钟内完成答辩'] },
]

export const programStats = {
  weeks: weeks.length,
  lessons: weeks.reduce((sum, week) => sum + week.lessons.length, 0),
  challenges: weeks.reduce((sum, week) => sum + week.challenges.length, 0),
  labs: weeks.reduce((sum, week) => sum + week.lessons.filter((lesson) => lesson.kind === '实验' || lesson.kind === '诊断').length, 0),
  checkpoints: weeks.length * 6 * 5,
  instantChoices: 120,
}

export const glossary: GlossaryEntry[] = [
  { id: 'frontend', term: '前端', english: 'Frontend', plain: '用户直接看到并操作的页面或客户端部分。', analogy: '像餐厅的前厅：负责接待、展示菜单和收集需求。', pmQuestion: '这个状态由前端判断，还是需要等待后端返回？', confusedWith: '前端不是视觉稿；它是把界面与交互真正运行起来的代码。', week: 1 },
  { id: 'backend', term: '后端', english: 'Backend', plain: '在服务器上处理业务规则、权限和数据的程序。', analogy: '像餐厅后厨：收到订单后按规则制作，并决定能否出餐。', pmQuestion: '这条业务规则应该由后端统一保证吗？', confusedWith: '后端不等于数据库；后端会读写数据库并执行规则。', week: 1 },
  { id: 'api', term: '接口', english: 'API', plain: '两个软件模块约定好的沟通方式，包括请求与返回格式。', analogy: '像前厅交给后厨的标准点菜单。', pmQuestion: '成功和失败分别返回什么字段与状态码？', confusedWith: 'API 是约定，不只是一个 URL。', week: 1 },
  { id: 'server', term: '服务器', english: 'Server', plain: '持续运行程序、接收网络请求的计算机或云资源。', analogy: '像后厨所在的场地和设备。', pmQuestion: '这个服务部署在哪个环境，是否有容量或延迟限制？', week: 1 },
  { id: 'database', term: '数据库', english: 'Database', plain: '按照结构长期保存和查询业务数据的系统。', analogy: '像带目录和规则的档案库，而不是随手堆放的文件夹。', pmQuestion: '这项数据的唯一标识、更新时间和来源是什么？', week: 1 },
  { id: 'environment', term: '环境', english: 'Environment', plain: '一套独立运行的程序、配置与数据，常见有开发、测试和生产环境。', analogy: '像排练场、彩排舞台和正式演出舞台。', pmQuestion: '问题发生在哪个环境？版本和配置是否一致？', week: 2 },
  { id: 'auth', term: '鉴权', english: 'Authentication & Authorization', plain: '确认“你是谁”以及“你能做什么”。', analogy: '先检查工牌身份，再检查是否有房间门禁。', pmQuestion: '未登录与无权限应该分别怎样提示？', confusedWith: '401 常表示没有有效身份；403 常表示身份有效但权限不足。', week: 2 },
  { id: 'cache', term: '缓存', english: 'Cache', plain: '把常用结果临时放在更快的位置，减少重复计算或查询。', analogy: '把高频资料放桌面，不必每次去档案库。', pmQuestion: '数据更新后缓存何时失效，用户多久能看到新结果？', week: 2 },
  { id: 'log', term: '日志', english: 'Log', plain: '系统运行时留下的时间、动作、结果和错误记录。', analogy: '像系统的行车记录仪，用于还原发生过什么。', pmQuestion: '定位这个问题需要提供时间、账号、请求 ID 还是错误码？', week: 2 },
  { id: 'release', term: '发布', english: 'Release', plain: '把验证过的新版本部署到用户实际使用环境的过程。', analogy: '从排练转入正式演出，还要准备撤回旧版本。', pmQuestion: '发布范围、依赖、监控指标和回滚条件是什么？', week: 2 },
  { id: 'sql', term: 'SQL', english: 'Structured Query Language', plain: '从结构化数据库中查询和汇总数据的语言。', analogy: '向档案管理员提出条件明确的取数请求。', pmQuestion: '查询口径中的时间、去重和状态条件是否完整？', week: 3 },
  { id: 'metric', term: '指标口径', english: 'Metric Definition', plain: '一个指标如何计算、统计谁、统计多久以及排除什么的完整规则。', analogy: '不是只说“算收入”，而是写清币种、退款、时间与订单状态。', pmQuestion: '分子、分母、时间范围、去重键和数据延迟分别是什么？', week: 4 },
  { id: 'join', term: '表连接', english: 'JOIN', plain: '按照共同字段把多张数据表的行匹配到一起。', analogy: '根据学号把学生名单与成绩表对齐。', pmQuestion: '连接键是否唯一？一对多会不会把数据重复放大？', week: 5 },
  { id: 'http', term: 'HTTP', english: 'Hypertext Transfer Protocol', plain: '浏览器与服务端传递请求和响应的一套规则。', analogy: '像快递单规定寄件地址、内容、身份与处理结果。', pmQuestion: '请求方法、参数位置、状态码和超时策略是什么？', week: 6 },
  { id: 'json', term: 'JSON', english: 'JavaScript Object Notation', plain: '接口常用的结构化文本格式，由键、值、数组和对象组成。', analogy: '像字段名称清晰、可以嵌套的电子表单。', pmQuestion: '字段类型、是否必填、空值和兼容规则是什么？', week: 6 },
  { id: 'idempotency', term: '幂等', english: 'Idempotency', plain: '同一个操作重复执行多次，最终业务结果仍与执行一次一致。', analogy: '重复按电梯按钮不会叫来多部电梯。', pmQuestion: '用户重复点击或网络重试会不会创建两笔订单？', week: 7 },
  { id: 'python', term: 'Python', english: 'Python', plain: '语法相对易读、适合数据处理和自动化的编程语言。', analogy: '把一串重复的数据操作写成可以反复执行的说明书。', pmQuestion: '这项重复工作是否值得先用脚本做小规模自动化？', week: 8 },
  { id: 'pandas', term: 'pandas', english: 'pandas', plain: 'Python 中用于读取、清理、变换和汇总表格数据的工具库。', analogy: '一套可编程、可复现的电子表格处理工具。', pmQuestion: '清洗规则是否会误删有效数据，结果能否复现？', week: 9 },
  { id: 'funnel', term: '漏斗', english: 'Funnel', plain: '观察用户按步骤逐层流失的分析方法。', analogy: '看有多少人从进店、试用、下单一路走到支付。', pmQuestion: '每一步事件是否可比，时间窗口和用户去重规则是什么？', week: 10 },
  { id: 'rag', term: '检索增强生成', english: 'RAG', plain: '先从知识库找到相关资料，再让模型依据资料生成答案。', analogy: '先让客服查手册，再组织语言回答，而不是凭记忆猜。', pmQuestion: '检索不到、资料冲突或引用过期时如何处理？', week: 11 },
  { id: 'evaluation', term: 'AI评测', english: 'AI Evaluation', plain: '用代表性案例和明确标准持续判断 AI 输出是否可用、安全且稳定。', analogy: '不是试玩几次，而是用成套试题测能力和风险。', pmQuestion: '成功标准、失败类型、样本覆盖和人工兜底分别是什么？', week: 12 },
]

export const quizQuestions: QuizQuestion[] = [
  {
    id: 'w1-q1', week: 1, conceptId: 'api',
    prompt: '用户点击“提交订单”后页面持续转圈。Network 中请求一直 Pending。此时最准确的判断是什么？',
    options: ['一定是数据库坏了', '请求已经发出，但尚未收到完整响应，需要继续查看耗时与服务日志', '一定是前端按钮失效', '用户没有登录'],
    answer: 1,
    explanation: 'Pending 只说明请求尚未结束，可能是网络、网关、后端或下游依赖变慢。它不足以直接锁定数据库或前端。', level: '判断',
  },
  {
    id: 'w1-q2', week: 1, conceptId: 'backend',
    prompt: '“优惠券只能用于满100元订单”这条规则，为什么通常需要后端再次校验？',
    options: ['后端页面更好看', '避免用户绕过前端直接请求接口，保证规则一致', '因为数据库不会保存金额', '为了让按钮变灰'],
    answer: 1,
    explanation: '前端校验改善体验，后端校验才是业务规则的最终防线，否则请求可以绕过页面直接发出。', level: '概念',
  },
  {
    id: 'w1-q3', week: 1, conceptId: 'database',
    prompt: '接口返回成功，但刷新后刚保存的数据消失。优先需要确认哪件事？',
    options: ['图标颜色是否正确', '后端是否真正写入正确环境的数据库，以及事务是否成功提交', '浏览器字体是否加载', '用户是否使用深色模式'],
    answer: 1,
    explanation: '“返回成功但数据未保留”首先要验证写入是否真正完成、写到了哪个环境，以及事务是否提交。', level: '应用',
  },
  {
    id: 'w1-q4', week: 1, conceptId: 'frontend', level: '判断',
    prompt: '点击“提交”后 Network 没有出现任何新请求，但按钮进入了加载状态。下一步最有效的检查是什么？',
    options: ['直接让DBA查数据库', '检查前端控制台错误、表单校验与点击事件是否在发送前中断', '要求后端重启服务', '判断一定是用户网络断开'],
    answer: 1,
    explanation: '没有请求意味着证据链还没离开浏览器，应先检查前端事件、校验和JavaScript异常，而不是跳到后端或数据库。',
  },
  {
    id: 'w1-q5', week: 1, conceptId: 'api', level: '评审',
    prompt: '评审“提交订单”需求时，哪组接口约定最完整？',
    options: ['只有一个URL', 'URL和一张成功截图', '方法、参数、认证、成功响应、错误码、超时、幂等与重试规则', '研发口头说可以做'],
    answer: 2,
    explanation: '接口不是单一URL，而是一份可执行契约；评审需要覆盖输入、输出、失败和重复执行。',
  },
  {
    id: 'w1-q6', week: 1, conceptId: 'server', level: '应用',
    prompt: '接口总耗时4秒，服务日志显示业务处理只用了80ms。最合理的后续方向是？',
    options: ['认定后端代码慢', '比较DNS、连接、网关、排队、下游调用和响应传输各阶段耗时', '删除数据库索引', '修改页面字体'],
    answer: 1,
    explanation: '总耗时与业务处理耗时差距很大，需要继续拆分网络、网关、排队和下游，而不是把所有时间归给后端业务代码。',
  },
  {
    id: 'w2-q1', week: 2, conceptId: 'auth',
    prompt: '用户已登录，但访问管理员页面返回 403。最合理的解释是？',
    options: ['身份凭证完全缺失', '服务器宕机', '身份有效，但当前账号没有该资源权限', '数据库一定为空'],
    answer: 2,
    explanation: '403 通常表示服务理解请求，也识别了身份，但拒绝当前账号访问；401 更常与无有效身份有关。', level: '概念',
  },
  {
    id: 'w2-q2', week: 2, conceptId: 'cache',
    prompt: '运营修改活动标题后，部分用户仍看到旧标题。接口偶尔又返回新标题。最值得优先排查什么？',
    options: ['缓存失效规则与不同节点的数据一致性', '用户手机颜色设置', '按钮圆角', 'SQL 是否全部使用 JOIN'],
    answer: 0,
    explanation: '新旧内容交替出现常见于多级缓存未同时失效，或不同服务节点状态不一致。', level: '判断',
  },
  {
    id: 'w2-q3', week: 2, conceptId: 'log',
    prompt: '提交线上 Bug 时，哪组信息最能帮助研发快速定位日志？',
    options: ['“刚刚坏了，很急”', '页面截图和心情描述', '准确时间、环境、账号或匿名ID、复现步骤、请求ID/错误码', '只提供产品需求文档'],
    answer: 2,
    explanation: '日志定位依赖时间窗口、环境和可关联标识；再结合稳定复现步骤与错误证据，研发才能缩小范围。', level: '应用',
  },
  {
    id: 'w2-q4', week: 2, conceptId: 'release', level: '评审',
    prompt: '发布前哪组信息最能支持“是否继续放量”的决策？',
    options: ['开发说改动很小', '页面看起来正常', '灰度范围、基线指标、错误率与延迟阈值、观察时长、回滚负责人和操作路径', '等用户投诉后再判断'],
    answer: 2,
    explanation: '放量与回滚必须依赖事先定义的观察范围、阈值、时间和责任人，不能依赖主观感觉。',
  },
  {
    id: 'w2-q5', week: 2, conceptId: 'auth', level: '应用',
    prompt: '用户Token过期时，怎样的产品处理更完整？',
    options: ['静默丢弃用户输入', '只显示“未知错误”', '提示登录失效、保存可恢复输入、重新登录后回到原操作，并避免无限重试', '自动赋予管理员权限'],
    answer: 2,
    explanation: '身份恢复不仅是重新登录，还要保护用户操作、提供回到原场景的路径，并防止重试循环。',
  },
  {
    id: 'w2-q6', week: 2, conceptId: 'cache', level: '评审',
    prompt: '运营配置保存成功后要求“所有用户立即看到新内容”，评审时最关键的追问是？',
    options: ['按钮用什么颜色', '缓存层级、失效机制、一致性目标与可接受生效时间', 'SQL关键字大写还是小写', '研发电脑型号'],
    answer: 1,
    explanation: '“立即”需要转化成可验证的一致性与时延目标，并明确多级缓存如何主动失效或自然过期。',
  },
  ...extendedQuizQuestions,
  ...advancedQuizQuestions,
]

export const requestNodes = [
  { id: 'user', label: '用户点击', short: '意图产生', concept: '用户在页面触发一个动作。产品经理先明确：前置条件是什么，成功后应该看到什么？', pm: '重复点击会发生什么？按钮何时禁用？' },
  { id: 'frontend', label: '前端', short: '组装请求', concept: '前端读取输入、做基础校验，再按接口约定组装请求。它也负责加载、成功与错误状态。', pm: '前端校验只是体验优化，还是业务规则的唯一校验？' },
  { id: 'api', label: 'API', short: '传递约定', concept: '请求通过方法、地址、参数、Header 和 Body 把信息交给后端，响应则带回状态码和数据。', pm: '失败时返回什么状态码、错误码和用户提示？' },
  { id: 'backend', label: '后端', short: '执行规则', concept: '后端校验身份与业务规则，调用数据库或其他服务，并组织响应结果。', pm: '并发、重复提交和下游超时时怎样处理？' },
  { id: 'database', label: '数据库', short: '保存事实', concept: '数据库保存用户、订单等长期状态。读写是否成功，会直接决定刷新后数据是否仍然存在。', pm: '唯一键是什么？写入失败能否回滚？数据多久可查询？' },
  { id: 'response', label: '页面反馈', short: '呈现结果', concept: '响应返回后，前端结束加载并展示成功、空、失败或重试状态。', pm: '错误信息能否告诉用户发生了什么、接下来怎么办？' },
]

export const faultScenarios = [
  {
    id: 'auth-expired', label: 'Token 已过期', code: 401, latency: 86,
    symptom: '页面提示“登录状态已失效”，数据没有加载。',
    log: 'auth middleware: token expired at 2026-08-24T09:11:00+08:00',
    layer: '鉴权', recovery: '重新登录并刷新 Token；同时确认前端能保留用户当前操作。',
  },
  {
    id: 'permission-denied', label: '账号无权限', code: 403, latency: 72,
    symptom: '用户已登录，但“导出全部用户”操作被拒绝。',
    log: 'authorization: role=viewer required=admin action=export_users',
    layer: '权限', recovery: '确认角色权限矩阵，并向用户说明申请权限的路径。',
  },
  {
    id: 'server-error', label: '服务内部异常', code: 500, latency: 644,
    symptom: '提交后出现“系统开小差”，再次尝试仍失败。',
    log: 'order-service ERROR NullPointerException request_id=req_8fa21',
    layer: '后端', recovery: '使用 request_id 和准确时间定位日志；评估是否需要降级、重试或回滚。',
  },
  {
    id: 'stale-cache', label: '缓存未失效', code: 200, latency: 31,
    symptom: '运营已改标题，但一部分用户仍看到旧文案。',
    log: 'cache HIT campaign:2026-autumn ttl_remaining=1178s version=v3',
    layer: '缓存', recovery: '检查缓存键、TTL 和主动失效链路，确认不同节点是否一致。',
  },
]
