<template>
  <div class="dict-list">
    <div class="toolbar">
      <h2 class="page-title">数据字典</h2>
      <el-button type="primary" @click="showTypeDialog()">新增字典类型</el-button>
    </div>
    <el-table :data="dictTypes" stripe v-loading="loading" @row-click="(row: any) => { selectedType = row.code; fetchItems(); }" highlight-current-row>
      <el-table-column prop="code" label="字典编码" width="180" />
      <el-table-column prop="name" label="字典名称" />
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button size="small" @click.stop="showTypeDialog(row)">编辑</el-button>
          <el-popconfirm title="确定删除？同时会删除所有字典项" @confirm="handleDeleteType(row.code)"><template #reference><el-button size="small" type="danger" @click.stop>删除</el-button></template></el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <template v-if="selectedType">
      <div class="toolbar" style="margin-top:24px">
        <h3>{{ selectedType }} - 字典项</h3>
        <el-button type="primary" size="small" @click="showItemDialog()">新增字典项</el-button>
      </div>
      <el-table :data="dictItems" stripe>
        <el-table-column prop="code" label="编码" width="150" />
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="sortOrder" label="排序" width="80" />
        <el-table-column label="启用" width="80"><template #default="{ row }"><el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">{{ row.isEnabled ? '是' : '否' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button size="small" @click.stop="showItemDialog(row)">编辑</el-button>
            <el-popconfirm title="确定删除？" @confirm="handleDeleteItem(row.id)"><template #reference><el-button size="small" type="danger" @click.stop>删除</el-button></template></el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </template>

    <!-- 字典类型对话框 -->
    <el-dialog :title="editingType ? '编辑字典类型' : '新增字典类型'" v-model="typeDialogVisible" width="400px" @closed="resetTypeForm">
      <el-form :model="typeForm" label-width="80px">
        <el-form-item label="编码"><el-input v-model="typeForm.code" :disabled="!!editingType" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="typeForm.name" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="typeDialogVisible = false">取消</el-button><el-button type="primary" @click="handleTypeSubmit">确定</el-button></template>
    </el-dialog>

    <!-- 字典项对话框 -->
    <el-dialog :title="editingItem ? '编辑字典项' : '新增字典项'" v-model="itemDialogVisible" width="400px" @closed="resetItemForm">
      <el-form :model="itemForm" label-width="80px">
        <el-form-item label="编码"><el-input v-model="itemForm.code" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="itemForm.name" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="itemForm.sortOrder" :min="0" style="width:100%" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="itemForm.isEnabled" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="itemDialogVisible = false">取消</el-button><el-button type="primary" @click="handleItemSubmit">确定</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const dictTypes = ref<any[]>([]);
const dictItems = ref<any[]>([]);
const loading = ref(false);
const selectedType = ref('');

// 字典类型 CRUD
const typeDialogVisible = ref(false);
const editingType = ref<any>(null);
const typeForm = ref({ code: '', name: '' });

function showTypeDialog(row?: any) {
  editingType.value = row || null;
  if (row) { typeForm.value = { code: row.code, name: row.name }; }
  else { typeForm.value = { code: '', name: '' }; }
  typeDialogVisible.value = true;
}

function resetTypeForm() { editingType.value = null; typeForm.value = { code: '', name: '' }; }

async function handleTypeSubmit() {
  try {
    if (editingType.value) {
      await request.put('/dicts/types/' + editingType.value.code, { name: typeForm.value.name });
      ElMessage.success('更新成功');
    } else {
      await request.post('/dicts/types', typeForm.value);
      ElMessage.success('创建成功');
    }
    typeDialogVisible.value = false;
    fetchTypes();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}

async function handleDeleteType(code: string) {
  try {
    await request.delete('/dicts/types/' + code);
    ElMessage.success('已删除');
    if (selectedType.value === code) { selectedType.value = ''; dictItems.value = []; }
    fetchTypes();
  } catch { ElMessage.error('删除失败'); }
}

// 字典项 CRUD
const itemDialogVisible = ref(false);
const editingItem = ref<any>(null);
const itemForm = ref({ code: '', name: '', sortOrder: 0, isEnabled: true });

function showItemDialog(row?: any) {
  editingItem.value = row || null;
  if (row) { itemForm.value = { code: row.code, name: row.name, sortOrder: row.sortOrder || 0, isEnabled: row.isEnabled !== false }; }
  else { itemForm.value = { code: '', name: '', sortOrder: 0, isEnabled: true }; }
  itemDialogVisible.value = true;
}

function resetItemForm() { editingItem.value = null; itemForm.value = { code: '', name: '', sortOrder: 0, isEnabled: true }; }

async function handleItemSubmit() {
  try {
    if (editingItem.value) {
      await request.put('/dicts/items/' + editingItem.value.id, itemForm.value);
      ElMessage.success('更新成功');
    } else {
      await request.post('/dicts/items', { ...itemForm.value, typeCode: selectedType.value });
      ElMessage.success('创建成功');
    }
    itemDialogVisible.value = false;
    fetchItems();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}

async function handleDeleteItem(id: number) {
  try { await request.delete('/dicts/items/' + id); ElMessage.success('已删除'); fetchItems(); } catch { ElMessage.error('删除失败'); }
}

async function fetchTypes() {
  loading.value = true;
  try { const res = await request.get('/dicts/types'); dictTypes.value = res.data.list; } catch {} finally { loading.value = false; }
}

async function fetchItems() {
  try { const res = await request.get('/dicts/items', { params: { typeCode: selectedType.value } }); dictItems.value = res.data.list; } catch {}
}

onMounted(() => fetchTypes());
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
h3 { margin: 0; font-size: 15px; color: #0A3D62; }
</style>
