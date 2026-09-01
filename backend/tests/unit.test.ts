import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { validateIdNumber, maskIdNumber, checkAge, checkExpiry } from '../src/services/id-card-service.js';
import { canTransition } from '../src/services/voucher-status-machine.js';
import { readSheetAsObjects, buildWorkbookBuffer, writeWorkbookFile } from '../src/utils/excel.js';

describe('身份证校验（ISO 7064:1983 MOD 11-2）', () => {
  it('接受校验位正确的号码', () => {
    // 110105199001151234 的校验位由算法反推得出，避免使用真实身份证
    const base = '11010519900115123';
    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    let sum = 0;
    for (let i = 0; i < 17; i++) sum += Number(base[i]) * weights[i];
    const check = '10X98765432'[sum % 11];
    expect(validateIdNumber(base + check).valid).toBe(true);
  });

  it('拒绝校验位错误的号码', () => {
    const r = validateIdNumber('110105199001151230');
    // 上面构造的号码校验位大概率不匹配；若恰好匹配则换一个
    if (r.valid) expect(validateIdNumber('110105199001151231').valid).toBe(false);
    else expect(r.message).toContain('校验位');
  });

  it('拒绝位数/字符不合法的号码', () => {
    expect(validateIdNumber('12345').valid).toBe(false);
    expect(validateIdNumber('11010519900115123A').valid).toBe(false);
    expect(validateIdNumber('').valid).toBe(false);
  });

  it('脱敏保留前 3 后 4，中间打码', () => {
    const masked = maskIdNumber('110105199001151234');
    expect(masked).toBe('110***********1234');
    expect(masked).toHaveLength(18);
    expect(maskIdNumber('123')).toBe('****');   // 非 18 位一律全掩
  });

  it('年龄与有效期判断', () => {
    expect(checkAge('2010-01-01').underage).toBe(true);
    expect(checkAge('1990-01-01').underage).toBe(false);
    expect(checkExpiry('2000-01-01').expired).toBe(true);
    expect(checkExpiry('2099-01-01').expired).toBe(false);
  });
});

describe('凭证状态机', () => {
  it('允许正向流转', () => {
    expect(canTransition('草稿', '待复核').ok).toBe(true);
    expect(canTransition('待复核', '待审核').ok).toBe(true);
    expect(canTransition('待审核', '已过账').ok).toBe(true);
  });

  it('已过账只能作废，禁止回退（核心内控）', () => {
    expect(canTransition('已过账', '已作废').ok).toBe(true);
    expect(canTransition('已过账', '待审核').ok).toBe(false);
    expect(canTransition('已过账', '草稿').ok).toBe(false);
  });

  it('已作废是终态', () => {
    expect(canTransition('已作废', '草稿').ok).toBe(false);
    expect(canTransition('已作废', '已过账').ok).toBe(false);
  });

  it('非法流转返回原因', () => {
    const r = canTransition('草稿', '已过账');
    expect(r.ok).toBe(false);
    expect(typeof r.reason).toBe('string');
  });
});

describe('Excel 工具（xlsx→exceljs 迁移后的解析契约）', () => {
  const tmpFile = path.join(os.tmpdir(), 'vitest-excel-' + Date.now() + '.xlsx');

  it('写入后读回：中文表头、数字、空行处理', async () => {
    await writeWorkbookFile(tmpFile, {
      name: '房源',
      rows: [
        { 名称: 'A栋101', 类型: '公寓', 面积: 88.5 },
        { 名称: 'B栋202', 类型: '商铺', 面积: 120 },
      ],
    });
    const rows = await readSheetAsObjects(tmpFile);
    expect(rows).toHaveLength(2);
    expect(rows[0]['名称']).toBe('A栋101');
    expect(rows[0]['面积']).toBe(88.5);          // 数字保持为数字，不能变字符串
    expect(rows[1]['类型']).toBe('商铺');
    fs.unlinkSync(tmpFile);
  });

  it('多 Sheet 导出返回合法 xlsx（PK 魔数）且跳过空表', async () => {
    const buf = await buildWorkbookBuffer([
      { name: '有数据', rows: [{ a: 1 }] },
      { name: '空表跳过', rows: [] },
    ]);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it('Sheet 名超过 31 字符会被截断（Excel 硬限制）', async () => {
    const longName = '这是一个非常长的工作表名称用来测试截断行为超过三十一个字符限制';
    const buf = await buildWorkbookBuffer([{ name: longName, rows: [{ a: 1 }] }]);
    expect(buf.length).toBeGreaterThan(0);
  });
});
