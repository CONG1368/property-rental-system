<template>
  <div class="property-list">
    <div class="toolbar">
      <div class="search-group">
        <el-input v-model="searchKeyword" placeholder="搜索房源名称/地址" clearable style="width:220px" @keyup.enter="fetchData" />
        <el-select v-model="filterType" placeholder="业态类型" clearable style="width:130px" @change="fetchData">
          <el-option label="公寓" value="公寓" />
          <el-option label="厂房" value="厂房" />
          <el-option label="商铺" value="商铺" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:130px" @change="fetchData">
          <el-option label="空置" value="空置" />
          <el-option label="已预订" value="已预订" />
          <el-option label="已出租" value="已出租" />
          <el-option label="维修中" value="维修中" />
          <el-option label="退租中" value="退租中" />
        </el-select>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="primary" @click="showDialog()">新增房源</el-button>
        <el-button @click="$router.push('/rent/properties/import')">批量导入</el-button>
      </div>
    </div>

    <!-- 批量操作栏 -->
    <div class="batch-bar" v-if="selectedIds.length > 0">
      <span class="batch-info">已选 {{ selectedIds.length }} 项</span>
      <el-button size="small" type="danger" @click="batchDelete">批量删除</el-button>
      <el-button size="small" @click="clearSelection">取消选择</el-button>
    </div>

    <el-table :data="tableData" stripe v-loading="loading" @row-click="onRowClick" @selection-change="(rows: any[]) => selectedRows = rows" style="cursor:pointer" ref="tableRef">
      <el-table-column type="selection" width="45" />
      <el-table-column prop="name" label="房源名称" width="180" />
      <el-table-column prop="type" label="业态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.type === '公寓' ? '' : row.type === '厂房' ? 'warning' : 'success'" size="small">{{ row.type }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="area" label="面积(㎡)" width="100" />
      <el-table-column prop="address" label="地址" min-width="200" show-overflow-tooltip />
      <el-table-column prop="floor" label="楼层" width="80" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click.stop="showDialog(row)">编辑</el-button>
          <el-popconfirm title="确定删除该房源?" @confirm="handleDelete(row.id)">
            <template #reference>
              <el-button size="small" type="danger" @click.stop>删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      :total="total"
      :page-size="pageSize"
      @current-change="fetchData"
      layout="total, prev, pager, next"
      style="margin-top:16px; justify-content:flex-end"
    />

    <el-dialog :title="isEdit ? '编辑房源' : '新增房源'" v-model="dialogVisible" width="600px" @closed="resetForm">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="房源名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="业态类型" prop="type">
          <el-select v-model="form.type" style="width:100%">
            <el-option label="公寓" value="公寓" /><el-option label="厂房" value="厂房" /><el-option label="商铺" value="商铺" />
          </el-select>
        </el-form-item>
        <el-form-item label="子类型" prop="subType"><el-input v-model="form.subType" /></el-form-item>
        <el-form-item label="面积(㎡)" prop="area"><el-input-number v-model="form.area" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="地址" prop="address"><el-input v-model="form.address" /></el-form-item>
        <el-form-item label="楼层" prop="floor"><el-input v-model="form.floor" /></el-form-item>
        <el-form-item label="单元" prop="unit"><el-input v-model="form.unit" /></el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" style="width:100%">
            <el-option label="空置" value="空置" /><el-option label="已预订" value="已预订" />
            <el-option label="已出租" value="已出租" /><el-option label="维修中" value="维修中" /><el-option label="退租中" value="退租中" />
          </el-select>
        </el-form-item>
        <el-form-item label="业主" prop="owner"><el-input v-model="form.owner" /></el-form-item>
        <el-form-item label="备注" prop="notes"><el-input v-model="form.notes" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { getProperties, createProperty, updateProperty, deleteProperty } from '@/api/properties';

const router = useRouter();

const loading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const searchKeyword = ref('');
const filterType = ref('');
const filterStatus = ref('');

const formRef = ref<FormInstance>();
const dialogVisible = ref(false);
const isEdit = ref(false);
const editId = ref<number | null>(null);
const submitting = ref(false);

const form = reactive({
  name: '', type: '公寓', subType: '', area: 0,
  address: '', floor: '', unit: '', status: '空置', owner: '', notes: '',
});

const rules: FormRules = {
  name: [{ required: true, message: '请输入房源名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择业态类型', trigger: 'change' }],
  area: [{ required: true, message: '请输入面积', trigger: 'blur' }],
};

function statusTagType(status: string): string {
  const map: Record<string, string> = {
    '空置': 'info', '已预订': 'warning', '已出租': 'success', '维修中': 'danger', '退租中': 'danger',
  };
  return map[status] || 'info';
}

async function fetchData() {
  loading.value = true;
  try {
    const res = await getProperties({
      page: page.value, pageSize: pageSize.value,
      keyword: searchKeyword.value || undefined,
      type: filterType.value || undefined,
      status: filterStatus.value || undefined,
    });
    tableData.value = res.data.list;
    total.value = res.data.total;
  } catch { /* handled */ }
  finally { loading.value = false; }
}

function showDialog(row?: any) {
  if (row) {
    isEdit.value = true; editId.value = row.id;
    Object.assign(form, row);
  } else {
    isEdit.value = false; editId.value = null;
    resetForm();
  }
  dialogVisible.value = true;
}

function resetForm() {
  form.name = ''; form.type = '公寓'; form.subType = ''; form.area = 0;
  form.address = ''; form.floor = ''; form.unit = ''; form.status = '空置';
  form.owner = ''; form.notes = '';
}

async function handleSubmit() {
  const valid = await formRef.value?.validate();
  if (!valid) return;
  submitting.value = true;
  try {
    if (isEdit.value && editId.value) {
      await updateProperty(editId.value, { ...form });
      ElMessage.success('房源更新成功');
    } else {
      await createProperty({ ...form });
      ElMessage.success('房源创建成功');
    }
    dialogVisible.value = false;
    fetchData();
  } catch { /* handled */ }
  finally { submitting.value = false; }
}

async function handleDelete(id: number) {
  try {
    await deleteProperty(id);
    ElMessage.success('房源已删除');
    fetchData();
  } catch (err: any) { ElMessage.error('删除失败: ' + (err?.response?.data?.message || '未知错误')); }
}

// ---- 批量操作 ----
const tableRef = ref();
const selectedRows = ref<any[]>([]);
const selectedIds = computed(() => selectedRows.value.map(r => r.id));

function onRowClick(row: any, _col: any, event: Event) {
  const t = event.target as HTMLElement;
  if (t?.closest('.el-checkbox') || t?.closest('.el-button') || t?.closest('.el-popconfirm')) return;
  router.push(`/rent/properties/${row.id}`);
}
function clearSelection() { tableRef.value?.clearSelection(); }

async function batchDelete() {
  const total = selectedIds.value.length;
  try { await ElMessageBox.confirm(`确定批量删除 ${total} 个房源? 此操作不可恢复!`, '批量删除', { type: 'warning' }); } catch { return; }
  let done = 0; const skipped: string[] = [];
  for (const row of selectedRows.value) {
    try { await deleteProperty(row.id); done++; } catch { skipped.push(`${row.name}: 删除失败`); }
  }
  if (skipped.length > 0) {
    ElMessage.warning(`成功删除 ${done} 个，跳过 ${skipped.length} 个\n${skipped.slice(0, 5).join('；')}`);
  } else {
    ElMessage.success(`已删除 ${done} 个房源`);
  }
  clearSelection();
  fetchData();
}

onMounted(() => fetchData());
</script>

<style lang="scss" scoped>
.property-list { padding: 0; }
.toolbar {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
}
.search-group { display: flex; gap: 10px; align-items: center; }
.action-group { display: flex; gap: 10px; }
.batch-bar {
  display: flex; gap: 10px; align-items: center;
  padding: 8px 16px; margin-bottom: 12px;
  background: #ecf5ff; border-radius: 6px; border: 1px solid #b3d8ff;
}
.batch-info { font-size: 13px; color: #409eff; font-weight: 600; margin-right: 8px; }
</style>
