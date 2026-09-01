# UI 主题设计准则（湛蓝玻璃拟物）

> 本文是本项目前端视觉的唯一权威规范。新增页面/组件必须遵循，改造存量页面时按此对齐。
> 来源：better-design（语义 token + 品牌系统 + WCAG 门禁）与 design-taste-frontend（品牌材料库 + QA 门禁）两套设计准则的项目化落地。

## 一、全局基线

| 维度 | 取值 | 含义 |
|------|------|------|
| DESIGN_VARIANCE | 8 | 允许不对称、有变化的版式，禁死板居中 |
| MOTION_INTENSITY | 6 | 适中动效，交互有物理反馈 |
| VISUAL_DENSITY | 4 | 中等密度，数据不挤不空 |

## 二、铁律（CRITICAL）

1. **ANTI-EMOJI**：代码、模板、文案、alt 文本一律禁用 emoji，统一使用 Element Plus 线性图标（`@element-plus/icons-vue`）。历史 emoji 数据由 `utils/avatars.ts` 的 `resolveAvatarIcon()` 做兼容映射。
2. **THE LILA BAN**：禁"AI 紫/蓝紫"审美，禁紫色发光与霓虹渐变。
3. **最多 1 个强调色**，饱和度 < 80%。本项目强调色为湛蓝 `#4f7cf7`，语义色仅在状态表达时使用（success `#10b981` / warning `#f59e0b` / danger `#ef4444`）。

## 三、设计令牌（`frontend/src/styles/variables.scss`）

| 类别 | 令牌 | 值 |
|------|------|----|
| 强调 | `$color-primary` / `$color-accent` | `#4f7cf7` / `#3b66e0` |
| 背景 | `$color-bg` / `$color-bg-fixed` | `linear-gradient(135deg,#e3ecfb,#dbe6f8 45%,#e0edf7)` / `#dde7f5` |
| 玻璃面 | `$color-bg-elev` / `$color-bg-elev-strong` | `rgba(255,255,255,.62)` / `rgba(255,255,255,.78)` |
| 描边 | `$color-border` / `$color-border-soft` | `rgba(255,255,255,.72)` / `rgba(255,255,255,.5)` |
| 文字 | `$color-text-title` / `$color-text-body` / `$color-text-aux` | `#1f2430` / `#3a4354` / `#5b6472` |
| 圆角 | `$radius-sm` / `$radius-md` / `$radius-lg` | 8px / 14px / 20px |
| 阴影 | `$color-shadow` + `$color-shadow-inset` | `0 8px 32px rgba(31,41,55,.14)` + `inset 0 1px 0 rgba(255,255,255,.55)` |

Element Plus 变量在 `global.scss` 的 `html:root` 中整体覆盖，禁止在页面内重复定义主题色字面量。

### 无障碍文字变体（WCAG 2.1 AA）

原色（`$color-primary` / `$color-success` / `$color-warning` / `$color-danger`）在浅玻璃底上**只满足 UI 组件门槛 3:1**，作正文会低至 1.72:1。因此拆成两组用途：

| 用途 | 令牌 | 值 | 允许场景 |
|------|------|----|----------|
| 主色文字/链接 | `$color-primary-text` / `$color-primary-text-hover` | `#2b57c9` / `#1e50bd` | 正文、链接、文字型按钮、选中态文字 |
| 成功/警告/危险文字 | `$color-success-text` / `$color-warning-text` / `$color-danger-text` | `#0a7652` / `#8a5200` / `#bf2626` | 状态文字、细线图标、实心按钮底 |
| 控件边界 | `$color-border-control` | `#6f8299` | 输入框/选择器等交互控件描边（SC 1.4.11 强制 ≥3:1） |
| 深色顶栏元素 | `$color-on-dark-primary` / `$color-on-dark-danger` | `#a8c2fc` / `#fca5a5` | 顶栏上的主色徽标、红点 |
| 次要文字 | `$color-text-subtle` | `#5f6675` | 占位符、辅助说明（原 `#8b93a3` 仅 2.47:1） |

**原色继续用于**：填充、标签底、图表系列色、进度条、KPI 大号数值。白描边 `$color-border` 仅作装饰轮廓，不可用作功能性边界。

## 四、六条执行规则

- **Rule 1 排版**：标题字重 700、字距收紧；Dashboard 禁衬线体；正文行高 1.6。
- **Rule 2 用色**：单一强调色；中性基础统一冷灰，禁冷暖灰混用；页面标题用 `#1f2430`，数值强调用 `#4f7cf7`。
- **Rule 3 布局**：禁居中 Hero。登录页采用 Split Screen（左品牌区 + 右玻璃表单卡）。
- **Rule 4 材质（Anti-Card Overuse）**：卡片仅在需要层级时使用；玻璃面 = `background: rgba(255,255,255,.62)` + `backdrop-filter: blur(14px)` + 1px 白描边 + 外阴影/内高光；高密度表格区保持不透明以保证可读性。
- **Rule 5 交互态**：必须完整实现 loading / 空态 / 错误态。首屏加载用 `<TableSkeleton>`（骨架屏，禁用通用转圈）；空数据用 `<EmptyState>`（图标 + 标题 + 引导说明，必要时带操作按钮），二者均为全局自动注册组件，位于 `components/common/`；按钮 `:active` 用 `translateY(-1px) scale(.98)`。
  标准接法：`<TableSkeleton v-if="loading && !list.length" />` + `<el-table v-show="!(loading && !list.length)">` + `<template #empty><EmptyState ... /></template>`。
- **Rule 6 表单**：label 在 input 上方，错误提示在下方，输入块间距 8px。

## 五、维护约定

- 新增页面禁止硬编码旧色值（`#0A3D62` / `#F6B93B` / `#00B894` / `#FF6B35` / `#82CCDD` / `#1a5f8a`），一律引用 SCSS 令牌。
- 存量页面批量迁移用 `scripts/theme-migrate.cjs`（自动跳过 `components/print/`：打印模板面向纸质输出，保留深墨蓝）。
- 版本号唯一来源为根 `package.json`，前端通过 Vite `define` 注入 `__APP_VERSION__`，禁止在页面里写死版本字符串。
- 新增页面的文字色必须使用无障碍变体（见上表），提交前跑 `node scripts/check-contrast.cjs`（全通过退出码 0，可作 CI 门禁）；批量迁移用 `scripts/apply-a11y-colors.cjs`。
- 新增列表页用 `node scripts/apply-loading-states.cjs`（支持 `--dry` 预演）自动接入骨架屏与空态，接入后跑 `node scripts/verify-ux-states.cjs` 验收。
