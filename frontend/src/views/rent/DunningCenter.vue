<template>
  <div class="dunning-center">
    <h2 class="page-title">智能催缴中心</h2>
    <el-row :gutter="16">
      <el-col :span="16">
        <el-card>
          <template #header>催缴任务</template>
          <el-tabs v-model="activeLevel">
            <el-tab-pane label="一级提醒" name="1" />
            <el-tab-pane label="二级催缴" name="2" />
            <el-tab-pane label="三级催缴" name="3" />
            <el-tab-pane label="四级催缴" name="4" />
          </el-tabs>
          <el-table :data="filteredTasks" stripe v-loading="loading">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column label="账单信息" width="150">
              <template #default="{ row }">
                <div v-if="row.bill">{{ row.bill.billNo }}</div>
                <div v-if="row.bill" class="text-muted">{{ row.bill.totalAmount }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="channel" label="渠道" width="80" />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === '已发送' ? 'success' : row.status === '待发送' ? 'warning' : 'info'" size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="dispatchDunning(row)" v-if="row.status === '待发送'">发送</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>欠费账龄分析</template>
          <div v-for="item in agingData" :key="item.label" class="aging-item">
            <span>{{ item.label }}</span>
            <el-progress :percentage="agingPercent(item.value)" :color="progressColor(item.label)" />
            <span class="aging-amount">{{ item.value.toLocaleString() }}</span>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { getDunningTasks, dispatchDunning as apiDispatch, getArrearsAging } from '@/api/dunning';

const loading = ref(false); const tasks = ref<any[]>([]); const agingData = ref<any[]>([]);
const activeLevel = ref('1');

const filteredTasks = computed(() => tasks.value.filter((t: any) => String(t.level) === activeLevel.value));

function agingPercent(val: number): number {
  const max = Math.max(...agingData.value.map((a: any) => a.value), 1);
  return (val / max) * 100;
}

function progressColor(label: string): string {
  return label === '90天以上' ? '#FF6B35' : label === '61-90天' ? '#F6B93B' : label === '31-60天' ? '#00B894' : '#0A3D62';
}

async function fetchTasks() {
  loading.value = true;
  try { const res = await getDunningTasks({}); tasks.value = res.data.list; } catch {} finally { loading.value = false; }
}

async function dispatchDunning(row: any) {
  try {
    await apiDispatch({ id: row.id, status: '已发送' });
    ElMessage.success('催缴已发送');
    fetchTasks();
  } catch {}
}

onMounted(async () => {
  fetchTasks();
  try { const res = await getArrearsAging(); agingData.value = res.data.aging || []; } catch {}
});
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.text-muted { color: #7F8C8D; font-size: 10px; }
.aging-item { margin-bottom: 16px; }
.aging-amount { font-size: 12px; color: #34495E; }
</style>
