# 验证命令矩阵

| 改动 | 命令 | 重点 |
|---|---|---|
| DailyCourse | `npm run validate:course-catalog` | ID、依赖、练习、复习、反机械复制 |
| renderer/实验/证据 | `npm run validate:course-implementations` | loader 与契约可执行 |
| 路由 | `npm run validate:day-routes` | 深链往返、available 状态与不依赖前一天完成的预览访问 |
| 七章框架 | `npm run validate:day01-framework` | 两时段七章、12 字段映射、独立内容与单日范围 |
| 证据 | `npm run validate:evidence` | 追加历史、阶段、到期日 |
| W1D1 | `npm run validate:w1d1` | 冻结参考不漂移；正式页预览工具不可见、兼容按钮保留、设备随视口同步、7 章不变 |
| W3D1 | `npm run validate:w3d1`、`npm run validate:w3d1:runtime` | SQLite 环境主题、`sql-lab-runlog.md` 13 字段合同、六条环境教学模拟路径、追加历史、48 项复习、五视口工作台验收、后续推进时保护 W3D2 缺失 |
| W11D3 | `npm run validate:w11d3` | 最小评测集主题、20 条样本合同、六路径集合门禁、追加历史、48 项复习、23 个冻结哈希 |
| W11D4 | `npm run validate:w11d4` | 失败分类主题、6 行分类表合同、六类失败路径、追加历史、48 项复习、26 个冻结哈希 |
| W11D5 | `npm run validate:w11d5` | 成本延迟安全主题、6 行风险建议表合同、六类风险路径、追加历史、54 项复习、29 个冻结哈希 |
| W11D6 | `npm run validate:w11d6` | 评测 AI 客服主题、6 行综合评测报告合同、六段报告路径、追加历史、48 项复习、32 个冻结哈希、后续推进时保护 W12D5 缺失 |
| W12D1 | `npm run validate:w12d1` | 定义值得解决的问题主题、project-brief.md 13 字段合同、六条 Brief 质量路径、追加历史、48 项复习、35 个冻结哈希、后续推进时保护 W12D5 缺失 |
| W12D2 | `npm run validate:w12d2` | 系统与数据方案主题、system-data-plan.md 13 字段合同、六条系统与数据方案路径、追加历史、48 项复习、W12D1/W11D6 冻结哈希、后续推进时保护 W12D5 缺失 |
| W12D3 | `npm run validate:w12d3` | 最大未知的可运行验证日志主题、validation-log.csv 13 字段合同、六条可运行验证日志路径、追加历史、48 项复习、W12D1/W12D2 冻结哈希、后续推进时保护 W12D5 缺失 |
| W12D4 | `npm run validate:w12d4` | 风险登记册编写主题、risk-register.csv 13 字段合同、六条风险登记质量路径、追加历史、48 项复习、W12D2/W12D3 冻结哈希、W12D5 缺失 |
| W12D5 | `npm run validate:w12d5` | 跨职能评审与修订主题、review-notes.md 13 字段合同、六条评审纪要质量路径、追加历史、48 项复习、W12D2/W12D3/W12D4 冻结哈希、后续推进时允许 W12D6 available |
| W12D6 | `npm run validate:w12d6` | 作品集装配、10 分钟答辩和复盘主题、portfolio-checklist.md 13 字段合同、六条作品集装配质量路径、追加历史、48 项复习、W12D3/W12D4/W12D5 冻结哈希、无 nextLesson、无 W13D1/W12D7 |
| 实验包 | `npm run validate:lab-packages`、`npm run validate:lab-downloads` | ZIP、目录、下载一致 |
| 路径/启动 | `npm run validate:project-paths`、`npm run validate:startup-scripts` | 固定端口与入口 |
| 全量 | `npm run validate:all`、`npm run build` | 静态门禁与单文件构建 |
| 72 日发布 | `npm run validate:course-complete`、`npm run build:release` | 只在 72/72 后运行 |

## 浏览器验收

每个新增页面检查 1440/1024/860/390/320px：七章深链、主滚动/目录、30/45、输入保存、刷新恢复、清空并重做、attempt/assessment/review task、返回路线、移动目录、键盘/焦点/可访问名称、横向溢出和控制台错误。另以“前一天无完成记录”状态打开目标 Day，确认路线按钮和深链均未锁定。静态校验不能替代运行时结论。

W1D1 额外检查：`.w1-preview-tools` 不可见且尺寸为 0；“桌面／手机／设计评审／视觉修正版”在可见文本中均为 0；隐藏的 2 个 `data-device-choice` 与 1 个 `data-review-toggle` 仍存在；1440/1024px 为桌面三栏，860/390/320px 为原手机形态；桌面和手机路线各 7 项，文档宽度不超过视口。
