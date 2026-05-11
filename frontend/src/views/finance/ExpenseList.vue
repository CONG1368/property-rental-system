<template>
  <div class="expense-list">
    <h2 class="page-title">费用核算</h2>
    <div class="toolbar">
      <el-select v-model="filterCategory" placeholder="费用类别" clearable style="width:130px" @change="fetchData">
        <el-option label="维修" value="维修" /><el-option label="保洁" value="保洁" /><el-option label="安保" value="安保" /><el-option label="绿化" value="绿化" /><el-option label="办公" value="办公" /><el-option label="折旧" value="折旧" /><el-option label="其他" value="其他" />
      </el-select>
      <el-button type="primary" @click="fetchData">查询</el-button>
      <el-button type="primary" style="margin-left:auto" @click="showDialog()">新增费用</el-button>
    </div>
    <el-table :data="tableData" stripe v-loading="loading">
      <el-table-column prop="category" label="类别" width="100" />
      <el-table-column prop="amount" label="金额" width="130" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }"><el-tag :type="row.status === '已批准' ? 'success' : 'warning'" size="small">{{ row.status }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="notes" label="备注" />
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button size="small" type="success" @click="handleApprove(row.id)" v-if="row.status === '待审批'">审批</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog title="新增费用" v-model="dialogVisible" width="450px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="费用类别">
          <el-select v-model="form.category" style="width:100%"><el-option v-for="c in categories" :key="c" :label="c" :value="c" /></el-select>
        </el-form-item>
        <el-form-item label="金额"><el-input-number v-model="form.amount" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSubmit">确定</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const categories = ['维修','保洁','安保','绿化','办公','折旧','其他'];
const tableData = ref<any[]>([]); const loading = ref(false);
const filterCategory = ref(''); const dialogVisible = ref(false);
const form = ref({ category: '维修', amount: 0, notes: '' });

async function fetchData() {
  loading.value = true;
  try { const res = await request.get('/expenses', { params: { category: filterCategory.value || undefined } }); tableData.value = res.data.list; } catch {} finally { loading.value = false; }
}

function showDialog() { form.value = { category: '维修', amount: 0, notes: '' }; dialogVisible.value = true; }

async function handleSubmit() {
  try { await request.post('/expenses', form.value); ElMessage.success('创建成功'); dialogVisible.value = false; fetchData(); } catch {}
}

async function handleApprove(id: number) {
  try { await request.put('/expenses/' + id + '/approve'); ElMessage.success('已批准'); fetchData(); } catch {}
}

onMounted(() => fetchData());
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; }
</style>
