/**
 * Design Tokens（JS 镜像）— 由 scripts/gen-tokens-ts.cjs 从 variables.scss 自动生成，勿手改。
 * 仅用于 ECharts 等需要真实色值的 JS 场景；样式请用 SCSS $令牌。
 */
export const tokens = {
  n0: '#ffffff',
  n50: '#f8fafc',
  n100: '#f1f4f7',
  n200: '#e2e5e8',
  n300: '#caced3',
  n400: '#878d93',
  n500: '#6f757b',
  n600: '#646a70',
  n700: '#43484e',
  n900: '#14191e',
  brand100: '#deedff',
  brand300: '#9bc1f1',
  brand600: '#0256a9',
  brand700: '#004495',
  ok100: '#d8f3de',
  ok600: '#0d6332',
  warn100: '#ffe9d0',
  warn600: '#8f520d',
  bad100: '#ffe6e2',
  bad600: '#a1302b',
  info100: '#eaeff5',
  info600: '#5e646a',
  stVacant: '#dee9f7',
  stLocked: '#a3c0e6',
  stBooked: '#6b9bd8',
  stRented: '#1570d1',
  scrim: '#00000073',
  glass: '#ffffffb8',
} as const;

export type TokenName = keyof typeof tokens;
