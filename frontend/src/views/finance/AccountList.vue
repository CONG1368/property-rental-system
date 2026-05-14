<template>
  <div class="account-list">
    <div class="toolbar">
      <h2 class="page-title">科目管理</h2>
      <el-button type="primary" @click="showDialog()">新增科目</el-button>
    </div>

    <el-tree :data="treeData" node-key="id" default-expand-all :props="{ label: 'label', children: 'children' }">
      <template #default="{ node, data }">
        <span class="account-node">
          <el-tag :type="typeTag(data.type)" size="small">{{ data.type }}</el-tag>
          <span class="account-code">{{ data.code }}</span>
          <span>{{ data.name }}</span>
          <span class="account-direction">{{ data.direction === '借' ? '[借]' : '[贷]' }}</span>
          <span class="node-actions">
            <el-button link type="primary" size="small" @click.stop="showDialog(data)">编辑</el-button>
            <el-popconfirm title="删除科目？若有子科目将一并保留" @confirm="handleDelete(data.id)"><template #reference><el-button link type="danger" size="small" @click.stop>删除</el-button></template></el-popconfirm>
          </span>
        </span>
      </template>
    </el-tree>

    <el-dialog :title="editing ? '编辑科目' : '新增科目'" v-model="dialogVisible" width="520px" @closed="resetForm">
      <el-form :model="form" label-width="80px">
        <el-form-item label="账套">
          <el-select v-model="form.bookId" style="width:100%" v-if="!editing">
            <el-option v-for="b in books" :key="b.id" :label="b.name" :value="b.id" />
          </el-select>
          <el-input v-else :model-value="form.bookId" disabled />
        </el-form-item>
        <el-form-item label="科目编码"><el-input v-model="form.code" /></el-form-item>
        <el-form-item label="科目名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="类别">
          <el-select v-model="form.type" style="width:100%">
            <el-option label="资产" value="资产" /><el-option label="负债" value="负债" />
            <el-option label="所有者权益" value="所有者权益" /><el-option label="收入" value="收入" />
            <el-option label="费用" value="费用" />
          </el-select>
        </el-form-item>
        <el-form-item label="父级科目">
          <el-tree-select
            v-model="form.parentId"
            :data="treeData"
            :props="{ label: 'label', value: 'id', children: 'children' }"
            check-strictly
            clearable
            placeholder="无（一级科目）"
            style="width:100%"
            filterable
          />
        </el-form-item>
        <el-form-item label="级别"><el-input-number v-model="form.level" :min="1" :max="5" style="width:100%" /></el-form-item>
        <el-form-item label="借贷方向">
          <el-select v-model="form.direction" style="width:100%">
            <el-option label="借方" value="借" /><el-option label="贷方" value="贷" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.isEnabled" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSubmit">确定</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const treeData = ref<any[]>([]);
const flatAccounts = ref<any[]>([]);
const books = ref<any[]>([]);
const dialogVisible = ref(false);
const editing = ref(false);
const editingId = ref<number | null>(null);
const form = ref({ bookId: 0, code: '', name: '', type: '资产', parentId: null as number | null, level: 1, direction: '借', isEnabled: true });

function typeTag(type: string) {
  const map: Record<string, string> = { '资产': '', '负债': 'warning', '所有者权益': 'info', '收入': 'success', '费用': 'danger' };
  return map[type] || '';
}

function buildTree(accounts: any[]): any[] {
  const map = new Map<number, any>();
  accounts.forEach((a: any) => map.set(a.id, { ...a, label: a.code + ' ' + a.name, children: [] }));
  const roots: any[] = [];
  map.forEach((item: any) => {
    if (item.parentId && map.has(item.parentId)) { map.get(item.parentId).children.push(item); }
    else { roots.push(item); }
  });
  return roots;
}

function showDialog(row?: any) {
  if (row) {
    editing.value = true;
    editingId.value = row.id;
    form.value = {
      bookId: row.bookId, code: row.code, name: row.name, type: row.type,
      parentId: row.parentId || null, level: row.level, direction: row.direction,
      isEnabled: row.isEnabled !== false,
    };
  } else {
    editing.value = false;
    form.value = {
      bookId: books.value[0]?.id || 0, code: '', name: '', type: '资产',
      parentId: null, level: 1, direction: '借', isEnabled: true,
    };
  }
  dialogVisible.value = true;
}

function resetForm() { editing.value = false; editingId.value = null; }

async function handleSubmit() {
  try {
    if (editing.value && editingId.value) {
      await request.put('/accounts/' + editingId.value, form.value);
      ElMessage.success('更新成功');
    } else {
      await request.post('/accounts', form.value);
      ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    fetchAccounts();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}

async function handleDelete(id: number) {
  try { await request.delete('/accounts/' + id); ElMessage.success('已删除'); fetchAccounts(); } catch { ElMessage.error('删除失败'); }
}

async function fetchAccounts() {
  try {
    const res = await request.get('/accounts');
    flatAccounts.value = res.data.list || [];
    treeData.value = buildTree(flatAccounts.value);
  } catch {}
}

async function fetchBooks() {
  try { const res = await request.get('/account-books'); books.value = res.data.list || []; } catch {}
}

onMounted(() => { fetchBooks(); fetchAccounts(); });
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.account-node { display: flex; gap: 8px; align-items: center; font-size: 13px; flex: 1; }
.account-code { color: #0A3D62; font-weight: 600; }
.account-direction { color: #7F8C8D; font-size: 10px; }
.node-actions { margin-left: auto; opacity: 0; transition: opacity 0.2s; }
.account-node:hover .node-actions { opacity: 1; }
</style>
