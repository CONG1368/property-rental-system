<template>
  <div class="bank-page">
    <el-row :gutter="16" class="stat-cards">
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ result.matched ?? 0 }}</div><div class="stat-label">已匹配</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num unmatched">{{ result.unmatched?.length ?? 0 }}</div><div class="stat-label">未匹配</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ fmt(result.totalBankAmount) }}</div><div class="stat-label">账单总额</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num warn">{{ fmt(result.difference) }}</div><div class="stat-label">差异金额</div></div></el-col>
    </el-row>

    <div class="toolbar">
      <el-select v-model="bankFormat" placeholder="银行格式" style="width:150px">
        <el-option label="通用" value="generic" /><el-option label="工商银行" value="icbc" />
        <el-option label="建设银行" value="ccb" /><el-option label="中国银行" value="boc" /><el-option label="招商银行" value="cmb" />
      </el-select>
      <el-date-picker v-model="dateRange" type="daterange" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" style="width:260px" />
      <el-upload :show-file-list="false" :auto-upload="false" :on-change="onFileChange" accept=".xlsx,.xls,.csv">
        <el-button type="primary">选择对账单文件</el-button>
      </el-upload>
      <span v-if="fileName" class="file-name">{{ fileName }}</span>
      <el-button type="success" :loading="loading" :disabled="!file" @click="runReconcile">执行对账</el-button>
    </div>

    <div v-if="result.unmatched?.length" class="unmatched-box">
      <h4>未匹配明细（{{ result.unmatched.length }} 条）</h4>
      <el-table :data="result.unmatched" size="small" border max-height="320">
        <el-table-column prop="bank.transactionDate" label="交易日期" width="120" />
        <el-table-column prop="bank.transactionNo" label="流水号" width="140" />
        <el-table-column prop="bank.counterParty" label="对方户名" width="160" />
        <el-table-column prop="bank.amount" label="金额" width="120" align="right"><template #default="{ row }">{{ fmt(row.bank?.amount) }}</template></el-table-column>
        <el-table-column prop="bank.description" label="摘要" min-width="150" />
        <el-table-column prop="reason" label="原因" width="200" />
              <template #empty>
          <EmptyState title="暂无数据" description="调整筛选条件或新增记录后，数据会显示在这里" />
        </template>
      </el-table>
    </div>
    <el-empty v-else-if="hasRun" description="全部匹配成功，无差异" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import request, { apiBaseURL } from '@/api/request';

const bankFormat = ref('generic'); const dateRange = ref<[string,string] | null>(null);
const file = ref<File | null>(null); const fileName = ref('');
const loading = ref(false); const result = ref<any>({}); const hasRun = ref(false);

function fmt(v: any): string { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }); }
function onFileChange(f: any) { file.value = f?.raw || null; fileName.value = f?.name || ''; }

async function runReconcile() {
  if (!file.value) return ElMessage.warning('请先选择对账单文件');
  loading.value = true;
  try {
    const fd = new FormData();
    fd.append('file', file.value);
    fd.append('bankFormat', bankFormat.value);
    if (dateRange.value) { fd.append('startDate', dateRange.value[0]); fd.append('endDate', dateRange.value[1]); }
    const token = localStorage.getItem('accessToken') || '';
    const resp = await fetch(apiBaseURL + '/bank-reconciliation/upload', {
      method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body: fd,
    });
    const data = await resp.json();
    if (data.code !== 200) return ElMessage.error(data.message || '对账失败');
    result.value = data.data; hasRun.value = true;
    ElMessage.success(`对账完成，匹配 ${data.data.matched} 笔`);
  } catch (err: any) { ElMessage.error('对账失败: ' + (err?.message || '未知错误')); } finally { loading.value = false; }
}
</script>

<style lang="scss" scoped>
.bank-page { padding: 0; }
.stat-cards { margin-bottom: 16px; }
.stat-card { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 18px; text-align: center; }
.stat-num { font-size: 26px; font-weight: 700; color: #1f2430; }
.stat-num.unmatched { color: #F56C6C; }
.stat-num.warn { color: #E6A23C; }
.stat-label { margin-top: 6px; color: #909399; font-size: 13px; }
.toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.file-name { color: #409EFF; font-size: 13px; }
.unmatched-box { margin-top: 12px; }
.unmatched-box h4 { margin: 0 0 8px; color: #F56C6C; }
</style>