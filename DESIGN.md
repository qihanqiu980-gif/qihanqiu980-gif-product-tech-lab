---
name: 产品技术实验室
description: 面向产品经理的工程蓝图式本地技术学习工作台
colors:
  engineering-paper: "#eef1f2"
  paper-depth: "#e2e7e8"
  lab-surface: "#f9faf9"
  white-surface: "#ffffff"
  blueprint-ink: "#142d3d"
  secondary-ink: "#49616f"
  annotation-ink: "#5d717b"
  engineering-navy: "#123b54"
  deep-console-navy: "#09293d"
  action-orange: "#e66a2c"
  deep-action-orange: "#b74616"
  action-orange-pale: "#fbe8dd"
  fault-red: "#c83f36"
  fault-red-pale: "#f9e6e3"
  verified-green: "#277b61"
  verified-green-pale: "#e0f1eb"
  blueprint-blue-pale: "#dfeaf0"
  structural-line: "#b9c6cc"
  structural-line-strong: "#8498a2"
typography:
  display:
    fontFamily: "Noto Sans SC Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "clamp(40px, 4vw, 60px)"
    fontWeight: 820
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Noto Sans SC Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.35
  body:
    fontFamily: "Noto Sans SC Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Noto Sans SC Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.4
  measurement:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  annotation: "4px"
  control: "7px"
  field: "8px"
  action: "9px"
  module: "10px"
  console: "11px"
  section: "12px"
  panel: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "24px"
  xxl: "36px"
components:
  button-primary:
    backgroundColor: "{colors.action-orange}"
    textColor: "{colors.white-surface}"
    rounded: "{rounded.action}"
    padding: "0 17px"
    height: "42px"
  button-secondary:
    backgroundColor: "{colors.white-surface}"
    textColor: "{colors.engineering-navy}"
    rounded: "{rounded.action}"
    padding: "0 17px"
    height: "42px"
  field-default:
    backgroundColor: "{colors.white-surface}"
    textColor: "{colors.blueprint-ink}"
    rounded: "{rounded.field}"
    padding: "11px 12px"
  panel-lab:
    backgroundColor: "{colors.lab-surface}"
    textColor: "{colors.blueprint-ink}"
    rounded: "{rounded.panel}"
    padding: "28px"
  panel-console:
    backgroundColor: "{colors.deep-console-navy}"
    textColor: "{colors.white-surface}"
    rounded: "{rounded.console}"
    padding: "14px 16px"
---

# Design System: 产品技术实验室

## Overview

**Creative North Star: "工程蓝图上的实验记录"**

这套界面像一张正在被使用的工程图纸：关系、阶段和证据被清楚标注，学习者可以沿着线路看懂系统，而不是面对一堆彼此孤立的课程卡片。冷静的蓝灰纸面承担阅读，深海军蓝承载控制台与工作协议，橙色只用于动作、当前观察点和需要注意的证据。

界面同时保留实验记录的触感。编号、状态码、耗时和接口地址使用测量式等宽字；中文标题使用清晰的无衬线字体和明确字重，可读性优先；功能说明保持自然、克制、面向零基础用户。视觉表达服务于“观察—操作—判断—复盘”，不把课程包装成游戏化打卡产品。

W1D1 起，主学习表面从“实验仪表盘”收敛为“清晰的交互式教材”。正文是视觉中心，固定目录承担长文导航，深色控制台只在真正操作的教学沙盒出现。请求链、Network 和每周观察器属于旧课历史表面，在后续 Day 重写后只会出现在具备前置知识的对应课程中，不再先于首次概念教学。

复盘、进度与概念索引采用同一条“证据诚实”原则：提交卡只呈现不可变原始证据与逐项量规；进度卡明确区分页面完成、证据覆盖和 L3 掌握；概念索引只显示权威注册表中的完整日课。缺课数量和待审核状态使用克制的文本与线框表达，不使用庆祝、徽章或游戏化进度暗示。

**Key Characteristics:**

- 工程关系优先于装饰，关键链路必须一眼可追踪。
- 明亮纸面负责理解，深色实验台负责证据与操作。
- 橙色稀缺而明确，只标记当前状态、主要动作与重点追问。
- 字体、线条、状态码与实验标签共同形成“蓝图＋记录”的现场感。
- 所有模拟数据和接口证据均明确标记为“教学模拟”。

## Colors

颜色系统以冷蓝灰图纸为背景，以海军蓝建立技术可信度，以工程橙提示动作，并使用红、绿表达故障与验证结果。

### Primary

- **工程海军蓝：**用于侧栏、学习协议、控制台标题与主要结构，是稳定的系统骨架。
- **动作橙：**用于主要按钮、当前步骤、活动节点与重要产品追问；不用于大面积铺底。

### Secondary

- **验证绿：**只表示正确、成功、已通过或已掌握。
- **故障红：**只表示错误、危险操作或失败证据。

### Neutral

- **工程纸面：**页面基底，带有单轴水平刻度线以强化实验记录语境。
- **实验白：**卡片、字段与可读内容的主要表面。
- **蓝图墨色：**标题与正文的核心前景色。
- **结构线：**分隔阶段、表格单元和可交互边界，不承担装饰。

**The Sparse Signal Rule.** 橙、红、绿都是状态信号，不得互相替代，也不得同时大面积出现。

**The Honest Simulation Rule.** 教学接口、日志、耗时和响应必须在相邻位置显示“教学模拟”，不能让学习者误以为是真实生产证据。

## Typography

**Display Font:** Noto Sans SC Variable（后备 PingFang SC、Microsoft YaHei）  
**Body Font:** Noto Sans SC Variable（后备 PingFang SC、Microsoft YaHei）  
**Label/Mono Font:** SFMono-Regular（后备 Consolas、Liberation Mono）

**Character:** 标题与正文统一使用清晰的中文无衬线字体，通过字重、字号、留白和色彩建立层级；等宽字只承担编号、代码、日期、测量和状态。可读性优先于装饰性字体个性。

### Hierarchy

- **Display**（800–820，响应式 40–60px，行高 1.12）：页面唯一主标题，移动端收敛到 32–42px。
- **Headline**（780–800，约 25–36px）：课程模块、节点解释与实验段落标题。
- **Title**（中等视觉权重，18–25px）：面板和卡片内部标题。
- **Body**（400，基线17px，行高 1.7–1.85）：概念说明、场景描述与反馈，正文长度控制在约 65–68ch。
- **Lesson Body**（400，18px，行高 1.75–1.9）：完整课程、实验说明、案例与题目；用于降低长时学习的阅读压力。
- **Label**（600–700，12–14px）：按钮、任务、字段和导航；动作名称必须具体。
- **Measurement**（400，12px）：W编号、状态码、耗时、接口、日期和实验注释；不再使用低于 12px 的可见文字。

**The Measurement Only Rule.** 等宽字体只用于代码、数据与测量信息，不能作为“技术感”装饰正文。

**The One Display Voice Rule.** 页面级标题和关键模块标题使用展示字体；长文本、表单和反馈永远使用正文字体。

## Layout

桌面采用固定 224px 深色侧栏与最大 1300px 内容画布，主内容使用 42px 起始留白和 28–66px 响应式横向边距。Today 首屏只突出今天应学的 Day、继续学习和复盘/证据入口；日课正文以稳定目录、受控阅读宽度和连续教学段为中心，只有真实操作区才使用更宽的实验布局。课程路线使用账本式横向行，而不是等尺寸卡片墙。

间距以 4、8、12、18、24、36px 为核心节奏：字段内部紧凑，模块之间留白明显。1120px 以下日课辅助栏与主内容转为单栏；820px 以下隐藏侧栏、启用固定底部五项导航；560px 以下任务、表单、关系图与证据面板变为单列。375px 必须保持无页面级横向滚动，代码、关系图、表格和后续 Network 证据只允许在自身容器内横向浏览。

**The Relationship First Rule.** 当内容表达顺序、阶段或因果时，优先使用线路、账本、表格和连续面板；只有独立内容才使用卡片。

## Elevation & Depth

深度采用“纸张叠层＋结构分隔”的混合方式。主要实验面板使用低对比、带垂直偏移的柔和阴影；控制台依靠深色层级与内部边线形成深度；协议内嵌在实验主面板时不重复添加阴影。

### Shadow Vocabulary

- **实验面板悬浮：**`0 14px 36px rgba(23, 52, 69, 0.11)`，用于首要工作面板和独立的大型表面。
- **记录纸轻层：**`0 8px 22px rgba(23, 52, 69, 0.07)`，用于搜索框、词典条目和次级控制台。
- **动作抬升：**`0 7px 16px rgba(183, 70, 22, 0.20)`，只用于主要橙色动作。

**The Single Depth Cue Rule.** 一个表面使用阴影或结构边线建立层级，不叠加宽阴影与完整描边制造“幽灵卡片”。

## Shapes

界面使用轻度机械圆角：字段和小控件为 7–9px，实验模块为 10–12px，页面级面板为 14px。圆角用于降低密集技术信息的压迫感，但不得把所有容器变成胶囊；圆形只用于进度节点、状态点和小型计数。

蓝图线条通常为 1px，活动侧栏标记为 3px；不使用粗彩色侧边框装饰信息卡。Network、日志和链路节点保持清晰的矩形轮廓与可测量边界。

## Components

### Buttons

- **Shape:** 稳定的小圆角矩形（9px），主要操作最小高度 42px。
- **Primary:** 动作橙底、白字、17px 水平内边距；悬停时转为深橙，禁用时降低透明度并移除阴影。
- **Secondary:** 白色实验表面、海军蓝文字与结构线描边；悬停时转为浅蓝纸面。
- **Focus:** 所有按钮使用清晰的半透明橙色 3px 焦点环，外偏移 3px。

### Chips

- **Style:** 小型状态标签使用 4–7px 圆角，不使用胶囊作为普通容器。
- **State:** 权重、掌握等级与“教学模拟”均由文字和语义色共同表达，不能只依赖颜色。

### Cards / Containers

- **Corner Style:** 页面主面板为 14px；内部模块为 10–12px。
- **Background:** 阅读表面使用实验白；操作协议使用工程海军蓝；控制台使用深控制台蓝。
- **Shadow Strategy:** 页面级独立面板使用实验面板悬浮，嵌套模块保持平面。
- **Border:** 结构边界为 1px 蓝灰线；活动节点可切换为橙色边界。
- **Internal Padding:** 主面板通常 24–30px，移动端收敛至 16–22px。

### Inputs / Fields

- **Style:** 白色背景、1px 结构线、8px 圆角、11×12px 内边距。
- **Focus:** 使用统一橙色焦点环，字段边界保持可见。
- **Error / Disabled:** 错误使用故障红与可执行的恢复文案；禁用降低透明度但保留标签可读性。

### Navigation

桌面侧栏使用深控制台蓝，活动项以更亮的海军蓝表面、白色文字和 3px 橙色位置标记表示。移动端使用固定五栏底部导航，活动项通过白字和顶部 3px 橙线同时表达。导航图标保持统一的 1.7px 线性 SVG 风格。

### Request Chain

请求链路不是全局装饰或首页标志，只能出现在完成 URL、HTTP、API、后端与数据库首次教学后的对应 Day。使用时，节点、连接、正常/异常分支和可观察证据必须形成一个连续阅读单元；动画只用于解释机制，减少动态效果时仍须通过静态状态清楚表达当前位置。W1D1 不使用该组件诊断网络。

### Network Console

Network 控制台只在 W1D5 及后续具备 HTTP 前置知识的课程中使用。每列首次出现时必须先解释 Method、URL、Status、Type、Initiator、Size 与 Timing 的含义、证据边界和常见误判；不能把预填的 GET、200、耗时或响应大小当成学习者已经理解的证据。控制台使用深色表面、等宽测量信息、状态码语义色和明确的“教学模拟”标签；表格只在自身容器内横向滚动。

### Interactive Observer

观察器不是每周必配组件。只有当调整参数并查看中间过程能显著帮助理解时才使用；控件标题、当前值、变量含义、输入输出和证据边界必须同时可见，变量变化必须改变至少一个可解释的中间状态或结论。不能用装饰性滑块代替概念正文、教师示范或真实代码连接，所有模拟结果都要明确标记为教学模拟。

## Do's and Don'ts

### Do:

- **Do** 让每个概念紧邻一个产品场景、一个可操作动作和一条可观察证据。
- **Do** 使用线路、状态码、日志、表格和标注表达系统关系。
- **Do** 保持橙色动作、绿色验证、红色故障的语义稳定。
- **Do** 在桌面和 375px 移动端同时验证真实中文文案与长技术词。
- **Do** 为键盘焦点、减少动态效果、错误恢复和空状态保留明确路径。

### Don't:

- **Don't** 使用装饰性插图、渐变字、玻璃拟态或无意义的技术网格填充界面。
- **Don't** 用同尺寸“图标＋标题＋说明”卡片堆叠整页课程结构。
- **Don't** 在标题上方增加“主图解”“实验”“工作迁移”等 eyebrow 标签。
- **Don't** 用等宽字体书写长段正文，或使用 emoji / Unicode 字符冒充图标系统。
- **Don't** 把教学模拟的接口、日志、耗时或响应包装成真实公司证据。
