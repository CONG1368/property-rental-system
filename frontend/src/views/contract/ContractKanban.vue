<template>
  <div class="contract-kanban">
    <h2 class="page-title">合同看板</h2>
    <el-row :gutter="16">
      <el-col :span="4" v-for="col in columns" :key="col.status">
        <el-card shadow="hover" class="kanban-col">
          <template #header><span class="col-header">{{ col.title }}</span><el-tag size="small" style="float:right">{{ col.count }}</el-tag></template>
          <div v-for="c in col.contracts" :key="c.id" class="kanban-card" @click="$router.push('/contract/detail/' + c.id)">
            <div class="card-no">{{ c.contractNo }}</div>
            <div class="card-rent">¥{{ c.rentAmount }}</div>
          </div>
          <el-empty v-if="!col.contracts.length" description="--" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import request from '@/api/request';

const columns = reactive([
  { status: '起草中', title: '起草中', count: 0, contracts: [] as any[] },
  { status: '审批中', title: '审批中', count: 0, contracts: [] as any[] },
  { status: '已签订', title: '已签订', count: 0, contracts: [] as any[] },
  { status: '执行中', title: '执行中', count: 0, contracts: [] as any[] },
  { status: '到期提醒', title: '到期提醒', count: 0, contracts: [] as any[] },
]);

onMounted(async () => {
  try {
    const res = await request.get('/contracts', { params: { pageSize: 200 } });
    for (const c of res.data.list) {
      const col = columns.find(x => x.status === c.status);
      if (col) { col.contracts.push(c); col.count++; }
    }
  } catch {}
});
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.col-header { font-weight: 600; }
.kanban-col { min-height: 300px; }
.kanban-card { padding: 8px; margin: 4px 0; border: 1px solid #e8e8e8; border-radius: 4px; cursor: pointer; }
.kanban-card:hover { border-color: #0A3D62; }
.card-no { font-size: 12px; font-weight: 600; }
.card-rent { font-size: 11px; color: #7F8C8D; margin-top: 2px; }
</style>
