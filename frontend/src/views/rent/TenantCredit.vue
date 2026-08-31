<template>
  <div class="credit-page">
    <!-- 概览卡片 -->
    <el-row :gutter="16" class="stat-cards">
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ stats.total }}</div><div class="stat-label">租客总数</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num">{{ stats.avg }}</div><div class="stat-label">平均评分</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num good">{{ stats.good }}</div><div class="stat-label">优质租客 (A/B)</div></div></el-col>
      <el-col :span="6"><div class="stat-card"><div class="stat-num warn">{{ stats.risk }}</div><div class="stat-label">高风险 (C/D)</div></div></el-col>
    </el-row>

    <div class="toolbar">
      <div class="search-group">
        <el-input v-model="searchKeyword" placeholder="搜索姓名/手机号" clearable style="width:200px" @keyup.enter="fetchData" />
        <el-select v-model="filterGrade" placeholder="信用等级" clearable style="width:120px" @change="fetchData">
          <el-option label="A级" value="A" /><el-option label="B级" value="B" />
          <el-option label="C级" value="C" /><el-option label="D级" value="D" />
        </el-select>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="warning" @click="batchRecompute">批量重新评估</el-button>
      </div>
    </div>

    <el-table :data="tableData" stripe v-loading="loading">
      <el-table-column prop="name" label="姓名" width="120" show-overflow-tooltip />
      <el-table-column prop="phone" label="手机号" width="130" />
      <el-table-column label="评分" width="160">
        <template #default="{ row }">
          <div class="score-cell">
            <el-progress :percentage="row.creditScore || 0" :color="scoreColor(row.creditGrade)" :stroke-width="10" style="flex:1" />
            <span class="score-num">{{ row.creditScore ?? '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="等级" width="90">
        <template #default="{ row }"><el-tag :type="tagType(row.creditGrade)" size="small">{{ row.creditGrade || '-' }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }"><el-tag :type="row.status === '在租中' ? 'success' : row.status === '待入住' ? 'warning' : 'info'" size="small">{{ row.status }}</el-tag></template>
      </el-table-column>
      <el-table-column label="预测" min-width="140">
        <template #default="{ row }">{{ predictText(row) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" link @click="recompute(row)">重新评估</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const tableData = ref<any[]>([]); const loading = ref(false);
const page = ref(1); const pageSize = ref(20); const total = ref(0);
const searchKeyword = ref(''); const filterGrade = ref('');

const stats = computed(() => {
  const list = tableData.value;
  const avg = list.length ? Math.round(list.reduce((s, r) => s + (r.creditScore || 0), 0) / list.length) : 0;
  return {
    total: total.value,
    avg,
    good: list.filter(r => ['A', 'B'].includes(r.creditGrade)).length,
    risk: list.filter(r => ['C', 'D'].includes(r.creditGrade)).length,
  };
});

function scoreColor(grade?: string): string {
  return ({ A: '#67C23A', B: '#409EFF', C: '#E6A23C', D: '#F56C6C' } as Record<string, string>)[grade || 'D'] || '#909399';
}
function tagType(grade?: string): string {
  return ({ A: 'success', B: 'primary', C: 'warning', D: 'danger' } as Record<string, string>)[grade || 'D'] || 'info';
}
function predictText(row: any): string {
  const s = row.creditScore ?? 0;
  if (s >= 80) return '信用良好，可优先续约';
  if (s >= 60) return '信用正常，正常履约';
  if (s >= 40) return '建议加强跟进、缩短账期';
  return '高风险，建议重点催缴/抵押';
}

async function fetchData() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (searchKeyword.value) params.keyword = searchKeyword.value;
    if (filterGrade.value) params.creditGrade = filterGrade.value;
    const res = await request.get('/tenants/credit-scores', { params });
    tableData.value = res.data?.list || [];
    total.value = res.data?.total || 0;
  } catch { /* 静默 */ } finally { loading.value = false; }
}

async function recompute(row: any) {
  try {
    const res = await request.post(`/tenants/${row.id}/recompute-credit`);
    row.creditScore = res.data?.score;
    row.creditGrade = res.data?.grade;
    ElMessage.success(`${row.name} 评分已更新`);
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '评估失败'); }
}

async function batchRecompute() {
  if (tableData.value.length === 0) return ElMessage.warning('当前页无租客');
  ElMessage.info('正在批量评估当前页租客…');
  for (const row of tableData.value) {
    try {
      const res = await request.post(`/tenants/${row.id}/recompute-credit`);
      row.creditScore = res.data?.score;
      row.creditGrade = res.data?.grade;
    } catch { /* 跳过单条失败 */ }
  }
  ElMessage.success('批量评估完成');
}

onMounted(() => { fetchData(); });
</script>

<style lang="scss" scoped>
.credit-page { padding: 0; }
.stat-cards { margin-bottom: 16px; }
.stat-card { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 18px; text-align: center; }
.stat-num { font-size: 28px; font-weight: 700; color: #1f2430; }
.stat-num.good { color: #67C23A; }
.stat-num.warn { color: #E6A23C; }
.stat-label { margin-top: 6px; color: #909399; font-size: 13px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
.score-cell { display: flex; align-items: center; gap: 8px; }
.score-num { font-size: 14px; font-weight: 600; min-width: 36px; text-align: right; }
</style>