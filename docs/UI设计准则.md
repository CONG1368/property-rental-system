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

## 四、六条执行规则

- **Rule 1 排版**：标题字重 700、字距收紧；Dashboard 禁衬线体；正文行高 1.6。
- **Rule 2 用色**：单一强调色；中性基础统一冷灰，禁冷暖灰混用；页面标题用 `#1f2430`，数值强调用 `#4f7cf7`。
- **Rule 3 布局**：禁居中 Hero。登录页采用 Split Screen（左品牌区 + 右玻璃表单卡）。
- **Rule 4 材质（Anti-Card Overuse）**：卡片仅在需要层级时使用；玻璃面 = `background: rgba(255,255,255,.62)` + `backdrop-filter: blur(14px)` + 1px 白描边 + 外阴影/内高光；高密度表格区保持不透明以保证可读性。
- **Rule 5 交互态**：必须完整实现 loading / 空态 / 错误态；空态用 `.empty-state`（图标 + 标题 + 说明）而非一句灰字；按钮 `:active` 用 `translateY(-1px) scale(.98)`。
- **Rule 6 表单**：label 在 input 上方，错误提示在下方，输入块间距 8px。

## 五、维护约定

- 新增页面禁止硬编码旧色值（`#0A3D62` / `#F6B93B` / `#00B894` / `#FF6B35` / `#82CCDD` / `#1a5f8a`），一律引用 SCSS 令牌。
- 存量页面批量迁移用 `scripts/theme-migrate.cjs`（自动跳过 `components/print/`：打印模板面向纸质输出，保留深墨蓝）。
- 版本号唯一来源为根 `package.json`，前端通过 Vite `define` 注入 `__APP_VERSION__`，禁止在页面里写死版本字符串。
