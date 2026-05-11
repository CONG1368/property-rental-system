<template>
  <div class="user-list">
    <h2 class="page-title">用户管理</h2>
    <el-button type="primary" style="margin-bottom:16px" @click="showDialog()">新增用户</el-button>
    <el-table :data="users" stripe v-loading="loading">
      <el-table-column prop="username" label="用户名" width="120" />
      <el-table-column prop="displayName" label="姓名" width="120" />
      <el-table-column prop="role" label="角色" width="100" />
      <el-table-column prop="status" label="状态" width="80"><template #default="{ row }"><el-tag :type="row.status === '正常' ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag></template></el-table-column>
      <el-table-column prop="lastLogin" label="最后登录" width="160" />
      <el-table-column label="操作">
        <template #default="{ row }"><el-button size="small" @click="showDialog(row)">编辑</el-button></template>
      </el-table-column>
    </el-table>
    <el-dialog :title="isEdit ? '编辑用户' : '新增用户'" v-model="dialogVisible" width="450px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="用户名"><el-input v-model="form.username" /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="form.displayName" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width:100%"><el-option v-for="r in roles" :key="r" :label="r" :value="r" /></el-select>
        </el-form-item>
        <el-form-item label="密码" v-if="!isEdit"><el-input v-model="form.password" type="password" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSubmit">确定</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const roles = ['管理员','收租主管','收租员','财务主管','会计','出纳','合同主管','法务','总经理'];
const users = ref<any[]>([]); const loading = ref(false);
const dialogVisible = ref(false); const isEdit = ref(false); const editId = ref<number | null>(null);
const form = ref({ username: '', displayName: '', role: '收租员', password: '' });

async function fetchUsers() {
  loading.value = true;
  try { const res = await request.get('/users'); users.value = res.data.list; } catch {} finally { loading.value = false; }
}

function showDialog(row?: any) {
  if (row) { isEdit.value = true; editId.value = row.id; form.value = { username: row.username, displayName: row.displayName, role: row.role, password: '' }; }
  else { isEdit.value = false; editId.value = null; form.value = { username: '', displayName: '', role: '收租员', password: '' }; }
  dialogVisible.value = true;
}

async function handleSubmit() {
  try {
    if (isEdit.value && editId.value) { await request.put('/users/' + editId.value, form.value); ElMessage.success('更新成功'); }
    else { await request.post('/users', form.value); ElMessage.success('创建成功'); }
    dialogVisible.value = false; fetchUsers();
  } catch {}
}

onMounted(() => fetchUsers());
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
</style>
