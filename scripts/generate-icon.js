// 物业租赁综合管理系统 — 应用图标生成器
// 使用 Playwright 渲染 HTML Canvas → PNG → 嵌入 ICO 容器
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const SIZES = [256, 128, 64, 48, 32, 16];

// SVG 建筑图标（简洁现代风格）
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a5276"/>
      <stop offset="100%" stop-color="#0A3D62"/>
    </linearGradient>
    <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e67e22"/>
      <stop offset="100%" stop-color="#d35400"/>
    </linearGradient>
  </defs>
  <!-- 背景圆 -->
  <circle cx="128" cy="128" r="120" fill="url(#bg)"/>
  <!-- 屋顶 -->
  <polygon points="50,120 128,32 206,120" fill="url(#roof)" stroke="#fff" stroke-width="2"/>
  <!-- 建筑主体 -->
  <rect x="64" y="120" width="128" height="106" rx="4" fill="#ecf0f1" stroke="#bdc3c7" stroke-width="1.5"/>
  <!-- 门 -->
  <rect x="108" y="170" width="40" height="56" rx="20" fill="#2c3e50"/>
  <rect x="114" y="180" width="10" height="20" rx="3" fill="#ecf0f1"/>
  <rect x="132" y="180" width="10" height="20" rx="3" fill="#ecf0f1"/>
  <rect x="118" y="206" width="20" height="8" rx="3" fill="#f39c12"/>
  <!-- 窗户 左 -->
  <rect x="80" y="140" width="32" height="28" rx="3" fill="#3498db" stroke="#2980b9" stroke-width="1"/>
  <line x1="96" y1="140" x2="96" y2="168" stroke="#2980b9" stroke-width="1"/>
  <line x1="80" y1="154" x2="112" y2="154" stroke="#2980b9" stroke-width="1"/>
  <!-- 窗户 右 -->
  <rect x="144" y="140" width="32" height="28" rx="3" fill="#3498db" stroke="#2980b9" stroke-width="1"/>
  <line x1="160" y1="140" x2="160" y2="168" stroke="#2980b9" stroke-width="1"/>
  <line x1="144" y1="154" x2="176" y2="154" stroke="#2980b9" stroke-width="1"/>
  <!-- 文字 -->
  <text x="128" y="250" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#fff">物业租赁</text>
</svg>`;

// 将 PNG Buffer 包装为 ICO 格式
function pngsToIco(pngs) {
  const imageCount = pngs.length;
  // ICO header: reserved(2) + type(2) + count(2) = 6 bytes
  // Directory: count * 16 bytes
  const headerSize = 6 + imageCount * 16;
  const buffers = [Buffer.alloc(headerSize)];

  // Header
  buffers[0].writeUInt16LE(0, 0);   // reserved
  buffers[0].writeUInt16LE(1, 2);   // type (ICO)
  buffers[0].writeUInt16LE(imageCount, 4); // image count

  let offset = headerSize;
  for (let i = 0; i < imageCount; i++) {
    const png = pngs[i];
    const size = png.length;
    const w = SIZES[i] >= 256 ? 0 : SIZES[i]; // 0 means 256
    const h = w;

    const entryOffset = 6 + i * 16;
    buffers[0].writeUInt8(w, entryOffset);      // width
    buffers[0].writeUInt8(h, entryOffset + 1);  // height
    buffers[0].writeUInt8(0, entryOffset + 2);  // color palette
    buffers[0].writeUInt8(0, entryOffset + 3);  // reserved
    buffers[0].writeUInt16LE(1, entryOffset + 4); // planes
    buffers[0].writeUInt16LE(32, entryOffset + 6); // bpp
    buffers[0].writeUInt32LE(size, entryOffset + 8); // image size
    buffers[0].writeUInt32LE(offset, entryOffset + 12); // image offset

    buffers.push(png);
    offset += size;
  }

  return Buffer.concat(buffers);
}

async function main() {
  console.log('[IconGen] 启动浏览器...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const pngs = [];
  for (const size of SIZES) {
    // 渲染 SVG 到指定尺寸
    const html = `<!DOCTYPE html><html><body style="margin:0;width:${size}px;height:${size}px">${svgIcon}</body></html>`;
    await page.setContent(html);
    await page.setViewportSize({ width: size, height: size });

    const pngBuffer = await page.screenshot({ type: 'png', omitBackground: false });
    pngs.push(pngBuffer);
    console.log(`[IconGen] 生成 ${size}x${size} PNG (${(pngBuffer.length / 1024).toFixed(1)}KB)`);
  }

  await browser.close();

  // 合并为 ICO
  const icoBuffer = pngsToIco(pngs);

  // 输出
  const outDir = './build';
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  writeFileSync(`${outDir}/icon.ico`, icoBuffer);
  writeFileSync(`${outDir}/icon.png`, pngs[0]); // 256x256 PNG 备用

  console.log(`[IconGen] 完成: build/icon.ico (${(icoBuffer.length / 1024).toFixed(0)}KB)`);
}

main().catch((err) => {
  console.error('[IconGen] 失败:', err.message);
  process.exit(1);
});
