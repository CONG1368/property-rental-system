<template>
  <div class="contract-kanban">
    <h2 class="page-title">合同看板</h2>
    <el-row :gutter="16">
      <el-col :span="3" v-for="col in columns" :key="col.status">
        <el-card shadow="hover" class="kanban-col">
          <template #header>
            <span class="col-header">{{ col.title }}</span>
            <el-tag size="small" :type="col.tagType" style="float:right">{{ col.count }}</el-tag>
          </template>
          <div v-for="c in col.contracts" :key="c.id" class="kanban-card" @click="$router.push('/contract/detail/' + c.id)">
            <div class="card-no">{{ c.contractNo }}</div>
            <div class="card-rent">¥{{ c.rentAmount }}</div>
            <div class="card-date" v-if="c.endDate">{{ c.endDate }}</div>
          </div>
          <el-empty v-if="!col.contracts.length" description="暂无合同" :image-size="60" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';
import { useWebSocket } from '@/composables/useWebSocket';

const columns = reactive([
  { status: '起草中',   title: '起草中',   tagType: 'info',    count: 0, contracts: [] as any[] },
  { status: '审批中',   title: '审批中',   tagType: 'warning', count: 0, contracts: [] as any[] },
  { status: '已驳回',   title: '已驳回',   tagType: 'danger',  count: 0, contracts: [] as any[] },
  { status: '已签订',   title: '已签订',   tagType: 'primary', count: 0, contracts: [] as any[] },
  { status: '执行中',   title: '执行中',   tagType: 'success', count: 0, contracts: [] as any[] },
  { status: '到期提醒', title: '到期提醒', tagType: 'warning', count: 0, contracts: [] as any[] },
  { status: '已到期',   title: '已到期',   tagType: 'info',    count: 0, contracts: [] as any[] },
  { status: '已终止',   title: '已终止',   tagType: 'info',    count: 0, contracts: [] as any[] },
]);

async function fetchKanban() {
  columns.forEach(col => { col.count = 0; col.contracts = []; });
  try {
    const res = await request.get('/contracts', { params: { pageSize: 500 } });
    const list = res?.data?.list;
    if (!Array.isArray(list)) return;
    for (const c of list) {
      const col = columns.find(x => x.status === c.status);
      if (col) { col.contracts.push(c); col.count++; }
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '加载合同看板失败');
  }
}

const { on: wsOn } = useWebSocket();
let unsubContractChanged: (() => void) | null = null;

onMounted(() => {
  fetchKanban();
  unsubContractChanged = wsOn('contract:status-changed', () => { fetchKanban(); });
  const u1 = wsOn('contract:created', () => { fetchKanban(); });
  const u2 = wsOn('contract:renewed', () => { fetchKanban(); });
  const u3 = wsOn('contract:deleted', () => { fetchKanban(); });
  const orig = unsubContractChanged;
  unsubContractChanged = () => { orig?.(); u1?.(); u2?.(); u3?.(); };
});

onUnmounted(() => {
  unsubContractChanged?.();
});
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.col-header { font-weight: 600; }
.kanban-col { min-height: 260px; }
.kanban-card { padding: 8px; margin: 4px 0; border: 1px solid #e8e8e8; border-radius: 4px; cursor: pointer; }
.kanban-card:hover { border-color: #0A3D62; }
.card-no { font-size: 12px; font-weight: 600; }
.card-rent { font-size: 11px; color: #7F8C8D; margin-top: 2px; }
.card-date { font-size: 10px; color: #b0b0b0; margin-top: 1px; }
</style>
