// base 层共享类型（无业务词汇）。
// 列/筛选项的「枚举与文案」一律由调用方以配置传入，组件本身不认识任何业务状态。

export interface StatusTagItem {
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  label?: string;
  /** 令牌驱动的自定义着色 class（如房态阶）；给了它就渲染 <span> 而非 el-tag */
  className?: string;
}

export type TableColumnType = 'money' | 'status' | 'mono' | 'date' | 'index' | 'slot';

export interface TableColumn {
  /** 唯一键（缺省用 prop/label） */
  key?: string;
  /** 字段名；type=slot 时可不填 */
  prop?: string;
  label: string;
  width?: number | string;
  minWidth?: number | string;
  fixed?: boolean | 'left' | 'right';
  sortable?: boolean | 'custom';
  tooltip?: boolean;
  align?: 'left' | 'center' | 'right';
  /** 内置渲染：money=金额、status=状态标签、mono=等宽文本、slot=自定义插槽 */
  type?: TableColumnType;
  /** type=slot 时的插槽名 */
  slot?: string;
  precision?: number;
  currency?: boolean;
  /** type=date 时的格式 */
  dateFormat?: 'date' | 'datetime' | 'time' | 'month' | 'year';
  statusMap?: Record<string, StatusTagItem>;
}

export interface FilterField {
  key: string;
  label: string;
  type?: 'text' | 'select' | 'month' | 'daterange';
  placeholder?: string;
  width?: number;
  multiple?: boolean;
  options?: { label: string; value: string | number }[];
}

export interface FormField {
  key: string;
  label: string;
  type?: 'text' | 'select' | 'number' | 'date' | 'month' | 'switch';
  placeholder?: string;
  required?: boolean;
  /** text 用：多行高度 */
  rows?: number;
  multiple?: boolean;
  min?: number;
  precision?: number;
  options?: { label: string; value: string | number }[];
}

export type Density = 'compact' | 'default' | 'loose';
