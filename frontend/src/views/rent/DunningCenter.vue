<template>
  <div class="dunning-center">
    <div class="toolbar">
      <h2 class="page-title">智能催缴中心</h2>
      <div class="actions">
        <el-button type="primary" @click="showStrategyDialog">催缴策略配置</el-button>
        <el-button type="success" @click="batchDispatch" :disabled="selectedIds.length === 0">批量发送 ({{ selectedIds.length }})</el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="16">
        <el-card>
          <template #header>催缴任务</template>
          <el-tabs v-model="activeLevel" @tab-change="fetchTasks">
            <el-tab-pane label="到期提醒" name="0" />
            <el-tab-pane label="一级催缴" name="1" />
            <el-tab-pane label="二级催缴" name="2" />
            <el-tab-pane label="三级催缴" name="3" />
          </el-tabs>
          <el-table :data="filteredTasks" stripe v-loading="loading" @selection-change="(rows: any[]) => selectedIds = rows.map((r: any) => r.id)">
            <el-table-column type="selection" width="45" />
            <el-table-column label="租户" width="100">
              <template #default="{ row }">
                <el-link v-if="row.bill?.contract?.tenant" type="primary" size="small" @click="goTenant(row.bill.contract.tenant.id)">
                  {{ row.bill.contract.tenant.name }}
                </el-link>
                <span v-else class="text-muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="房源" width="130" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.bill?.contract?.property?.name || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="欠费金额" width="100" align="right">
              <template #default="{ row }">
                <b v-if="row.bill">¥{{ Number(row.bill.totalAmount || 0).toFixed(2) }}</b>
                <span v-else>—</span>
              </template>
            </el-table-column>
            <el-table-column prop="channel" label="渠道" width="70" />
            <el-table-column label="级别" width="75">
              <template #default="{ row }">
                <el-tag :type="row.level === 3 ? 'danger' : row.level === 2 ? 'warning' : row.level === 1 ? '' : 'info'" size="small">
                  {{ levelLabel(row.level) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === '已发送' ? 'success' : row.status === '待发送' ? 'warning' : 'info'" size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="sentAt" label="发送时间" width="140">
              <template #default="{ row }">{{ row.sentAt?.slice(0, 16)?.replace('T', ' ') || '-' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="80">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="dispatchDunning(row)" v-if="row.status === '待发送'">发送</el-button>
                <el-tag v-else size="small" type="info">已处理</el-tag>
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
            <el-progress :percentage="Math.min(agingPercent(item.value), 100)" :color="progressColor(item.label)" :stroke-width="18" />
            <span class="aging-amount">¥{{ (item.value / 10000).toFixed(1) }}万</span>
          </div>
          <div v-if="!agingData.length" style="color:#7F8C8D;text-align:center;padding:20px">暂无欠费数据</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 催缴策略配置对话框 -->
    <el-dialog title="催缴策略配置" v-model="strategyVisible" width="550px">
      <el-form :model="strategyForm" label-width="160px">
        <el-form-item label="启用自动催缴">
          <el-switch v-model="strategyForm.autoDunning" />
        </el-form-item>
        <el-form-item label="到期前提醒(天)">
          <el-input-number v-model="strategyForm.remindBefore" :min="0" :max="30" style="width:100%" />
        </el-form-item>
        <el-form-item label="一级催缴(逾期天数)">
          <el-input-number v-model="strategyForm.level1Days" :min="1" :max="90" style="width:100%" />
        </el-form-item>
        <el-form-item label="一级催缴-渠道">
          <el-checkbox-group v-model="strategyForm.level1Channels">
            <el-checkbox label="站内信" /><el-checkbox label="短信" /><el-checkbox label="微信" />
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="二级催缴(逾期天数)">
          <el-input-number v-model="strategyForm.level2Days" :min="1" :max="90" style="width:100%" />
        </el-form-item>
        <el-form-item label="二级催缴-渠道">
          <el-checkbox-group v-model="strategyForm.level2Channels">
            <el-checkbox label="站内信" /><el-checkbox label="短信" /><el-checkbox label="微信" />
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="三级催缴(逾期天数)">
          <el-input-number v-model="strategyForm.level3Days" :min="1" :max="90" style="width:100%" />
        </el-form-item>
        <el-form-item label="每日最大发送量">
          <el-input-number v-model="strategyForm.maxDailySends" :min="10" :max="1000" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="strategyVisible = false">取消</el-button><el-button type="primary" @click="saveStrategy">保存策略</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { getDunningTasks, dispatchDunning as apiDispatch, updateDunningStrategy, getArrearsAging } from '@/api/dunning';
import { useWebSocket } from '@/composables/useWebSocket';

const router = useRouter();
const loading = ref(false); const tasks = ref<any[]>([]); const agingData = ref<any[]>([]);
const activeLevel = ref('0');
const selectedIds = ref<number[]>([]);

const filteredTasks = computed(() => tasks.value.filter((t: any) => String(t.level) === activeLevel.value));

// 策略配置
const strategyVisible = ref(false);
const strategyForm = ref({
  autoDunning: true,
  remindBefore: 7,
  level1Days: 15, level1Channels: ['站内信'],
  level2Days: 30, level2Channels: ['站内信', '短信'],
  level3Days: 60, level3Channels: ['站内信', '短信', '微信'],
  maxDailySends: 200,
});

function showStrategyDialog() { strategyVisible.value = true; }

async function saveStrategy() {
  try {
    await updateDunningStrategy(strategyForm.value);
    ElMessage.success('催缴策略已保存');
    strategyVisible.value = false;
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '保存失败'); }
}

function levelLabel(level: number): string {
  const map: Record<number, string> = { 0: '提醒', 1: '一级', 2: '二级', 3: '三级' };
  return map[level] || String(level);
}

function goTenant(id: number | null) {
  if (id) router.push(`/rent/tenants/${id}`);
}

function agingPercent(val: number): number {
  const max = Math.max(...agingData.value.map((a: any) => a.value), 1);
  return (val / max) * 100;
}

function progressColor(label: string): string {
  return label.includes('90天以上') ? '#FF6B35' : label.includes('61-90') ? '#F6B93B' : label.includes('31-60') ? '#00B894' : '#0A3D62';
}

async function fetchTasks() {
  loading.value = true;
  try { const res = await getDunningTasks({ level: activeLevel.value === '0' ? undefined : activeLevel.value }); tasks.value = res.data.list; } catch {} finally { loading.value = false; }
}

async function dispatchDunning(row: any) {
  try {
    await apiDispatch({ billId: row.billId, level: row.level, channel: row.channel || '站内信', title: '催缴通知', content: `您的账单 ${row.bill?.billNo || ''} 已逾期，请尽快缴费。` });
    ElMessage.success('催缴已发送');
    fetchTasks();
  } catch { ElMessage.error('发送失败'); }
}

async function batchDispatch() {
  const toSend = tasks.value.filter((t: any) => selectedIds.value.includes(t.id) && t.status === '待发送');
  if (!toSend.length) { ElMessage.warning('没有可发送的任务'); return; }
  let success = 0;
  for (const row of toSend) {
    try {
      await apiDispatch({ billId: row.billId, level: row.level, channel: row.channel || '站内信', title: '催缴通知', content: '批量催缴，请尽快缴费。' });
      success++;
    } catch {}
    await new Promise(r => setTimeout(r, 200)); // 避免瞬间请求过多
  }
  ElMessage.success(`已发送 ${success}/${toSend.length} 条催缴`);
  selectedIds.value = [];
  fetchTasks();
}

const { on: wsOn } = useWebSocket();
let cleanupDunningWs: (() => void) | null = null;

onMounted(async () => {
  fetchTasks();
  try { const res = await getArrearsAging(); agingData.value = res.data.aging || []; } catch {}

  // 实时监听新催缴任务
  cleanupDunningWs = wsOn('dunning:new', () => {
    fetchTasks();
  });
});

onUnmounted(() => {
  if (cleanupDunningWs) cleanupDunningWs();
});
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.actions { display: flex; gap: 8px; }
.text-muted { color: #7F8C8D; font-size: 10px; }
.aging-item { margin-bottom: 16px; }
.aging-amount { font-size: 12px; color: #34495E; }
</style>
