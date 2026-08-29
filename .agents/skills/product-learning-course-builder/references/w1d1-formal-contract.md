# W1D1 正式页面契约

## 权威边界

- 将 2026-08-20 用户决定视为正式页最高优先级：删除顶部“桌面／手机／设计评审／视觉修正版”整行预览工具。
- 保持 `src/reference/w1d1-approved.html` 与 `src/reference/w1d1-approved.base64.txt` 不变；冻结参考仍包含原型评审工具，不代表正式页应恢复它们。
- 将 `src/views/W1D1Page.vue` 作为正式差异与路由／证据 bridge 的唯一实现位置。

## 唯一允许的可见差异

- 用无可见文字的兼容容器替换 `.w1-preview-tools` 原内容。
- 保留两个 `data-device-choice` 按钮和一个 `data-review-toggle` 按钮，设置不可聚焦并从辅助技术中隐藏，保证冻结脚本安全初始化。
- 为容器使用 `display:none!important`；单独使用 HTML `hidden` 不够，因为冻结作者样式会以 `display:flex` 覆盖它并留下 44px 空行和按钮边框。
- 不得增加替代工具栏、提示、状态卡或新的正式页面控件。

## 设备与交互

- 在 iframe 载入和 resize 时读取真实 `innerWidth`：`<= 860px` 选择 `mobile`，其余选择 `desktop`。
- 通过冻结脚本原有的隐藏设备按钮切换 `data-device`，不要复制或重写参考 CSS／交互状态机。
- 在 bridge 自动点击期间设置 replay 抑制，避免把设备同步保存成学习者操作。
- 保持正式左侧导航回接、证据草稿、章节访问和完成状态逻辑不变。

## 不可变项

- 课程标题、正文、双时段信息、7 章数量／顺序、右侧路线和手机折叠目录。
- 全部练习、复述、教学沙盒、三句结论、清空并重做、解锁和状态语义。
- 字体、间距、背景、桌面三栏、单一纵向滚动和 sticky 目录。
- `src/course/w1d1.ts`、`src/evidenceStore.ts`、`src/course/types.ts` 及历史学习证据。

## 验收

1. 运行 `npm run validate:w1d1`、`npm run validate:all` 和 `npm run build`。
2. 确认根 `index.html` 通过离线单文件门禁且 `externalRuntimeAssets` 为 0。
3. 在 1440/1024/860/390/320px 检查工具行不可见、7 章不变、桌面／手机形态正确且无横向溢出。
4. 检查桌面左栏与 sticky 路线、手机顶部课程栏与折叠目录，以及至少一条目录交互路径。
5. 报告冻结参考哈希、最终 `index.html` 哈希、关键 DOM 数量和任何浏览器协议限制。
