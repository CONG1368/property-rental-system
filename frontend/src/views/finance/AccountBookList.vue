<template>
  <div class="account-books">
    <h2 class="page-title">账套管理</h2>
    <el-button type="primary" style="margin-bottom:16px" @click="showDialog()">新增账套</el-button>
    <el-table :data="books" stripe v-loading="loading">
      <el-table-column prop="name" label="账套名称" width="200" />
      <el-table-column prop="companyName" label="公司名称" width="200" />
      <el-table-column prop="currency" label="币种" width="80" />
      <el-table-column prop="startDate" label="开始日期" width="120" />
      <el-table-column prop="endDate" label="结束日期" width="120" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }"><el-tag :type="row.isActive ? 'success' : 'info'" size="small">{{ row.isActive ? '启用' : '停用' }}</el-tag></template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }"><el-button size="small" @click="showDialog(row)">编辑</el-button></template>
      </el-table-column>
    </el-table>
    <el-dialog :title="isEdit ? '编辑账套' : '新增账套'" v-model="dialogVisible" width="500px">
      <el-form :model="form" ref="formRef" label-width="100px">
        <el-form-item label="账套名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="公司名称"><el-input v-model="form.companyName" /></el-form-item>
        <el-form-item label="开始日期"><el-date-picker v-model="form.startDate" type="date" style="width:100%" /></el-form-item>
        <el-form-item label="结束日期"><el-date-picker v-model="form.endDate" type="date" style="width:100%" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSubmit">确定</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const books = ref<any[]>([]); const loading = ref(false);
const dialogVisible = ref(false); const isEdit = ref(false); const editId = ref<number | null>(null);
const form = ref({ name: '', companyName: '', startDate: '', endDate: '', currency: 'CNY', isActive: true });

async function fetchBooks() {
  loading.value = true;
  try { const res = await request.get('/account-books'); books.value = res.data.list; } catch {} finally { loading.value = false; }
}

function showDialog(row?: any) {
  if (row) { isEdit.value = true; editId.value = row.id; form.value = { ...row }; }
  else { isEdit.value = false; editId.value = null; form.value = { name: '', companyName: '', startDate: '', endDate: '', currency: 'CNY', isActive: true }; }
  dialogVisible.value = true;
}

async function handleSubmit() {
  try {
    if (isEdit.value && editId.value) { await request.put('/account-books/' + editId.value, form.value); ElMessage.success('更新成功'); }
    else { await request.post('/account-books', form.value); ElMessage.success('创建成功'); }
    dialogVisible.value = false; fetchBooks();
  } catch {}
}

onMounted(() => fetchBooks());
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
</style>
