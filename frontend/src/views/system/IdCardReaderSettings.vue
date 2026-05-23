<template>
  <div class="id-card-reader-settings">
    <h2 class="page-title">身份证读卡器管理</h2>

    <!-- 设备列表 -->
    <el-card header="读卡器设备" style="margin-bottom:16px">
      <template #header>
        <span>读卡器设备</span>
        <el-button size="small" type="primary" style="margin-left:12px" @click="showAddDialog">添加设备</el-button>
      </template>
      <el-table :data="devices" size="small" v-loading="loading">
        <el-table-column prop="name" label="设备名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="brand" label="品牌" width="90" />
        <el-table-column prop="model" label="型号" width="120" />
        <el-table-column prop="interfaceType" label="接口" width="70" />
        <el-table-column prop="port" label="端口" width="100" show-overflow-tooltip />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="firmwareVersion" label="固件" width="80" />
        <el-table-column label="最近读卡" width="140">
          <template #default="{ row }">{{ row.lastReadAt?.slice(0, 16)?.replace('T', ' ') || '--' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="success" @click="handleTestRead(row)">测试读卡</el-button>
            <el-button size="small" @click="showEditDialog(row)">编辑</el-button>
            <el-popconfirm title="确定删除该设备?" @confirm="handleDelete(row.id)">
              <template #reference><el-button size="small" type="danger">删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 读卡日志 -->
    <el-card header="读卡日志">
      <el-table :data="logs" size="small" v-loading="logLoading">
        <el-table-column label="设备" min-width="120">
          <template #default="{ row }">{{ row.reader?.name || '--' }}</template>
        </el-table-column>
        <el-table-column prop="method" label="方式" width="70" />
        <el-table-column label="结果" width="80">
          <template #default="{ row }">
            <el-tag :type="row.result === '成功' ? 'success' : 'danger'" size="small">{{ row.result }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="idNumber" label="身份证号" width="160" />
        <el-table-column prop="errorMessage" label="失败原因" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作时间" width="160">
          <template #default="{ row }">{{ row.createdAt?.slice(0, 16)?.replace('T', ' ') }}</template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="logPage"
        :page-size="20"
        :total="logTotal"
        layout="total, prev, pager, next"
        @current-change="fetchLogs"
        style="margin-top:12px;justify-content:center"
      />
    </el-card>

    <!-- 添加/编辑设备对话框 -->
    <el-dialog :title="dialogTitle" v-model="dialogVisible" width="500px" @closed="resetForm">
      <el-form :model="form" label-width="100px">
        <el-form-item label="设备名称" required>
          <el-input v-model="form.name" placeholder="如：前台读卡器" />
        </el-form-item>
        <el-form-item label="品牌" required>
          <el-select v-model="form.brand" style="width:100%">
            <el-option label="华视" value="华视" />
            <el-option label="新中新" value="新中新" />
            <el-option label="普天" value="普天" />
            <el-option label="精伦" value="精伦" />
            <el-option label="中控" value="中控" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="型号">
          <el-input v-model="form.model" placeholder="如：CVR-100UC" />
        </el-form-item>
        <el-form-item label="接口类型">
          <el-select v-model="form.interfaceType" style="width:100%">
            <el-option label="USB" value="USB" />
            <el-option label="串口" value="串口" />
            <el-option label="蓝牙" value="蓝牙" />
            <el-option label="WiFi" value="WiFi" />
          </el-select>
        </el-form-item>
        <el-form-item label="端口号">
          <el-input v-model="form.port" placeholder="如：COM3 或 /dev/ttyUSB0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width:100%">
            <el-option label="在线" value="在线" />
            <el-option label="离线" value="离线" />
            <el-option label="故障" value="故障" />
            <el-option label="未激活" value="未激活" />
          </el-select>
        </el-form-item>
        <el-form-item label="固件版本">
          <el-input v-model="form.firmwareVersion" placeholder="如：V2.3.1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 读卡结果对话框 -->
    <el-dialog title="读卡结果" v-model="resultVisible" width="450px">
      <el-descriptions v-if="readResult" :column="1" border size="small">
        <el-descriptions-item label="姓名">{{ readResult.name }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ readResult.gender }}</el-descriptions-item>
        <el-descriptions-item label="民族">{{ readResult.ethnicity }}</el-descriptions-item>
        <el-descriptions-item label="出生日期">{{ readResult.birthDate }}</el-descriptions-item>
        <el-descriptions-item label="身份证号">{{ readResult.idNumber }}</el-descriptions-item>
        <el-descriptions-item label="地址">{{ readResult.address }}</el-descriptions-item>
        <el-descriptions-item label="签发机关">{{ readResult.issuingAuthority }}</el-descriptions-item>
        <el-descriptions-item label="有效期">{{ readResult.validFrom }} 至 {{ readResult.validTo }}</el-descriptions-item>
      </el-descriptions>
      <el-alert v-if="readWarnings.length > 0" :title="readWarnings.join('；')" type="warning" show-icon style="margin-top:12px" />
      <template #footer><el-button type="primary" @click="resultVisible = false">关闭</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const loading = ref(false);
const saving = ref(false);
const logLoading = ref(false);
const devices = ref<any[]>([]);
const logs = ref<any[]>([]);
const logPage = ref(1);
const logTotal = ref(0);

const dialogVisible = ref(false);
const dialogTitle = computed(() => editingId.value ? '编辑设备' : '添加设备');
const editingId = ref<number | null>(null);

const form = reactive({
  name: '', brand: '华视', model: '', interfaceType: 'USB', port: '', status: '未激活', firmwareVersion: '',
});

function resetForm() {
  editingId.value = null;
  Object.assign(form, { name: '', brand: '华视', model: '', interfaceType: 'USB', port: '', status: '未激活', firmwareVersion: '' });
}

function showAddDialog() { resetForm(); dialogVisible.value = true; }
function showEditDialog(row: any) {
  editingId.value = row.id;
  Object.assign(form, { name: row.name, brand: row.brand, model: row.model, interfaceType: row.interfaceType, port: row.port, status: row.status, firmwareVersion: row.firmwareVersion });
  dialogVisible.value = true;
}

async function fetchDevices() {
  loading.value = true;
  try {
    const res = await request.get('/id-card-readers', { params: { pageSize: 50 } });
    devices.value = res.data?.list || [];
  } catch { /* ignore */ }
  finally { loading.value = false; }
}

async function fetchLogs() {
  logLoading.value = true;
  try {
    const res = await request.get('/id-card-readers/logs', { params: { page: logPage.value, pageSize: 20 } });
    logs.value = res.data?.list || [];
    logTotal.value = res.data?.total || 0;
  } catch { /* ignore */ }
  finally { logLoading.value = false; }
}

async function handleSave() {
  saving.value = true;
  try {
    if (editingId.value) {
      await request.put('/id-card-readers/' + editingId.value, { ...form });
      ElMessage.success('设备已更新');
    } else {
      await request.post('/id-card-readers', { ...form });
      ElMessage.success('设备已添加');
    }
    dialogVisible.value = false;
    fetchDevices();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '保存失败');
  } finally { saving.value = false; }
}

async function handleDelete(id: number) {
  try {
    await request.delete('/id-card-readers/' + id);
    ElMessage.success('已删除');
    fetchDevices();
  } catch { ElMessage.error('删除失败'); }
}

// 测试读卡
const resultVisible = ref(false);
const readResult = ref<any>(null);
const readWarnings = ref<string[]>([]);

async function handleTestRead(row: any) {
  try {
    const res = await request.post('/id-card-readers/' + row.id + '/read');
    readResult.value = res.data;
    readWarnings.value = (res as any).warnings || [];
    resultVisible.value = true;
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '读卡失败');
  }
}

function statusTagType(status: string) {
  const map: Record<string, string> = { '在线': 'success', '离线': 'info', '故障': 'danger', '未激活': 'warning' };
  return map[status] || 'info';
}

onMounted(() => { fetchDevices(); fetchLogs(); });
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
</style>
