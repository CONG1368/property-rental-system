<template>
  <div class="parking-page">
    <el-row :gutter="16" class="stat-cards">
      <el-col :span="5"><div class="stat-card"><div class="stat-num">{{ stats.total }}</div><div class="stat-label">车位总数</div></div></el-col>
      <el-col :span="5"><div class="stat-card"><div class="stat-num idle">{{ stats.idle }}</div><div class="stat-label">空闲</div></div></el-col>
      <el-col :span="5"><div class="stat-card"><div class="stat-num occ">{{ stats.occupied }}</div><div class="stat-label">临停占用</div></div></el-col>
      <el-col :span="5"><div class="stat-card"><div class="stat-num mon">{{ stats.monthly }}</div><div class="stat-label">月租</div></div></el-col>
      <el-col :span="4"><div class="stat-card"><div class="stat-num mending">{{ stats.mending }}</div><div class="stat-label">维修</div></div></el-col>
    </el-row>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="车位管理" name="spaces">
        <div class="toolbar">
          <div class="search-group">
            <el-input v-model="searchKeyword" placeholder="搜索车位号/车牌" clearable style="width:200px" @keyup.enter="fetchSpaces" />
            <el-select v-model="filterStatus" placeholder="状态" clearable style="width:120px" @change="fetchSpaces">
              <el-option label="空闲" value="空闲" /><el-option label="占用" value="占用" />
              <el-option label="月租" value="月租" /><el-option label="维修" value="维修" /><el-option label="停用" value="停用" />
            </el-select>
            <el-button type="primary" @click="fetchSpaces">查询</el-button>
          </div>
          <div class="action-group"><el-button type="primary" @click="showCreate">新增车位</el-button></div>
        </div>
        <el-table :data="spaces" stripe v-loading="loading">
          <el-table-column prop="spaceNo" label="车位号" width="100" />
          <el-table-column prop="location" label="位置" width="80" />
          <el-table-column prop="type" label="类型" width="80" />
          <el-table-column label="关联房源" width="140" show-overflow-tooltip><template #default="{ row }">{{ row.property?.name }}</template></el-table-column>
          <el-table-column prop="pricePerMonth" label="月租" width="90" align="right"><template #default="{ row }">{{ fmt(row.pricePerMonth) }}</template></el-table-column>
          <el-table-column prop="plateNumber" label="车牌" width="110" />
          <el-table-column prop="status" label="状态" width="90"><template #default="{ row }"><el-tag :type="spaceTag(row.status)" size="small">{{ row.status }}</el-tag></template></el-table-column>
          <el-table-column label="操作" width="210" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link :disabled="['占用','月租'].includes(row.status)" @click="showCheckIn(row)">驶入</el-button>
              <el-button size="small" link :disabled="row.status === '空闲'" @click="checkOut(row)">驶出</el-button>
              <el-button size="small" link @click="showEdit(row)">编辑</el-button>
              <el-button size="small" link type="danger" @click="delSpace(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination v-model:current-page="spacePage" :total="spaceTotal" :page-size="pageSize" @current-change="fetchSpaces" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />
      </el-tab-pane>

      <el-tab-pane label="停车记录" name="records">
        <div class="toolbar">
          <div class="search-group">
            <el-input v-model="recordSearch" placeholder="搜索车牌" clearable style="width:200px" @keyup.enter="fetchRecords" />
            <el-select v-model="recordStatus" placeholder="状态" clearable style="width:120px" @change="fetchRecords">
              <el-option label="进行中" value="进行中" /><el-option label="已支付" value="已支付" />
            </el-select>
            <el-button type="primary" @click="fetchRecords">查询</el-button>
          </div>
        </div>
        <el-table :data="records" stripe v-loading="loading">
          <el-table-column label="车位号" width="100"><template #default="{ row }">{{ row.space?.spaceNo }}</template></el-table-column>
          <el-table-column prop="plateNumber" label="车牌" width="120" />
          <el-table-column prop="type" label="类型" width="80" />
          <el-table-column prop="startTime" label="入场时间" width="170" />
          <el-table-column prop="endTime" label="出场时间" width="170" />
          <el-table-column prop="amount" label="计费" width="100" align="right"><template #default="{ row }">{{ fmt(row.amount) }}</template></el-table-column>
          <el-table-column prop="status" label="状态" width="90"><template #default="{ row }"><el-tag :type="row.status === '进行中' ? 'warning' : 'success'" size="small">{{ row.status }}</el-tag></template></el-table-column>
        </el-table>
        <el-pagination v-model:current-page="recordPage" :total="recordTotal" :page-size="pageSize" @current-change="fetchRecords" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />
      </el-tab-pane>
    </el-tabs>

    <!-- 新增/编辑车位 -->
    <el-dialog :title="editingId ? '编辑车位' : '新增车位'" v-model="dialogVisible" width="520px" @closed="resetForm">
      <el-form :model="form" label-width="90px">
        <el-form-item label="车位号" required><el-input v-model="form.spaceNo" /></el-form-item>
        <el-form-item label="位置"><el-select v-model="form.location" style="width:100%"><el-option label="地面" value="地面" /><el-option label="地下" value="地下" /><el-option label="露天" value="露天" /></el-select></el-form-item>
        <el-form-item label="类型"><el-select v-model="form.type" style="width:100%"><el-option label="月租" value="月租" /><el-option label="临停" value="临停" /><el-option label="专用" value="专用" /><el-option label="公共" value="公共" /></el-select></el-form-item>
        <el-form-item label="月租价格"><el-input-number v-model="form.pricePerMonth" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item label="状态"><el-select v-model="form.status" style="width:100%"><el-option label="空闲" value="空闲" /><el-option label="维修" value="维修" /><el-option label="停用" value="停用" /></el-select></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="handleSubmit">确定</el-button></template>
    </el-dialog>

    <!-- 驶入 -->
    <el-dialog title="车辆驶入登记" v-model="checkInVisible" width="420px">
      <el-form :model="checkInForm" label-width="90px">
        <el-form-item label="车位号"><span>{{ currentSpace?.spaceNo }}</span></el-form-item>
        <el-form-item label="车牌号" required><el-input v-model="checkInForm.plateNumber" /></el-form-item>
        <el-form-item label="类型"><el-select v-model="checkInForm.type" style="width:100%"><el-option label="临停" value="临停" /><el-option label="月租" value="月租" /></el-select></el-form-item>
      </el-form>
      <template #footer><el-button @click="checkInVisible = false">取消</el-button><el-button type="primary" @click="handleCheckIn">确认驶入</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/api/request';

const activeTab = ref('spaces');
const stats = ref({ total: 0, idle: 0, occupied: 0, monthly: 0, mending: 0 });
const loading = ref(false);
// 车位
const spaces = ref<any[]>([]); const spacePage = ref(1); const spaceTotal = ref(0); const pageSize = ref(20);
const searchKeyword = ref(''); const filterStatus = ref('');
// 记录
const records = ref<any[]>([]); const recordPage = ref(1); const recordTotal = ref(0);
const recordSearch = ref(''); const recordStatus = ref('');
// 对话框
const dialogVisible = ref(false); const editingId = ref<number | null>(null);
const form = ref({ spaceNo: '', location: '地面', type: '月租', pricePerMonth: 0, status: '空闲', notes: '' });
const checkInVisible = ref(false); const currentSpace = ref<any>(null);
const checkInForm = ref({ plateNumber: '', type: '临停' });

function fmt(v: any): string { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }); }
function spaceTag(s: string): string { return ({ '空闲': 'success', '占用': 'danger', '月租': 'primary', '维修': 'warning', '停用': 'info' } as Record<string, string>)[s] || 'info'; }

async function fetchStats() {
  try { const res = await request.get('/parking/spaces/stats'); stats.value = res.data || { total: 0, idle: 0, occupied: 0, monthly: 0, mending: 0 }; } catch { /* 静默 */ }
}
async function fetchSpaces() {
  loading.value = true;
  try {
    const params: any = { page: spacePage.value, pageSize: pageSize.value };
    if (searchKeyword.value) params.keyword = searchKeyword.value;
    if (filterStatus.value) params.status = filterStatus.value;
    const res = await request.get('/parking/spaces', { params });
    spaces.value = res.data?.list || []; spaceTotal.value = res.data?.total || 0;
    fetchStats();
  } catch { /* 静默 */ } finally { loading.value = false; }
}
async function fetchRecords() {
  loading.value = true;
  try {
    const params: any = { page: recordPage.value, pageSize: pageSize.value };
    if (recordSearch.value) params.keyword = recordSearch.value;
    if (recordStatus.value) params.status = recordStatus.value;
    const res = await request.get('/parking/records', { params });
    records.value = res.data?.list || []; recordTotal.value = res.data?.total || 0;
  } catch { /* 静默 */ } finally { loading.value = false; }
}
function resetForm() { editingId.value = null; form.value = { spaceNo: '', location: '地面', type: '月租', pricePerMonth: 0, status: '空闲', notes: '' }; }
function showCreate() { resetForm(); dialogVisible.value = true; }
function showEdit(row: any) { editingId.value = row.id; form.value = { spaceNo: row.spaceNo, location: row.location, type: row.type, pricePerMonth: Number(row.pricePerMonth), status: row.status === '占用' || row.status === '月租' ? '空闲' : row.status, notes: row.notes || '' }; dialogVisible.value = true; }
async function handleSubmit() {
  if (!form.value.spaceNo) return ElMessage.warning('请输入车位号');
  try {
    if (editingId.value) { await request.put(`/parking/spaces/${editingId.value}`, form.value); ElMessage.success('更新成功'); }
    else { await request.post('/parking/spaces', form.value); ElMessage.success('创建成功'); }
    dialogVisible.value = false; fetchSpaces();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}
function showCheckIn(row: any) { currentSpace.value = row; checkInForm.value = { plateNumber: '', type: '临停' }; checkInVisible.value = true; }
async function handleCheckIn() {
  if (!checkInForm.value.plateNumber) return ElMessage.warning('请输入车牌号');
  try {
    await request.post(`/parking/spaces/${currentSpace.value.id}/check-in`, checkInForm.value);
    ElMessage.success('已登记驶入'); checkInVisible.value = false; fetchSpaces();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}
async function checkOut(row: any) {
  try {
    const res = await request.post(`/parking/spaces/${row.id}/check-out`, {});
    ElMessage.success(`计费 ${res.data?.amount ?? 0} 元`); fetchSpaces();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}
async function delSpace(id: number) {
  try { await ElMessageBox.confirm('确定删除该车位?', '删除', { type: 'warning' }); } catch { return; }
  try { await request.delete(`/parking/spaces/${id}`); ElMessage.success('已删除'); fetchSpaces(); } catch (err: any) { ElMessage.error('删除失败'); }
}
onMounted(() => { fetchSpaces(); fetchRecords(); });
</script>

<style lang="scss" scoped>
.parking-page { padding: 0; }
.stat-cards { margin-bottom: 16px; }
.stat-card { background: #fff; border: 1px solid #ebeef5; border-radius: 8px; padding: 18px; text-align: center; }
.stat-num { font-size: 24px; font-weight: 700; color: #0A3D62; }
.stat-num.idle { color: #67C23A; }
.stat-num.occ { color: #F56C6C; }
.stat-num.mon { color: #409EFF; }
.stat-num.mending { color: #E6A23C; }
.stat-label { margin-top: 6px; color: #909399; font-size: 13px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.search-group { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.action-group { display: flex; gap: 8px; }
</style>