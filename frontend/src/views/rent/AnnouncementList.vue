<template>
  <div class="announcement-list">
    <h2 class="page-title">公告通知</h2>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">总公告</div>
      </div>
      <div class="stat-card published">
        <div class="stat-value">{{ stats.published }}</div>
        <div class="stat-label">已发布</div>
      </div>
      <div class="stat-card draft">
        <div class="stat-value">{{ stats.draft }}</div>
        <div class="stat-label">草稿</div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="search-group">
        <el-input v-model="filters.keyword" placeholder="搜索标题/内容" clearable style="width:220px" @keyup.enter="fetchData" />
        <el-select v-model="filters.status" placeholder="状态" clearable style="width:130px" @change="fetchData">
          <el-option label="草稿" value="草稿" />
          <el-option label="已发布" value="已发布" />
          <el-option label="已撤回" value="已撤回" />
        </el-select>
        <el-select v-model="filters.category" placeholder="类别" clearable style="width:130px" @change="fetchData">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="primary" @click="showDialog(null)">新建公告</el-button>
      </div>
    </div>

    <!-- 表格 -->
    <el-table :data="list" stripe v-loading="loading" style="margin-top:12px">
      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
      <el-table-column prop="category" label="类别" width="110">
        <template #default="{ row }"><el-tag :type="categoryTagType(row.category)" size="small">{{ row.category }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }"><el-tag :type="statusTagType(row.status)" size="small">{{ row.status }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="publisher" label="发布人" width="110" />
      <el-table-column prop="publishDate" label="发布日期" width="120">
        <template #default="{ row }">{{ row.publishDate || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="230" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status !== '已发布'" size="small" type="success" @click="handlePublish(row)">发布</el-button>
          <el-button v-if="row.status === '已发布'" size="small" type="warning" @click="handleRevoke(row)">撤回</el-button>
          <el-button size="small" @click="showDialog(row)">编辑</el-button>
          <el-popconfirm title="确认删除?" @confirm="handleDelete(row.id)">
            <template #reference><el-button size="small" type="danger">删除</el-button></template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-if="total > 0"
      v-model:current-page="page"
      :page-size="pageSize"
      :total="total"
      @current-change="fetchData"
      layout="total, prev, pager, next"
      style="margin-top:16px; justify-content:flex-end"
    />

    <!-- 新建/编辑弹窗 -->
    <el-dialog :title="editing ? '编辑公告' : '新建公告'" v-model="dialogVisible" width="600px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="标题" required><el-input v-model="form.title" placeholder="请输入公告标题" /></el-form-item>
        <el-form-item label="类别">
          <el-select v-model="form.category" style="width:100%">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" :rows="6" placeholder="请输入公告内容" /></el-form-item>
        <el-form-item label="发布范围">
          <el-select v-model="form.target" style="width:100%">
            <el-option v-for="t in targets" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.target === '指定房源'" label="指定房源">
          <el-select v-model="form.propertyId" style="width:100%" filterable clearable placeholder="选择房源">
            <el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">{{ editing ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const categories = ['公告', '通知', '活动', '租务提示'];
const targets = ['全体租客', '全体业主', '指定房源', '全体'];

const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const filters = reactive<any>({ keyword: '', status: '', category: '' });
const stats = reactive({ total: 0, published: 0, draft: 0 });
const properties = ref<any[]>([]);

const dialogVisible = ref(false);
const editing = ref(false);
const form = reactive<any>({ id: null, title: '', category: '公告', content: '', target: '全体', propertyId: null });

function statusTagType(status: string) {
  const map: Record<string, string> = { '草稿': 'warning', '已发布': 'success', '已撤回': 'info' };
  return map[status] || 'info';
}
function categoryTagType(category: string) {
  const map: Record<string, string> = { '公告': '', '通知': 'success', '活动': 'warning', '租务提示': 'info' };
  return map[category] || 'info';
}

async function fetchStats() {
  try { const r = await request.get('/announcements', { params: { pageSize: 1 } }); stats.total = r.data.total || 0; } catch {}
  try { const r = await request.get('/announcements', { params: { status: '已发布', pageSize: 1 } }); stats.published = r.data.total || 0; } catch {}
  try { const r = await request.get('/announcements', { params: { status: '草稿', pageSize: 1 } }); stats.draft = r.data.total || 0; } catch {}
}

async function fetchProperties() {
  try { const r = await request.get('/properties', { params: { pageSize: 500 } }); properties.value = r.data.list || []; } catch {}
}

async function fetchData() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (filters.status) params.status = filters.status;
    if (filters.category) params.category = filters.category;
    if (filters.keyword) params.keyword = filters.keyword;
    const res = await request.get('/announcements', { params });
    list.value = res.data.list || [];
    total.value = res.data.total || 0;
  } catch {} finally { loading.value = false; }
}

function showDialog(row: any) {
  editing.value = !!row;
  if (row) {
    Object.assign(form, { id: row.id, title: row.title, category: row.category, content: row.content, target: row.target, propertyId: row.propertyId });
  } else {
    Object.assign(form, { id: null, title: '', category: '公告', content: '', target: '全体', propertyId: null });
  }
  dialogVisible.value = true;
}

async function handleSave() {
  if (!form.title) { ElMessage.warning('请输入标题'); return; }
  try {
    const payload: any = { title: form.title, category: form.category, content: form.content, target: form.target, propertyId: form.target === '指定房源' ? form.propertyId : null };
    if (editing.value) { await request.put('/announcements/' + form.id, payload); ElMessage.success('已更新'); }
    else { await request.post('/announcements', payload); ElMessage.success('已创建'); }
    dialogVisible.value = false;
    fetchData(); fetchStats();
  } catch {}
}

async function handlePublish(row: any) {
  try { await request.post('/announcements/' + row.id + '/publish'); ElMessage.success('已发布'); fetchData(); fetchStats(); } catch {}
}
async function handleRevoke(row: any) {
  try { await request.post('/announcements/' + row.id + '/revoke'); ElMessage.success('已撤回'); fetchData(); fetchStats(); } catch {}
}
async function handleDelete(id: number) {
  try { await request.delete('/announcements/' + id); ElMessage.success('已删除'); fetchData(); fetchStats(); } catch {}
}

onMounted(() => { fetchStats(); fetchProperties(); fetchData(); });
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.announcement-list {
  .stats-row {
    display: flex; gap: 16px; margin-bottom: 16px;
    .stat-card {
      flex: 1; background: #fff; border-radius: 8px; padding: 16px 20px;
      text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      .stat-value { font-size: 28px; font-weight: 700; color: #303133; }
      .stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
      &.published { border-left: 4px solid #67C23A; }
      &.draft { border-left: 4px solid #E6A23C; }
    }
  }
  .toolbar {
    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap:10px;
    .search-group { display: flex; gap:10px; align-items: center; flex-wrap: wrap; }
  }
}
</style>
