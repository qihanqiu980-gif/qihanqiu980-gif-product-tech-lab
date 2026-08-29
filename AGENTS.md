# 产品技术实验室项目规则

## 项目使命与当前事实

本项目是面向零技术基础产品经理的 12 周、72 Day 本地交互式技术教材，目标是形成“理解系统关系 → 观察机制 → 独立操作 → 反馈纠错 → 间隔复测 → 工作迁移”的证据闭环。

当前事实以源码和验证脚本为准：2026-08-25 已开放 W1D1–W1D5、W3D1、W11D1–W11D6、W12D1–W12D6，共 18/72 Day。用户已亲自确认 W1D5、W11D1 与 W11D4，对应单日任务均已停止；阶段 01 仍是唯一 `active`，W1D6 未制作；阶段 03 仍为 `pending`，W3D1 是用户另行授权的跨阶段单日插入，W3D2 仍 missing。W3D1 是“打开 SQLite 实验环境／SQL 实验环境记录”单日插入，只首教终端、当前目录、路径、安全副本、SQLite 数据库文件、sqlite3 会话、setup.sql 和表/行/列最小预览，不提前教学 SELECT 执行顺序、筛选、排序、聚合、GROUP BY 或 JOIN。W11D2 已作为“工具调用／AI 调用图”冻结基线；W11D3 是“构建最小评测集／20 条评测样本”；W11D4 是“幻觉从哪里产生／失败分类表”冻结基线；W11D5 是“成本、延迟与安全／成本延迟安全风险建议表”单日插入；W11D6 是“评测 AI 客服／AI 客服综合评测报告”单日插入；W12D1 是“定义值得解决的问题／项目 Brief”单日插入；W12D2 是“系统与数据方案／system-data-plan.md”单日插入；W12D3 是“最大未知的可运行验证日志／validation-log.csv”单日插入；W12D4 是“风险登记册编写／risk-register.csv”单日插入；W12D5 是“跨职能评审与修订／review-notes.md”单日插入；W12D6 是“作品集装配、10 分钟答辩和复盘／portfolio-checklist.md”单日插入，且是 12 周核心课程终点，不定义 `nextLesson`，不创建 W13D1 或 W12D7。W3D1 专项门禁、Day01 框架、实现注册、TypeScript、inventory、`validate:all`、`build` 与五视口运行时验收已通过。阶段 06 与阶段 07 继续为 `pending`。W1D1 正式页已删除顶部预览工具行，其他冻结页面内容保持不变。旧周课提纲、ZIP 数量、可解析路由和聊天历史都不能替代 inventory。

## 必须使用的 Skill

涉及每日课程、阶段推进、课程注册、renderer/实验/证据适配器、课程库存、依赖或发布验收时，必须使用 `$product-learning-course-builder`。涉及课程页面、Today/复盘/进度/概念页的视觉或交互实现时，再使用 `$build-product-learning-pages`。

## 必读顺序

1. 本文件。
2. `specs/README.md` 与唯一活动阶段 Spec。
3. `PRODUCT.md`、`DESIGN.md`。
4. `00_学习资料/72日课程盘点与依赖审计.md` 的相关周次。
5. `src/course/types.ts`、`src/course/registry.ts`、`src/course/implementationRegistry.ts`。
6. 当前 Day 前一课和至少一个已开放同类 Day；涉及证据时再读 `src/evidenceStore.ts`，涉及页面时再读目标视图/组件。

## 权威事实源

- 产品与用户：`PRODUCT.md`
- 视觉交互：`DESIGN.md`
- 日课合同：`src/course/types.ts`
- 完整内容：`src/course/registry.ts`
- 已审核实现：`src/course/implementationRegistry.ts`
- 路由状态：`src/course/dayRouteState.ts`
- 学习/复习证据：`src/evidenceStore.ts`
- 真实库存：`npm run audit:course-inventory`
- 阶段范围与验收：`specs/*.spec.md`

旧 `data.ts`、周级提纲、题库、历史页面和实验包只能当素材，不能算 Day 完成。

## 标准推进顺序

1. 运行 `npm run audit:course-inventory`。
2. 在 `specs/README.md` 确认唯一活动阶段。
3. 用户指定 Day 时先处理该 Day；没有指定时才选择阶段内最早的 `content-missing` Day，并验证所有前置概念。
4. 先定义当天专属概念、实验、成果和证据，再写源码。
5. 同时完成内容注册、renderer、领域实验契约、v2 证据契约和实现注册。
6. 运行局部门禁、`npm run validate:all`、`npm run build`，再做浏览器验收。
7. 只有真实通过后更新 Spec 状态；不得用降低标准来换取“完成”。每轮只处理一个 Day，验证后停下等待用户确认。

## Day 可用状态机

```text
content-missing → 完整 DailyCourse 已注册
implementation-pending → renderer + 领域实验 + v2 证据契约通过且 reviewed
available
```

只能由注册表、实现注册表和验证器共同决定可学习状态，不能手改展示文案伪造。

## 每日课程合同

普通 Day 必须有 12 个语义教学字段：工作场景、目标、前置检查、完整概念、关系图、完整示范、引导实验、独立变式、针对性练习、反馈纠错、今日成果、记忆复习；完成核验是段外状态。后续 Day 的可见课程一律把这些语义字段编排为 Day 01 式两个学习时段、七章主目录，不得直接显示成 12/13 项目录。

- 首次教学早于实验、题目和成果要求；每个首次教学概念至少进入一项后续证据任务。
- 30/45 分钟是专注路径，不删减首次教学；45 分钟完整包含 30 分钟路径。
- 实验必须有预测、操作、观察、记录、解释、对照、通过标准和“能/不能证明什么”。
- 练习有逐项解释、常见错因和补学锚点；成果有字段教学、差稿、修订、合格稿、模板和自检。
- D1/D3/D7/D14/D30/D60 都有真实闭卷复测任务。

W1D1 是批准基准特例：冻结参考文件、7 章结构和 bridge 保持不变，正式可见页面仅允许下节记录的预览工具行差异。W1D2/W1D3 只能借鉴通用交互，不得复制内容、案例、题目和实验。

## 后续 Day 的 Day 01 框架与预览访问（2026-08-20）

- 用户点名 `$build-product-learning-pages` 或要求按 Day 01 完善某天时，默认复刻 Day 01 的两时段七章教学编排、桌面三栏/移动目录、学习—练习—复述—实操状态和清空重做。
- 复刻框架，不复制 W1D1 的正文、标题、例子、题目、实验和答案；当天内容必须独立。
- `available` 只取决于目标 Day 自身的内容与实现门禁。禁止根据前一天 `completedAt`、完成百分比、复习或掌握状态禁用入口。
- 前置不足显示提醒和补学，不把完整课程替换为未解锁页；内容缺失或实现未审核仍诚实显示缺课。
- 一次只新增或改造一个 Day；目标 Day 验证后停止，等待用户明确确认。

## W1D1 正式页面契约（2026-08-20）

- 冻结参考 `src/reference/w1d1-approved.html` 与 Base64 运输层不得修改；正式页面唯一授权的可见差异，是删除顶部“桌面／手机／设计评审／视觉修正版”整行预览工具。
- `W1D1Page.vue` 必须保留无文字、不可聚焦的 `data-device-choice` 与 `data-review-toggle` 兼容按钮，但 `.w1-preview-tools` 必须强制 `display:none!important`，不得残留空行、边框或伪元素。
- bridge 必须按真实视口通过原隐藏设备按钮同步模式：宽度 `<= 860px` 为 `mobile`，更宽为 `desktop`；该同步不得记录成用户学习操作。
- 不得改课程正文、左侧正式导航、课程顶栏、双时段信息、7 章顺序、桌面 sticky 路线、手机折叠目录、练习、复述、重置、状态或证据 bridge。
- 修改 W1D1 前先读 `.agents/skills/product-learning-course-builder/references/w1d1-formal-contract.md`；不得因旧基准仍含预览工具而把它恢复到正式页面。

## 证据与实现纪律

- 阅读、展开、字数、关键词、小游戏不直接代表掌握；D1/D3 不满足长期保持。
- 原始提交只追加，不覆写；重置只清理草稿和临时完成态，不删除历史证据或复习任务。
- 优先复用 `DailyCoursePage.vue`、`DailyLessonView.vue` 和 v2 账本，不建立平行注册表、路由、草稿库或掌握算法。
- `reviewed: true` 只能在人工审阅和验证后设置；不写入 Token、生产地址、真实公司数据、私有源码或未脱敏材料。

## 禁止机械生成

不得通过批量替换标题/术语/成果名生成多门课；不得把 W1D1 体量、周案例、答案文件、六步实验、旧 120 道题或空路由当作新 Day；不得在首次教学前使用 Network、API、并发、实验统计、RAG 或工具调用。

## 门禁

```bash
npm run validate:course-catalog
npm run validate:course-implementations
npm run validate:day-routes
npm run validate:evidence
npm run audit:course-inventory
npm run validate:all
npm run build
```

页面还需在 1440/1024/860/390/320px 验证七章深链、单一滚动、目录、30/45 切换、保存/刷新、重置、证据、键盘和无障碍，并验证前一天无完成记录时目标 Day 仍可打开。W1D1 回归还必须确认预览工具四类文案均不可见、隐藏兼容按钮仍存在、7 章未变且所有视口无横向溢出。`npm run build:release` 仅在 72/72 可用后运行。

## Spec 规则

每个阶段只有一个 Spec，状态只用 `pending`、`active`、`blocked`、`completed`；同一时间只能一个 `active`。完成阶段必须记录日期、available Day、验证命令、遗留风险和下一阶段入口。新跨阶段依赖要同步更新 Spec 与 `specs/README.md`。
