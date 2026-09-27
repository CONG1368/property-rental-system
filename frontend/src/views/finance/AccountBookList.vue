<template>
  <div class="account-books">
    <h2 class="page-title">账套管理</h2>
    <el-button type="primary" style="margin-bottom:16px" @click="showDialog()">新增账套</el-button>
    <DataTable :data="books" :loading="loading" :columns="COLUMNS" row-key="id" empty-title="暂无数据" empty-description="调整筛选条件或新增记录后，数据会显示在这里">
      <template #c6="{ row }"><el-tag :type="row.isActive ? 'success' : 'info'" size="small">{{ row.isActive ? '启用' : '停用' }}</el-tag></template>
      <template #c7="{ row }"><el-button size="small" @click="showDialog(row)">编辑</el-button></template>
    </DataTable>
    <el-dialog :title="isEdit ? '编辑账套' : '新增账套'" v-model="dialogVisible" width="500px">
      <el-form :model="form" ref="formRef" label-width="100px">
        <el-form-item label="账套名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="公司名称"><el-input v-model="form.companyName" /></el-form-item>
        <el-form-item label="开始日期"><el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="结束日期"><el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSubmit">确定</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';

const COLUMNS: TableColumn[] = [
  { prop: 'name', label: '账套名称', width: 200 },
  { prop: 'companyName', label: '公司名称', width: 200 },
  { prop: 'currency', label: '币种', width: 80 },
  { prop: 'startDate', label: '开始日期', width: 120 },
  { prop: 'endDate', label: '结束日期', width: 120 },
  { label: '状态', width: 100, slot: 'c6' },
  { label: '操作', width: 160, slot: 'c7' },
];

import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';
import { confirmWithPassword } from '@/utils/confirm-password';

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
    if (isEdit.value && editId.value) {
      const pwd = await confirmWithPassword('确定修改账套「' + (form.value?.name || '') + '」? 账套变更影响所有财务数据，请输入登录密码。', '修改账套二次确认');
      if (!pwd) return;
      await request.put('/account-books/' + editId.value, { ...form.value, confirmPassword: pwd }); ElMessage.success('更新成功');
    }
    else { await request.post('/account-books', form.value); ElMessage.success('创建成功'); }
    dialogVisible.value = false; fetchBooks();
  } catch {}
}

onMounted(() => fetchBooks());
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: $n-900; margin-bottom: 16px; }
</style>
