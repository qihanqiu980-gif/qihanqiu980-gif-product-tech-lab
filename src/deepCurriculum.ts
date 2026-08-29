export interface DepthLayer {
  name: '概念与边界' | '机制与链路' | '证据与实验' | '失败与评审'
  objective: string
  topics: string[]
}

export interface DeepWeekFramework {
  keyQuestions: string[]
  layers: DepthLayer[]
  seniorTasks: string[]
  terms: string[]
}

export const deepCurriculum: Record<number, DeepWeekFramework> = {
  1: {
    keyQuestions: ['一次点击如何跨越浏览器、网络、服务和数据层？', '200、Pending、超时和页面空白分别能证明什么？', '产品经理怎样用最少证据缩小故障范围？'],
    layers: [
      { name: '概念与边界', objective: '区分运行位置、职责和可观察证据。', topics: ['浏览器与客户端运行时', 'DNS、连接与 TLS', '前端状态与后端规则', 'API、服务与数据库边界'] },
      { name: '机制与链路', objective: '能沿时间顺序解释一次请求。', topics: ['事件触发与表单校验', '请求组装与网关路由', '业务校验与下游调用', '事务写入与页面渲染'] },
      { name: '证据与实验', objective: '只依据可复现证据作判断。', topics: ['Headers 与 Payload', 'TTFB 与总耗时', 'Response 与 Console', 'request_id 与调用链'] },
      { name: '失败与评审', objective: '把失败分支写进需求。', topics: ['请求未发出', '网络或下游超时', '接口成功但渲染失败', '重复点击与状态恢复'] },
    ],
    seniorTasks: ['比较“没有请求”和“请求 Pending”的排查路径', '为提交订单设计加载、超时、重试和重复点击验收', '用 request_id 串起用户现象、Network 和服务日志'],
    terms: ['DNS', 'TLS', 'TTFB', 'Gateway', 'Transaction', 'Trace ID'],
  },
  2: {
    keyQuestions: ['同一套代码为什么只在某个环境出错？', '401、403、409、429、500、502、504 的责任边界是什么？', '何时重试、降级、回滚或人工介入？'],
    layers: [
      { name: '概念与边界', objective: '理解环境、配置、身份和版本。', topics: ['开发／测试／预发／生产', '认证与授权', '配置中心与密钥', '版本、灰度与依赖'] },
      { name: '机制与链路', objective: '理解故障如何被观察和恢复。', topics: ['缓存命中与失效', '日志等级与关联 ID', '监控、告警与 SLO', '灰度、回滚与数据兼容'] },
      { name: '证据与实验', objective: '建立完整故障证据链。', topics: ['环境与版本指纹', '精确时间窗口', '状态码与业务错误码', '日志首个异常与影响范围'] },
      { name: '失败与评审', objective: '避免把恢复动作变成二次事故。', topics: ['无限重试', '缓存雪崩与不一致', '回滚后数据不兼容', '告警有噪声或无责任人'] },
    ],
    seniorTasks: ['写一份可直接交给研发的 502 故障报告', '设计发布后 30 分钟观察表和回滚阈值', '比较刷新缓存、重启服务和回滚版本的风险'],
    terms: ['Configuration', 'Feature Flag', 'SLO', 'Rollback', '502 Bad Gateway', '504 Gateway Timeout'],
  },
  3: {
    keyQuestions: ['模糊业务问题如何翻译成表、字段、粒度和条件？', 'SQL 返回结果为什么可能“语法正确但业务错误”？', '怎样用样本、唯一键和基线对账证明查询可信？'],
    layers: [
      { name: '概念与边界', objective: '建立关系数据与查询心智模型。', topics: ['表、行、列与粒度', '主键、唯一键与外键', '数据类型与 NULL', '数据字典与刷新频率'] },
      { name: '机制与链路', objective: '理解查询各阶段的作用。', topics: ['FROM 与数据来源', 'WHERE 与行筛选', 'SELECT 与派生字段', 'ORDER BY、LIMIT 与稳定排序'] },
      { name: '证据与实验', objective: '从小样本递进到业务答案。', topics: ['先查样本再聚合', '左闭右开时间边界', 'COUNT 与 DISTINCT 对账', 'CASE 与异常分组'] },
      { name: '失败与评审', objective: '识别查询中的隐性假设。', topics: ['时区与日期边界', 'NULL 三值逻辑', '历史表重复版本', '结果为 0 的分层排查'] },
    ],
    seniorTasks: ['将“昨天付费用户”写成完整取数契约', '解释 WHERE 与 HAVING 的使用边界', '为 12 条查询分别写能支持与不能支持的结论'],
    terms: ['Primary Key', 'Granularity', 'NULL', 'CASE WHEN', 'HAVING', 'Query Plan'],
  },
  4: {
    keyQuestions: ['指标为何不是一个数字而是一份契约？', '均值、比例和累计值会怎样误导决策？', '主指标、过程指标和护栏指标如何共同约束上线？'],
    layers: [
      { name: '概念与边界', objective: '从目标建立指标体系。', topics: ['业务目标与用户价值', '北极星与输入指标', '分子、分母与去重键', '时间窗口与排除规则'] },
      { name: '机制与链路', objective: '理解聚合与分组的结果。', topics: ['COUNT DISTINCT', 'SUM 与金额粒度', 'AVG、Median 与分位数', 'GROUP BY 与 HAVING'] },
      { name: '证据与实验', objective: '用同一数据验证多个口径。', topics: ['样本数与分布', '分母覆盖变化', '分群与结构变化', '口径版本与数据延迟'] },
      { name: '失败与评审', objective: '识别指标上涨的假象。', topics: ['辛普森悖论', '幸存者偏差', '异常大单', '只看主指标忽略护栏'] },
    ],
    seniorTasks: ['为支付转化率写一页指标字典', '解释客单价上涨但收入下降的可能原因', '设计指标变更的版本、回算和通知机制'],
    terms: ['Denominator', 'Median', 'Percentile', 'Guardrail Metric', 'Simpson’s Paradox', 'Metric Tree'],
  },
  5: {
    keyQuestions: ['JOIN 前为什么必须确认每张表的一行代表什么？', '一对多和多对多如何悄悄放大金额？', '观察差异为什么不能直接宣称因果？'],
    layers: [
      { name: '概念与边界', objective: '理解表关系与保留规则。', topics: ['主表与从表', 'INNER／LEFT JOIN', '一对一／一对多／多对多', '事实表与维度表'] },
      { name: '机制与链路', objective: '预测连接后的行数变化。', topics: ['连接键唯一性', 'NULL 与未匹配行', '先聚合后连接', '历史拉链与有效期'] },
      { name: '证据与实验', objective: '建立逐步对账纪律。', topics: ['每步行数', '唯一业务键', '金额与基线', 'Anti Join 与异常样本'] },
      { name: '失败与评审', objective: '控制数据与结论偏差。', topics: ['右表筛选改变 LEFT JOIN', '订单金额重复累加', '身份键错配', '相关性冒充因果'] },
    ],
    seniorTasks: ['定位 GMV 被放大 2.7 倍的第一个连接步骤', '为未匹配用户设计质量检查和解释', '把分析结论分为事实、相关、推测和待验证'],
    terms: ['Cardinality', 'Fact Table', 'Dimension Table', 'Anti Join', 'Slowly Changing Dimension', 'Data Reconciliation'],
  },
  6: {
    keyQuestions: ['接口文档怎样变成可执行契约？', 'null、空字符串、缺失字段与未知枚举有何区别？', '接口演进如何避免破坏旧客户端？'],
    layers: [
      { name: '概念与边界', objective: '理解 HTTP 与资源建模。', topics: ['Resource 与 Endpoint', 'GET／POST／PUT／PATCH', 'Path／Query／Header／Body', 'HTTP 与业务错误码'] },
      { name: '机制与链路', objective: '理解请求处理与版本演进。', topics: ['认证与内容类型', '序列化与反序列化', 'Schema 校验', '兼容新增、废弃与版本'] },
      { name: '证据与实验', objective: '构造正常、边界和失败请求。', topics: ['必填与类型', '长度与枚举', '未知字段', '超时、request_id 与重放'] },
      { name: '失败与评审', objective: '覆盖契约歧义和恢复。', topics: ['200 携带业务失败', '超时后重复创建', 'PATCH 覆盖未传字段', '旧客户端不认识新枚举'] },
    ],
    seniorTasks: ['把一句“新增标签接口”扩展为字段级契约', '为旧客户端设计向后兼容的枚举策略', '分配客户端、网关、服务和下游的超时预算'],
    terms: ['Resource', 'Schema', 'Backward Compatibility', 'PATCH', 'Timeout Budget', 'Correlation ID'],
  },
  7: {
    keyQuestions: ['权限、状态和动作如何组成可执行规则？', '重复提交、并发修改和网络重试如何保证业务一致？', '分页和限流怎样影响用户看到的数据与恢复路径？'],
    layers: [
      { name: '概念与边界', objective: '建立权限与状态模型。', topics: ['RBAC 与 ABAC', '资源、角色与动作', '状态机与合法迁移', '前端隐藏与服务端授权'] },
      { name: '机制与链路', objective: '理解并发与恢复机制。', topics: ['Idempotency Key', '乐观锁与 version', 'Cursor 与 Offset 分页', 'Retry-After 与指数退避'] },
      { name: '证据与实验', objective: '进行破坏式验收。', topics: ['重复创建只产生一条业务记录', '旧版本更新返回 409', '越权接口返回拒绝', '429 后有限重试并恢复'] },
      { name: '失败与评审', objective: '防止局部错误扩散。', topics: ['重试风暴', '静默覆盖', '翻页重复与遗漏', '幂等键过期或范围错误'] },
    ],
    seniorTasks: ['为支付创建设计端到端幂等证据', '画出活动从草稿到发布的状态机', '写一份 20 项异常验收矩阵并标出责任层'],
    terms: ['RBAC', 'ABAC', 'Optimistic Locking', 'Cursor Pagination', 'Exponential Backoff', 'Idempotency Window'],
  },
  8: {
    keyQuestions: ['产品经理需要学到什么程度的 Python？', '输入、规则、输出和异常如何组成可靠脚本？', '自动化何时提高效率，何时放大风险？'],
    layers: [
      { name: '概念与边界', objective: '读懂程序的基本构件。', topics: ['变量与数据类型', '条件与循环', '函数与模块', '列表、字典与集合'] },
      { name: '机制与链路', objective: '沿数据流理解代码。', topics: ['读取文件', '解析 JSON／CSV', '验证与转换', '汇总、日志与输出'] },
      { name: '证据与实验', objective: '独立修改并验证脚本。', topics: ['正常与异常输入', 'Traceback 定位', '预期输出对比', '重复运行一致性'] },
      { name: '失败与评审', objective: '控制脚本风险。', topics: ['静默吞错', '默认值掩盖缺失', '覆盖原文件', '高风险生产操作自动化'] },
    ],
    seniorTasks: ['从 Traceback 最后一行回溯到业务代码', '让脚本同时输出成功、隔离和质量摘要', '为脚本写输入契约、退出码和恢复说明'],
    terms: ['Type', 'Function', 'Exception', 'Traceback', 'Standard Library', 'Idempotent Script'],
  },
  9: {
    keyQuestions: ['数据清洗为何不是“把脏数据删掉”？', '每一行如何从原始数据流向清洁区或隔离区？', '规则变化后怎样重跑、比较和审计？'],
    layers: [
      { name: '概念与边界', objective: '建立数据质量与血缘意识。', topics: ['DataFrame 与列运算', '完整性与唯一性', '有效性与一致性', '及时性与准确性'] },
      { name: '机制与链路', objective: '设计可重跑的清洗管道。', topics: ['原始区只读', '类型和 Schema 校验', '规则标记与隔离', '清洁输出与质量报告'] },
      { name: '证据与实验', objective: '证明清洗前后可对账。', topics: ['原始=清洁+隔离', '规则命中数量', '重叠问题处理', '原值、行 ID 与规则版本'] },
      { name: '失败与评审', objective: '避免清洗制造新偏差。', topics: ['fillna(0) 伪造事实', '合法异常被删除', 'Schema Drift', '覆盖原始文件失去追溯'] },
    ],
    seniorTasks: ['为 9 类异常定义保留、修复或隔离策略', '比较规则 v1 与 v2 对结果的影响', '设计 Schema 漂移时的阻断和告警机制'],
    terms: ['Data Lineage', 'Quarantine', 'Schema Drift', 'Validation Rule', 'Data Contract', 'Reproducibility'],
  },
  10: {
    keyQuestions: ['埋点怎样从需求变成可验收的数据契约？', '漏斗、留存和实验结果受哪些口径影响？', '显著不等于值得上线，产品决策还缺什么？'],
    layers: [
      { name: '概念与边界', objective: '建立事件与实验基础。', topics: ['事件、属性、用户与会话', '漏斗顺序与窗口', 'Cohort 与留存', '随机分流与对照组'] },
      { name: '机制与链路', objective: '理解从行为到决策的管道。', topics: ['触发、上报与去重', '入组、曝光与污染', '主指标与护栏', '样本量、MDE 与周期'] },
      { name: '证据与实验', objective: '先验证实验健康再读结果。', topics: ['埋点抽样验收', 'SRM 检查', '基线与置信区间', '分群与敏感性分析'] },
      { name: '失败与评审', objective: '识别常见错误推断。', topics: ['多次偷看与提前停止', '多重检验', '新奇效应', '只看显著性忽略业务价值'] },
    ],
    seniorTasks: ['为关键事件写触发、字段、去重和验收规则', '发现 45:55 分流时暂停结论并定位原因', '写出上线、继续实验和放弃方案的决策阈值'],
    terms: ['Cohort', 'SRM', 'MDE', 'Confidence Interval', 'Intent-to-Treat', 'Multiple Testing'],
  },
  11: {
    keyQuestions: ['AI 功能为何是系统而不是一个 Prompt？', '检索、生成、工具和权限如何分别评测？', '幻觉、注入、隐私、成本和延迟如何设计兜底？'],
    layers: [
      { name: '概念与边界', objective: '建立 AI 系统全链路。', topics: ['模型与上下文窗口', 'Prompt 与结构化输出', 'Embedding、检索与 RAG', 'Tool Calling 与业务系统'] },
      { name: '机制与链路', objective: '理解一次 AI 请求的决策点。', topics: ['意图与权限', 'Query 改写与召回', '证据排序与生成', '工具执行、审计与回复'] },
      { name: '证据与实验', objective: '建立可复现评测。', topics: ['正常／边界／对抗样本', '检索命中与引用', '事实、任务、安全、表达评分', '离线回归与线上指标'] },
      { name: '失败与评审', objective: '分层定位 AI 失败。', topics: ['知识缺失与检索失败', '资料冲突与生成幻觉', 'Prompt Injection', '工具越权、成本失控与人工兜底'] },
    ],
    seniorTasks: ['把 20 条样本扩成覆盖矩阵并固定回归', '区分检索失败、生成失败和工具失败', '为高风险动作设计确认、鉴权、审计和撤销'],
    terms: ['Embedding', 'Retrieval Recall', 'Reranker', 'Prompt Injection', 'Tool Calling', 'Human-in-the-loop'],
  },
  12: {
    keyQuestions: ['怎样把需求、系统、数据、实验和风险串成一条证据主线？', '最大的技术未知如何用最小实验验证？', '作品集如何诚实表达结果、限制和下一步？'],
    layers: [
      { name: '概念与边界', objective: '定义问题、目标和非目标。', topics: ['用户与场景证据', '成功标准', '范围与约束', '事实、假设与未知'] },
      { name: '机制与链路', objective: '形成端到端方案。', topics: ['系统与数据流', '接口与状态机', '指标与实验', 'AI 评测与运营流程'] },
      { name: '证据与实验', objective: '验证最大不确定性。', topics: ['Technical Spike', '可运行原型', '基线、阈值与结果', '验证日志与决策记录'] },
      { name: '失败与评审', objective: '展示权衡与风险管理。', topics: ['隐私与权限', '数据质量与模型风险', '成本、延迟与容量', '监控、兜底、责任人与恢复'] },
    ],
    seniorTasks: ['用 10 分钟讲清问题—证据—方案—验证—权衡', '把每个结论标记为事实、推测或待验证', '让另一位同学按文档独立复现实验结果'],
    terms: ['Technical Spike', 'Architecture Decision Record', 'Risk Register', 'Acceptance Criteria', 'Operational Readiness', 'Evidence Boundary'],
  },
}
