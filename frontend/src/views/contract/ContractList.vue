<template>
  <div class="contract-list">
    <h2 class="page-title">合同管理</h2>
    <div class="toolbar">
      <el-select v-model="filterStatus" placeholder="状态" clearable style="width:130px" @change="fetchData">
        <el-option label="起草中" value="起草中" /><el-option label="审批中" value="审批中" /><el-option label="已签订" value="已签订" /><el-option label="执行中" value="执行中" /><el-option label="已到期" value="已到期" /><el-option label="已终止" value="已终止" />
      </el-select>
      <el-button type="primary" @click="fetchData">查询</el-button>
      <el-button type="primary" style="margin-left:auto" @click="$router.push('/contract/draft')">起草合同</el-button>
    </div>
    <el-table :data="tableData" stripe v-loading="loading" @row-click="(row: any) => $router.push('/contract/detail/' + row.id)" style="cursor:pointer">
      <el-table-column prop="contractNo" label="合同编号" width="150" />
      <el-table-column label="租客" width="100">
        <template #default="{ row }"><span v-if="row.tenant">{{ row.tenant.name }}</span></template>
      </el-table-column>
      <el-table-column label="房源" width="150">
        <template #default="{ row }"><span v-if="row.property">{{ row.property.name }}</span></template>
      </el-table-column>
      <el-table-column prop="rentAmount" label="月租金" width="110" />
      <el-table-column prop="startDate" label="开始" width="110" />
      <el-table-column prop="endDate" label="到期" width="110" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === '执行中' ? 'success' : row.status === '审批中' ? 'warning' : row.status === '已驳回' ? 'danger' : 'info'" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click.stop="$router.push('/contract/draft/' + row.id)" v-if="row.status === '起草中'">编辑</el-button>
          <el-button size="small" type="success" @click.stop="handleSubmit(row.id)" v-if="row.status === '起草中'">提交</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const tableData = ref<any[]>([]); const total = ref(0); const page = ref(1); const pageSize = ref(20);
const loading = ref(false); const filterStatus = ref('');

async function fetchData() {
  loading.value = true;
  try {
    const res = await request.get('/contracts', { params: { page: page.value, pageSize: pageSize.value, status: filterStatus.value || undefined } });
    tableData.value = res.data.list; total.value = res.data.total;
  } catch {} finally { loading.value = false; }
}

async function handleSubmit(id: number) {
  try { await request.post('/contracts/' + id + '/submit'); ElMessage.success('已提交审批'); fetchData(); } catch {}
}

onMounted(() => fetchData());
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; }
</style>
