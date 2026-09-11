# UI 主题设计准则（冷调中性 · 令牌 v2）

> 本文是本项目前端视觉的**唯一权威规范**。新增页面/组件必须遵循；改造存量页面时按此对齐。
> 本版为**令牌 v2**（冷调中性 · 现代极简），取代 v1 的「湛蓝玻璃拟物」；v1 的玻璃卡片与 `$color-*` 命名已全部废弃。
> 配套：`frontend/src/styles/variables.scss`（SCSS 令牌）、`styles/global.scss`（EP 覆盖 + CSS 变量镜像）、`styles/tokens.ts`（JS 镜像）。

## 一、一句话

**保留湛蓝、砍掉玻璃卡片、补上中间层。**
颜色按「中性阶 + 品牌 + 语义 + 房态阶」收成一套全局令牌；玻璃只留给应用外壳；界面类型只切密度、不切颜色；列表页默认**组装组件**而不是新建样式。

## 二、铁律（CRITICAL）

1. **ANTI-EMOJI**：代码、模板、文案、alt 一律禁用 emoji，统一用 `@element-plus/icons-vue` 线性图标。
2. **颜色字面量只允许出现在令牌文件**：`styles/variables.scss`、`styles/global.scss`、`styles/tokens.ts`。其它任何文件**不得出现 `#hex` / `oklch()` / `rgb()` / `rgba()`**——由门禁 **R2** 强制；打印模板 `components/print/**` 按纸质输出豁免。
3. **每屏最多 2 处品牌强调色**，只用于主操作与链接。
4. **不做深色模式、不做模块识别色、不做模块专属图表主题**（理由见第七节）。
5. **不重写** `components/common/EmptyState.vue`、`components/common/TableSkeleton.vue`、`components/print/**`。

## 三、令牌 v2

### 3.1 中性阶（唯一色相 250）

| 令牌 | 值 | 用途 |
|---|---|---|
| `$n-0` | oklch(100% 0 0) | 卡片 / 弹层净表面 |
| `$n-50` | oklch(98.4% 0.003 250) | 页面底 |
| `$n-100` | oklch(96.5% 0.005 250) | 表头 / 骨架底 |
| `$n-200` | oklch(92% 0.006 250) | 分割线、卡片描边（**不做控件边界**）|
| `$n-300` | oklch(85% 0.008 250) | 弱化装饰 |
| `$n-400` | oklch(64% 0.012 250) | **控件边界**（实测 3.21:1，满足 WCAG SC 1.4.11 ≥3:1）|
| `$n-500` | oklch(56% 0.012 250) | 禁用态文字 |
| `$n-600` | oklch(52% 0.012 250) | 次要文字（5.23:1）|
| `$n-700` | oklch(40% 0.012 250) | 正文 |
| `$n-900` | oklch(21% 0.012 250) | 主文字（16.90:1）|

**文字只允许 `$n-900` / `$n-700` / `$n-600`；`$n-400` 专供控件边界。**

> 注：v2 定稿时 `$n-400` 原为 75%（实测仅 2.12:1，不达标），已压深到 64%；`$n-500` 相应调到 56% 以免与 600 档撞车。

### 3.2 品牌（唯一强调色，每屏 ≤2 处）

| 令牌 | 值 | 用途 |
|---|---|---|
| `$brand-100` | oklch(94% 0.03 255) | 浅底填充 |
| `$brand-300` | oklch(80% 0.08 255) | 边框 / hover 底 |
| `$brand-600` | oklch(46% 0.15 255) | 主操作 / 链接（白字 7.22:1）|
| `$brand-700` | oklch(40% 0.15 255) | hover |

**成对规则**：浅档（100/300）配 `$n-900`；深档（600/700）配白字；中间明度不配白字。

### 3.3 语义（只表达状态，不做图表系列色）

`$ok-100/$ok-600`、`$warn-100/$warn-600`、`$bad-100/$bad-600`、`$info-100/$info-600`。
600 档即「文字安全档」（白字 5.94–7.37:1，作正文 5.72–7.05:1）。**v1 的 `-text` 无障碍变体已被 v2 的 600 档吸收，不再单列。**

### 3.4 房态生命周期阶（唯一的业务流程色阶，全模块复用）

`$st-vacant`（空置）/ `$st-locked`（已锁定）/ `$st-booked`（已预订）/ `$st-rented`（已出租）。
配对：前三档配 `$n-900`（6.15–14.40:1）；`$st-rented` 配白字（4.92:1）。维修中走 `$bad`、已冻结走 `$info`、退租中走 `$warn`，待保洁 / 待验收走中性 + 斜纹（过渡态，不占用状态色）。

**落地（唯一实现）**：`styles/global.scss` 的 `.room-chip--{vacant,locked,booked,rented,ending,cleaning,inspecting,maintenance,frozen}`；房态 → 色调的映射唯一来源是 `components/modules/room/room-status.ts` 的 `ROOM_STATUS_MAP` / `roomStatusClass()`——**房态词汇只允许出现在这里**。`StatusTag` 收到 `className` 时渲染 `<span>` 做令牌着色，否则仍走 Element Plus 标签。

### 3.5 非颜色令牌

- 阴影三档：`$sh-0`（无）/ `$sh-1`（浮起，必须对应真实可点击）/ `$sh-2`（覆盖：弹层 / 抽屉）
- 玻璃：`$glass`（**仅侧栏 / 抽屉 / 弹层可用**，且**半透明底与 `backdrop-filter` 必须成对出现**——不透明面板上的模糊无效，只半透明不模糊则会糊）；**顶栏为品牌实色 `$brand-600`**——这是唯一允许大面积使用品牌色的位置；遮罩 `$scrim`（已接到 `--el-overlay-color-lighter`，是玻璃浮层三层合成的基准）
- 字号三级：`$fs-page 22` / `$fs-section 15` / `$fs-body 13.5`（中文下限）/ `$fs-meta 12`；行高 `$lh-body 1.7`
- 字体：`$font-display` / `$font-body` / `$font-mono`
- 圆角：`$r-ctl 6`（控件）/ `$r-box 10`（卡片）/ `$r-panel 14`（面板）——**控件圆角恒小于容器**

### 3.7 暗色面阶（唯一例外：房态大屏）

`$d-bg`（画布）/ `$d-surface`（面板）/ `$d-raised`（面板内浮起）/ `$d-line`（分割线与描边）/ `$d-text` / `$d-text-2` / `$d-text-3`。

**为什么单列一套**：亮色阶 `$n-*` 是**单向**的（`$n-0` 最亮＝面 → `$n-900` 最深＝字）。把它倒过来当暗色用必然失衡——字压面只剩 2–3:1，这正是大屏此前「数字发灰、面板糊成一坨」的根因。暗色需要「相邻档只差 5–7%」的独立曲线，故单列；色相仍锁 250，与全站同一冷调。

**语义在暗底上的档位**：亮底前景用 600 档，暗底前景用 **300 档**（`$ok/warn/bad/info-300`）。600 档是为浅底设计的深色（白底 5.94–7.37:1），压到暗色面上会掉到 3:1 以下；100 档是「背景浅档」（彩度极低），当暗底前景会偏灰白、失去语义辨识度。

**唯一使用方**：`views/rent/RoomDashboard.vue`（房态大屏）。**其它页面一律不得使用 `$d-*`**——这是单一页面的例外，不是第二主题。

### 3.6 Element Plus 覆盖（`global.scss` 的 `html:root`）

`--el-color-primary: $brand-600`；`--el-color-primary-light-3/5/7/9: $brand-300 → $brand-100`；`--el-color-success/warning/danger: 600 档`；`--el-text-color-*: $n-900/700/600`；`--el-border-color: $n-400`；`--el-fill-color-blank: $n-0`（**取消半透明填充**）；`--el-border-radius-base: $r-box`；`--el-box-shadow-light: $sh-1`。

CSS 变量镜像（`--n-900`…、`--brand-600`…、`--glass`、`--sh-1`…）同样在该文件 `:root` 输出，供**内联样式与 JS** 使用（ECharts 请用 `tokens.ts`）。

## 四、界面类型（只切密度，不动颜色）

由外壳组件在根节点设置 `data-surface`，`global.scss` 提供 `--row-h / --pad-page / --pad-card / --gap-card`：

| 外壳 | data-surface | 场景 |
|---|---|---|
| `ListShell` | list | A 数据列表 |
| `DashboardShell` | dashboard | B 看板仪表 |
| `FormShell` | form | C 表单录入 |
| `DocumentShell` | document | D 文档打印 |
| `PortalShell` | portal | E 自助门户 |

## 五、组件契约（新增页面的默认动作 = 组装组件）

```
components/
  base/       无业务含义；出现业务词汇即违规
    DataTable  FilterBar  StatusTag  MoneyText  DateText  FormDialog  PageHeader  types.ts
  surfaces/   板式外壳，只切密度
    ListShell  DashboardShell  FormShell  DocumentShell  PortalShell
  modules/    业务组件，允许业务语义
    rent/TenantFormDialog  finance/VoucherAutoGenerate  finance/VoucherEntryRows  rent/BillLifecycle  contract/ClausePreview
  common/     EmptyState / TableSkeleton（全局自动注册，直接复用，不要重写）
```

**依赖方向是硬约束**：`modules/` 可引用 `base/` 与 `surfaces/`；**反向一律禁止**——`base/` 里出现业务词汇（如「已缴」「租客」）即违规，状态映射必须由调用方以 `statusMap` 传入。

### 5.1 列表页标准写法

```vue
<PageHeader title="…" :breadcrumb="[…]">
  <template #actions>…</template>   <!-- 每屏只放一个主按钮 -->
</PageHeader>
<FilterBar v-model:keyword="filters.keyword" :fields="FILTERS" v-model:values="filters" @search="fetchData">
  <template #actions>…</template>
</FilterBar>
<DataTable :data :loading :columns="COLUMNS" row-key="id" selectable :page :total @page-change="fetchData">
  <template #batch>…</template>     <!-- 批量操作 -->
  <template #自定义列="{ row }">…</template>
</DataTable>
```

`DataTable` 的列类型（**优先用内置类型，不要再写插槽**）：`money`（金额 → `MoneyText`）、`status`（状态标签 → `StatusTag` + `statusMap`）、`date`（日期 → `DateText`）、`mono`（等宽文本）、`slot`（兜底）。`prop` 支持嵌套路径（如 `contract.tenant.name`）。

复用件：批量删除 `composables/useBatchDelete.ts`；行密度 `composables/useDensity.ts`（全局持久化，`show-density` 给用户开关）。

## 六、硬约束

**禁止**：
1. 在令牌文件之外出现 `#hex` / `oklch()` / `rgb(a)`（R2 门禁）
2. 令牌名里出现模块名（`--fire-*`、`--rent-*`）
3. 浅档（100–300）上放白字，或深档（600–700）上放墨字
4. 玻璃 / `backdrop-filter` 用在内容区卡片上（**仅侧栏、抽屉、弹层**；顶栏为 `$brand-600` 实色；全站模糊区 ≤4，当前 2 处）
5. 重写 `EmptyState` / `TableSkeleton` / `components/print/`
6. 列表页重复声明 `.toolbar` / `.search-group` 样式与内联 `<el-table>`（**已全部清零**：87 个视图 / 95 张表统一走 `DataTable`；门禁 P5 基线 = 0 且扫描范围是 **`frontend/src` 全量**（不只 `views/`），写回内联表即失败。唯二豁免：`base/DataTable.vue`（封装层自身）、`modules/finance/VoucherEntryRows.vue`（可编辑录入网格，`DataTable` 是只读展示件））
7. `<style>` 里用 `$令牌` 却不写 `lang="scss"`——块会按**纯 CSS** 编译：变量原样进产物、被浏览器静默丢弃（**曾致 16 个文件 95 处声明失效**，`DataTable`/`PageHeader`/`MoneyText`/`RoomCard` 等都在内），且块内 `//` 注释会直接构建失败；由门禁 **P6** 强制
8. 只写 `backdrop-filter` 而不给半透明底（或反之）——两者必须成对，否则要么完全无效、要么糊成一片
9. 在房态大屏之外使用 `$d-*` 暗色面阶（它是单一页面的例外，不是第二主题）

**必须**：
1. **不新增颜色的默认答案是不加**；需要新颜色先证明不能由现有令牌派生
2. 层级由**字号与字重**承担，颜色退役
3. 控件圆角恒小于容器圆角
4. 金额、房号、编号、日期、页码一律 `font-variant-numeric: tabular-nums`
5. 中文正文不低于 13.5px，最小字号不低于 12px
6. 交互态成对定义前景与背景；hover 只动背景 / 边框，不改文字颜色
7. 每完成一步跑 `node scripts/check-contrast.cjs`（41 条，须全通过）

## 七、明确不做（防止自行扩展）

| 不做 | 原因 |
|---|---|
| **全局深色模式** | 维护成本翻倍（打印 / 导出须另做亮色）；物业前台白天在强光下工作，暗色更差。**唯一例外：房态大屏**（`$d-*` 暗色面阶，见 §3.7），其余页面一律亮色 |
| 按模块分主题 / 模块识别色 | 半年内会长成六套配色。模块识别改用文字标签 + 面包屑 |
| 模块专属图表主题 | 只允许自定义系列色**顺序**，取值仍限于全局阶 |
| 动效体系 | 当前阶段收益最低 |

## 八、门禁与自检

| 门禁 | 命令 | 阈值 |
|---|---|---|
| 静态铁律（含 R2 颜色字面量）| `node scripts/check-static-rules.cjs` | 6/6 |
| 对比度 | `node scripts/check-contrast.cjs` | 62/62（+3 装饰性豁免）；`--md` 参数可重新生成 `docs/对比度检查报告.md`（该报告为自动生成，勿手改）|
| 页面约定（组件采用率）| `node scripts/verify-page-conventions.cjs` | 6/6（扫描 `frontend/src` 全量；内联 `<el-table>` = 0、自写工具栏样式 = 0、`$令牌` 必须 `lang="scss"`）|
| 三档密度无破损 | `node scripts/verify-table-density.cjs` | 14/14 |
| 全链路 | `npm run test:regression` | 全绿 |

令牌改动后跑 `node scripts/gen-tokens-ts.cjs` 重新生成 JS 镜像；存量色值迁移用 `node scripts/theme-migrate-v2.cjs --dry` 预演；存量内联表格迁移用 `node scripts/migrate-tables-to-datatable.cjs --dry` 预演（支持一页多表，遇 `v-for` / 绑定 `:label`/`:prop` 的动态列会跳过，需手工迁移并改用 `column.property`）。