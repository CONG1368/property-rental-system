<template>
  <div class="user-list">
    <h2 class="page-title">用户管理</h2>
    <el-button type="primary" style="margin-bottom:16px" @click="showDialog()">新增用户</el-button>
    <el-button style="margin-bottom:16px; margin-left:8px" @click="showPermissionMatrix">权限矩阵</el-button>
    <el-table :data="users" stripe v-loading="loading">
      <el-table-column label="头像" width="70" align="center">
        <template #default="{ row }">
          <img v-if="row.permissions?.avatarUrl" :src="row.permissions.avatarUrl" class="avatar-img-sm" />
          <span v-else class="avatar-icon-sm" :style="{ background: getRoleBg(row.role) }">{{ getRoleIcon(row) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="username" label="用户名" width="110" />
      <el-table-column prop="displayName" label="姓名" width="110" />
      <el-table-column prop="role" label="角色" width="100">
        <template #default="{ row }">
          <el-tag :type="row.role === '管理员' ? 'danger' : row.role === '总经理' ? 'warning' : 'info'" size="small">{{ row.role }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="可访问模块" min-width="240">
        <template #default="{ row }">
          <span style="font-size:12px;color:#606266">{{ getRoleModules(row.role) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="80"><template #default="{ row }"><el-tag :type="row.status === '正常' ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag></template></el-table-column>
      <el-table-column prop="lastLogin" label="最后登录" width="160"><template #default="{ row }">{{ row.lastLogin?.slice(0, 16)?.replace('T', ' ') || '-' }}</template></el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button size="small" @click="showDialog(row)">编辑</el-button>
          <el-button size="small" type="warning" @click="showResetPwd(row)">重置密码</el-button>
          <el-popconfirm title="确定删除该用户?" @confirm="handleDelete(row.id)"><template #reference><el-button size="small" type="danger">删除</el-button></template></el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑对话框 -->
    <el-dialog :title="isEdit ? '编辑用户' : '新增用户'" v-model="dialogVisible" width="450px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="用户名"><el-input v-model="form.username" :disabled="isEdit" /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="form.displayName" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width:100%" @change="onRoleChange"><el-option v-for="r in roles" :key="r" :label="r" :value="r" /></el-select>
        </el-form-item>
        <el-form-item label="密码" v-if="!isEdit"><el-input v-model="form.password" type="password" placeholder="留空则自动生成" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSubmit">确定</el-button></template>
    </el-dialog>

    <!-- 重置密码对话框 -->
    <el-dialog title="重置密码" v-model="resetPwdVisible" width="380px">
      <el-form label-width="80px">
        <el-form-item label="用户名"><span>{{ resetUser?.username }}</span></el-form-item>
        <el-form-item label="新密码"><el-input v-model="newPassword" type="password" placeholder="请输入新密码" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="resetPwdVisible = false">取消</el-button><el-button type="primary" @click="handleResetPwd">确认重置</el-button></template>
    </el-dialog>

    <!-- 权限矩阵对话框 -->
    <el-dialog title="角色权限矩阵" v-model="permMatrixVisible" width="800px">
      <el-table :data="rolePermMatrix" stripe size="small">
        <el-table-column prop="role" label="角色" width="100" />
        <el-table-column label="租赁管理" width="150">
          <template #default="{ row }"><el-tag :type="row.rent ? 'success' : 'info'" size="small">{{ row.rent ? '可访问' : '无权限' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="财务管理" width="150">
          <template #default="{ row }"><el-tag :type="row.finance ? 'success' : 'info'" size="small">{{ row.finance ? '可访问' : '无权限' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="合同管理" width="150">
          <template #default="{ row }"><el-tag :type="row.contract ? 'success' : 'info'" size="small">{{ row.contract ? '可访问' : '无权限' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="系统设置" width="150">
          <template #default="{ row }"><el-tag :type="row.system ? 'success' : 'info'" size="small">{{ row.system ? '可访问' : '无权限' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="权限级别" min-width="120">
          <template #default="{ row }"><span style="font-size:12px">{{ row.level }}</span></template>
        </el-table-column>
      </el-table>
      <div style="margin-top:12px;font-size:12px;color:#909399">
        角色权限由系统预定义，如需调整请在"编辑用户"中修改用户角色。仅<strong>管理员</strong>拥有系统设置访问权限。
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';
import { getRoleAvatar } from '@/utils/avatars';

function getRoleIcon(row: any) { return row.permissions?.avatar || getRoleAvatar(row.role).icon; }
function getRoleBg(role: string) { return getRoleAvatar(role).bg; }

const roles = ['管理员','收租主管','收租员','财务主管','会计','出纳','合同主管','法务','总经理'];

// 角色模块权限映射
const roleModules: Record<string, string> = {
  '管理员': '全部模块（租赁/财务/合同/系统设置）',
  '总经理': '租赁/财务/合同（不含系统设置）',
  '收租主管': '租赁管理全部',
  '收租员': '租赁管理全部',
  '财务主管': '财务管理全部',
  '会计': '财务管理（账套/科目/凭证/税务/报表）',
  '出纳': '财务管理（费用/凭证）',
  '合同主管': '合同管理全部',
  '法务': '合同管理/合规管理',
};

function getRoleModules(role: string) {
  return roleModules[role] || '无';
}

const users = ref<any[]>([]); const loading = ref(false);
const dialogVisible = ref(false); const isEdit = ref(false); const editId = ref<number | null>(null);
const form = ref({ username: '', displayName: '', role: '收租员', password: '' });

const resetPwdVisible = ref(false);
const resetUser = ref<any>(null);
const newPassword = ref('');

const permMatrixVisible = ref(false);

// 权限矩阵数据
const rolePermMatrix = ref([
  { role: '管理员', rent: true, finance: true, contract: true, system: true, level: '全部权限' },
  { role: '总经理', rent: true, finance: true, contract: true, system: false, level: '业务全权限' },
  { role: '收租主管', rent: true, finance: false, contract: false, system: false, level: '租赁模块' },
  { role: '收租员', rent: true, finance: false, contract: false, system: false, level: '租赁模块' },
  { role: '财务主管', rent: false, finance: true, contract: false, system: false, level: '财务模块' },
  { role: '会计', rent: false, finance: true, contract: false, system: false, level: '财务模块' },
  { role: '出纳', rent: false, finance: true, contract: false, system: false, level: '财务模块(受限)' },
  { role: '合同主管', rent: false, finance: false, contract: true, system: false, level: '合同模块' },
  { role: '法务', rent: false, finance: false, contract: true, system: false, level: '合同/合规' },
]);

function showPermissionMatrix() {
  permMatrixVisible.value = true;
}

function onRoleChange(_role: string) {
  // 角色变更时无需额外操作，后端根据role字段判断权限
}

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
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}

function showResetPwd(row: any) {
  resetUser.value = row;
  newPassword.value = '';
  resetPwdVisible.value = true;
}

async function handleResetPwd() {
  if (!newPassword.value) { ElMessage.error('请输入新密码'); return; }
  try {
    await request.put('/users/' + resetUser.value.id, { password: newPassword.value });
    ElMessage.success('密码已重置');
    resetPwdVisible.value = false;
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '重置失败'); }
}

async function handleDelete(id: number) {
  try { await request.delete('/users/' + id); ElMessage.success('已删除'); fetchUsers(); } catch { ElMessage.error('删除失败'); }
}

onMounted(() => fetchUsers());
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.avatar-icon-sm {
  width: 30px; height: 30px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 16px; color: #fff;
}
.avatar-img-sm { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; }
</style>
