---
name: product-learning-course-builder
description: 为“产品技术实验室”按 Day 01 两时段七章体系逐日规划、生成、改造、审阅和验收每日课程，同时维护 DailyCourse、renderer、实验、证据、跨日预览访问、阶段交付及 W1D1 正式页面基准。Use when Codex needs to create or revise any W1D2–W12D6 DailyCourse, continue exactly one next Day, register renderer/experiment/evidence adapters, update a stage spec, audit course availability, keep a completed Day previewable without prior-Day completion, decide whether a Day or stage is publishable, or modify/regress the W1D1 formal page. Also trigger for “使用这个 skill”“按 Day01 完善某天”“生成下一天课程”“补齐课程内容”“按 Spec 验收”“更新 72 日进度”“回归 W1D1”。
---

# 产品技术实验室课程生产

## 读取事实源

按顺序读取：项目 `AGENTS.md` → `specs/README.md` 与活动阶段 Spec → `PRODUCT.md`/`DESIGN.md` → 相关周次的依赖审计 → `src/course/types.ts`、`registry.ts`、`implementationRegistry.ts` → 目标 Day 前一课和一个已开放同类 Day。涉及证据读 `src/evidenceStore.ts`，涉及页面读目标视图和共享组件。页面任务同时使用 `$build-product-learning-pages` 并读取其 `references/day01-course-framework.md`；涉及 W1D1 时再完整读取 `references/w1d1-formal-contract.md`。

## 后续 Day 默认复刻 Day 01 框架

- 保留 12 个 DailyCourse 语义字段作为内容、验证和证据合同，但把它们编排为两个学习时段、七个可见章节。
- 七章依次承担：建立任务、心智模型一、心智模型二、第一次复述、操作模型、责任/证据边界、实验/迁移/最终复述。
- 右侧与移动主目录只显示七章，并分别表达学习、练习、复述和实操状态；不得直接暴露 12/13 项内部字段。
- 复刻框架但不复制 W1D1 的标题、正文、例子、题目、实验和答案。
- 一次只新增或改造一个 Day；目标 Day 验证后停止，等待用户确认。

## 允许提前观看

- `available` 只由目标 Day 自身的完整内容、renderer、领域实验、schema v2 证据适配器和 `reviewed` 决定。
- 禁止读取前一天的 `completedAt`、完成百分比、复习状态或掌握等级来禁用后续 Day 路由。
- 前置知识不足显示提醒和补学入口，不把完整目标 Day 替换为“未解锁”页。
- 内容缺失或实现待审核的 Day 仍显示诚实缺课状态，不用空壳伪装预览。

## 保持 W1D1 正式基准

- 保持冻结参考文件不变，只在正式 bridge 中实现 2026-08-20 用户授权的唯一可见差异：删除顶部整行预览工具。
- 保留隐藏兼容按钮并让 `.w1-preview-tools` 强制不参与布局；按 `<= 860px` 手机、其余桌面的规则，通过原隐藏设备按钮同步模式。
- 禁止恢复“桌面／手机／设计评审／视觉修正版”可见文字，禁止改课程正文、左右导航、7 章路线、练习、复述、重置和证据接口。
- 按 `references/validation-matrix.md` 完成专项门禁、构建与多断点运行时回归。

## 选择任务与下一项

- 只写方案：只更新 `specs/`，不改课程源码或开放路由。
- 生成/修改 Day：必须闭环内容、实现、证据、注册、验证和状态文档。
- 阶段验收：逐 Day 检查完成定义，不能以文件数或路由数替代 `availableIds`。
- 发布：只有 72/72 可用才运行 `npm run build:release`。

先运行 `npm run audit:course-inventory`。用户指定某个 Day 或要求改造现有 Day 时以该目标为准；没有指定时才在唯一活动阶段中选择最早的 `content-missing` Day。前置不成立就先修正依赖，不得在正文、实验或题目中偷跑概念。无论目标来源如何，每轮只处理一个 Day。

## 生成单个 Day

### 先写课程契约

先明确当天工作场景、首次教学概念与硬前置、30/45 分钟路径、专属引导实验和独立变式、成果受众/字段/标准、自动判定与人工审核边界，以及 D1/D3/D7/D14/D30/D60 复测任务。详细门槛见 `references/day-definition-of-done.md`。

### 再实现接口

1. 新建 `src/course/w<week>d<day>.ts`，使用 `DailyCourse`，保持 Day/概念/练习 ID 唯一。
2. 在 `src/course/registry.ts` 注册完整内容，不注册提纲或空壳。
3. 提供真实 Vue renderer、领域实验契约和 schema v2 证据契约。
4. 在 `src/course/implementationRegistry.ts` 注册实现；人工审阅和验证后才设置 `reviewed: true`。
5. 优先复用 `DailyCoursePage.vue` 与正式证据适配；后续 Day 的可见 renderer 必须通过 Day 01 七章适配，只有领域交互无法表达时才新增专属组件。
6. 不建立第二套课程状态、路由、草稿或掌握算法。

### 保持证据诚实

阅读、展开、字数、关键词和小游戏都不能直接显示“掌握”。原始提交只追加，审核结论引用不可变提交；重置只清理草稿和临时完成态，不删除历史 attempt、assessment 或 review task。实验写清“能证明什么/不能证明什么”。

### 验证与阶段完成

先跑相关门禁，再跑：

```bash
npm run validate:course-catalog
npm run validate:course-implementations
npm run validate:day-routes
npm run validate:evidence
npm run audit:course-inventory
npm run validate:all
npm run build
```

页面改动还要在 1440/1024/860/390/320px 验证七章目录、单一滚动、无横向溢出、目录定位、30/45、保存/刷新、重置、键盘和可访问名称；清空前一天完成状态后仍要能从路线和深链打开目标 Day。W1D1 还要验证预览工具不可见、隐藏兼容按钮存在、桌面／手机模式随真实视口同步且 7 章未变。阶段只有在所有 Day 进入 `availableIds`、功能达标、全量门禁/构建/浏览器验收通过且 Spec 写入实际结果和风险后才能改为 `completed`。

## 禁止事项

- 不复制 W1D1/W1D2/W1D3 的正文、案例、题目或实验。
- 不用批量替换标题/术语/成果名生成多门课。
- 不把 ZIP、答案、模板、旧周课或可解析路由算作完整 Day。
- 不为凑 72 个路由生成空页面或把 `reviewed` 当作自我声明。
- 不删除冻结基准、v1 历史、v2 证据和已有学习记录。
- 不在同一轮顺带创建、改写或开放目标 Day 的下一天。
