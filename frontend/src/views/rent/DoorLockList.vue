<template>
  <div class="doorlock-list">
    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">门锁总数</div>
      </div>
      <div class="stat-card smart">
        <div class="stat-value">{{ stats.smartCount }}</div>
        <div class="stat-label">智能门锁</div>
      </div>
      <div class="stat-card traditional">
        <div class="stat-value">{{ stats.traditionalCount }}</div>
        <div class="stat-label">传统门锁</div>
      </div>
      <div class="stat-card" :class="stats.alertCount > 0 ? 'warning' : ''">
        <div class="stat-value">{{ stats.alertCount }}</div>
        <div class="stat-label">异常/低电</div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="search-group">
        <el-input v-model="searchKeyword" placeholder="搜索门锁名称/序列号" clearable style="width:220px" @keyup.enter="fetchData" />
        <el-select v-model="filterCategory" placeholder="门锁品类" clearable style="width:140px" @change="fetchData">
          <el-option label="智能门锁" value="智能门锁" />
          <el-option label="传统门锁" value="传统门锁" />
        </el-select>
        <el-select v-model="filterPropertyId" placeholder="所属房源" clearable filterable style="width:180px" @change="fetchData">
          <el-option v-for="p in propertyList" :key="p.id" :label="p.name" :value="p.id" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:130px" @change="fetchData">
          <el-option v-if="filterCategory !== '传统门锁'" label="在线" value="在线" />
          <el-option v-if="filterCategory !== '传统门锁'" label="离线" value="离线" />
          <el-option v-if="filterCategory !== '传统门锁'" label="故障" value="故障" />
          <el-option v-if="filterCategory !== '传统门锁'" label="未激活" value="未激活" />
          <el-option v-if="filterCategory !== '智能门锁'" label="正常" value="正常" />
          <el-option v-if="filterCategory !== '智能门锁'" label="需维修" value="需维修" />
          <el-option v-if="filterCategory !== '智能门锁'" label="已报废" value="已报废" />
        </el-select>
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <div class="action-group">
        <el-button type="primary" @click="showCreateDialog()">注册门锁</el-button>
      </div>
    </div>

    <!-- 表格 -->
    <el-table :data="tableData" stripe v-loading="loading" style="margin-top:12px">
      <el-table-column prop="name" label="门锁名称" width="200" />
      <el-table-column label="所属房源" width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.property?.name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="category" label="品类" width="90">
        <template #default="{ row }">
          <el-tag :type="row.category === '智能门锁' ? '' : 'info'" size="small">{{ row.category }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="lockType" label="门锁类型" width="120" />
      <el-table-column label="品牌/型号" width="150">
        <template #default="{ row }">{{ row.manufacturer }}{{ row.model ? ' / ' + row.model : '' }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row)" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="电量/锁芯" width="110">
        <template #default="{ row }">
          <template v-if="row.category === '智能门锁' && row.battery != null">
            <el-progress :percentage="row.battery" :stroke-width="6" :color="row.battery <= 30 ? '#F56C6C' : row.battery <= 60 ? '#E6A23C' : '#67C23A'" />
          </template>
          <template v-else-if="row.category === '传统门锁'">
            <el-tag size="small" :type="row.lockCylinder === 'C级' || row.lockCylinder === '超B级' ? 'success' : 'warning'">{{ row.lockCylinder || '-' }}</el-tag>
          </template>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="钥匙/密码" width="100">
        <template #default="{ row }">
          <template v-if="row.category === '智能门锁'">
            <span style="color:#409EFF">{{ row.passwords?.filter((p: any) => p.isActive).length || 0 }} 有效</span>
          </template>
          <template v-else>
            <span>{{ row.keys?.filter((k: any) => k.keyStatus === '在库').length || 0 }} 在库 / {{ row.keys?.filter((k: any) => k.keyStatus === '借出').length || 0 }} 借出</span>
          </template>
        </template>
      </el-table-column>
      <el-table-column label="最后在线" width="160">
        <template #default="{ row }">
          {{ row.lastOnlineAt ? new Date(row.lastOnlineAt).toLocaleString() : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <template v-if="row.category === '智能门锁'">
            <el-button size="small" type="success" @click="remoteOpen(row)">远程开锁</el-button>
            <el-button size="small" type="warning" @click="showPwdDialog(row)">临时密码</el-button>
          </template>
          <template v-else>
            <el-button size="small" type="warning" @click="showKeyLendDialog(row)">钥匙借出</el-button>
          </template>
          <el-button size="small" @click="goDetail(row.id)">详情</el-button>
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

    <!-- ====== 注册/编辑门锁弹窗 ====== -->
    <el-dialog :title="isEdit ? '编辑门锁' : '注册门锁'" v-model="dialogVisible" width="650px" @closed="resetForm">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="110px">
        <el-form-item label="门锁名称" prop="name"><el-input v-model="form.name" placeholder="如 A栋301室入户门锁" /></el-form-item>
        <el-form-item label="门锁品类" prop="category">
          <el-radio-group v-model="form.category" @change="onCategoryChange">
            <el-radio label="智能门锁">智能门锁</el-radio>
            <el-radio label="传统门锁">传统门锁</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="所属房源" prop="propertyId">
          <el-select v-model="form.propertyId" style="width:100%" filterable placeholder="选择房源">
            <el-option v-for="p in propertyList" :key="p.id" :label="p.name + ' (' + p.address + ')'" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="门锁类型" prop="lockType">
          <el-select v-model="form.lockType" style="width:100%" filterable placeholder="选择门锁类型">
            <template v-if="form.category === '智能门锁'">
              <el-option v-for="t in smartLockTypes" :key="t" :label="t" :value="t" />
            </template>
            <template v-else>
              <el-option v-for="t in traditionalLockTypes" :key="t" :label="t" :value="t" />
            </template>
          </el-select>
        </el-form-item>
        <el-form-item label="品牌" prop="manufacturer">
          <el-select v-model="form.manufacturer" style="width:100%" filterable allow-create placeholder="选择或输入品牌">
            <template v-if="form.category === '智能门锁'">
              <el-option v-for="b in smartBrands" :key="b" :label="b" :value="b" />
            </template>
            <template v-else>
              <el-option v-for="b in traditionalBrands" :key="b" :label="b" :value="b" />
            </template>
          </el-select>
        </el-form-item>
        <el-form-item label="型号"><el-input v-model="form.model" /></el-form-item>
        <el-form-item label="序列号"><el-input v-model="form.sn" /></el-form-item>
        <el-form-item label="安装日期"><el-date-picker v-model="form.installDate" type="date" placeholder="选择日期" style="width:100%" value-format="YYYY-MM-DD" /></el-form-item>

        <!-- 智能门锁专属字段 -->
        <template v-if="form.category === '智能门锁'">
          <el-form-item label="IoT设备ID"><el-input v-model="form.deviceId" placeholder="IoT平台设备ID（Mock可留空）" /></el-form-item>
          <el-form-item label="状态">
            <el-select v-model="form.status" style="width:100%">
              <el-option label="在线" value="在线" />
              <el-option label="离线" value="离线" />
              <el-option label="故障" value="故障" />
              <el-option label="未激活" value="未激活" />
            </el-select>
          </el-form-item>
        </template>

        <!-- 传统门锁专属字段 -->
        <template v-if="form.category === '传统门锁'">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="锁芯等级">
                <el-select v-model="form.lockCylinder" style="width:100%">
                  <el-option label="A级" value="A级" />
                  <el-option label="B级" value="B级" />
                  <el-option label="C级" value="C级" />
                  <el-option label="超B级" value="超B级" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="材质">
                <el-select v-model="form.material" style="width:100%">
                  <el-option label="不锈钢" value="不锈钢" />
                  <el-option label="铜" value="铜" />
                  <el-option label="锌合金" value="锌合金" />
                  <el-option label="铝合金" value="铝合金" />
                  <el-option label="铁" value="铁" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-form-item label="钥匙类型">
            <el-select v-model="form.keyType" style="width:100%">
              <el-option label="普通钥匙" value="普通钥匙" />
              <el-option label="异形钥匙" value="异形钥匙" />
              <el-option label="磁性钥匙" value="磁性钥匙" />
              <el-option label="电子钥匙" value="电子钥匙" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="form.status" style="width:100%">
              <el-option label="正常" value="正常" />
              <el-option label="需维修" value="需维修" />
              <el-option label="已报废" value="已报废" />
            </el-select>
          </el-form-item>
        </template>

        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- ====== 远程开锁确认弹窗 ====== -->
    <el-dialog title="远程开锁" v-model="openDialogVisible" width="400px">
      <div style="text-align:center; padding:20px 0">
        <el-icon :size="48" color="#409EFF"><Lock /></el-icon>
        <p style="margin-top:16px; font-size:16px">确认对 <b>{{ openTarget?.name }}</b> 执行远程开锁？</p>
        <p style="color:#909399; font-size:13px">此操作将记录到操作日志</p>
      </div>
      <template #footer>
        <el-button @click="openDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doRemoteOpen" :loading="opening">确认开锁</el-button>
      </template>
    </el-dialog>

    <!-- ====== 临时密码弹窗 ====== -->
    <el-dialog title="生成临时密码" v-model="pwdDialogVisible" width="480px">
      <el-form :model="pwdForm" label-width="100px">
        <el-form-item label="密码用途">
          <el-select v-model="pwdForm.purpose" style="width:100%">
            <el-option label="入住" value="入住" />
            <el-option label="保洁" value="保洁" />
            <el-option label="维修" value="维修" />
            <el-option label="访客" value="访客" />
            <el-option label="管理员" value="管理员" />
          </el-select>
        </el-form-item>
        <el-form-item label="密码类型">
          <el-select v-model="pwdForm.passwordType" style="width:100%">
            <el-option label="临时（指定有效期）" value="临时" />
            <el-option label="一次性" value="一次性" />
            <el-option label="周期（每天有效）" value="周期" />
          </el-select>
        </el-form-item>
        <el-form-item label="有效期至" v-if="pwdForm.passwordType === '临时'">
          <el-date-picker v-model="pwdForm.endTime" type="datetime" placeholder="选择有效期" style="width:100%" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="密码值">
          <el-input v-model="pwdForm.password" :placeholder="'默认随机生成6位数字'">
            <template #append><el-button @click="generatePwd">随机生成</el-button></template>
          </el-input>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="pwdForm.notes" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doCreatePassword" :loading="pwdSubmitting">生成密码</el-button>
      </template>
    </el-dialog>

    <!-- ====== 钥匙借出弹窗 ====== -->
    <el-dialog title="钥匙借出" v-model="keyLendDialogVisible" width="480px">
      <el-form :model="keyLendForm" label-width="110px">
        <el-form-item label="门锁">{{ keyLendTarget?.name }}</el-form-item>
        <el-form-item label="选择钥匙" prop="keyId">
          <el-select v-model="keyLendForm.keyId" style="width:100%" placeholder="选择要借出的钥匙">
            <el-option v-for="k in availableKeys" :key="k.id" :label="k.keyCode" :value="k.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="借用人类型">
          <el-select v-model="keyLendForm.holderType" style="width:100%">
            <el-option label="租客" value="租客" />
            <el-option label="保洁" value="保洁" />
            <el-option label="维修" value="维修" />
            <el-option label="中介" value="中介" />
            <el-option label="管理员" value="管理员" />
          </el-select>
        </el-form-item>
        <el-form-item label="借用人姓名"><el-input v-model="keyLendForm.holderName" /></el-form-item>
        <el-form-item label="借用人电话"><el-input v-model="keyLendForm.holderPhone" /></el-form-item>
        <el-form-item label="预计归还">
          <el-date-picker v-model="keyLendForm.expectedReturnTime" type="datetime" placeholder="选择预计归还时间" style="width:100%" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="借用原因"><el-input v-model="keyLendForm.lendReason" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="keyLendDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doKeyLend" :loading="keyLendSubmitting">确认借出</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Lock } from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import request from '@/api/request';

const router = useRouter();

// 品牌和类型选项
const smartLockTypes = ['指纹密码锁', '人脸识别锁', '指静脉锁', '密码锁', '刷卡锁', '蓝牙锁', 'WiFi锁', 'NB-IoT锁', 'Zigbee锁'];
const traditionalLockTypes = ['防盗门锁', '室内门锁', '挂锁', '球形锁', '执手锁', '卷闸门锁', '抽屉锁', '玻璃门锁', '链条锁'];
const smartBrands = ['涂鸦智能', '小米', 'Aqara', '德施曼', '凯迪仕', '鹿客', '三星', '耶鲁', 'VOC', '博世'];
const traditionalBrands = ['玥玛', '金点原子', '梅花', '固力', '三环', '王力', '顶固', '汇泰龙', '摩力', '雅洁'];

// 列表状态
const loading = ref(false);
const tableData = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const searchKeyword = ref('');
const filterCategory = ref('');
const filterPropertyId = ref<number | ''>('');
const filterStatus = ref('');
const propertyList = ref<any[]>([]);

const stats = reactive({ total: 0, smartCount: 0, traditionalCount: 0, alertCount: 0 });

function statusTagType(row: any) {
  if (row.category === '智能门锁') {
    const map: Record<string, string> = { '在线': 'success', '离线': 'info', '故障': 'danger', '未激活': 'warning' };
    return map[row.status] || 'info';
  }
  const map: Record<string, string> = { '正常': 'success', '需维修': 'warning', '已报废': 'info' };
  return map[row.status] || 'info';
}

async function fetchStats() {
  try {
    const res = await request.get('/door-locks', { params: { pageSize: 1 } });
    stats.total = res.data.total || 0;
  } catch { /* ignore */ }
  try {
    const r1 = await request.get('/door-locks', { params: { category: '智能门锁', pageSize: 1 } });
    stats.smartCount = r1.data.total || 0;
  } catch { /* ignore */ }
  try {
    const r2 = await request.get('/door-locks', { params: { category: '传统门锁', pageSize: 1 } });
    stats.traditionalCount = r2.data.total || 0;
  } catch { /* ignore */ }
  try {
    const r3 = await request.get('/door-locks', { params: { status: '故障', pageSize: 1 } });
    const r4 = await request.get('/door-locks', { params: { status: '离线', pageSize: 1 } });
    stats.alertCount = (r3.data.total || 0) + (r4.data.total || 0);
  } catch { /* ignore */ }
}

async function fetchProperties() {
  try {
    const res = await request.get('/properties', { params: { pageSize: 500 } });
    propertyList.value = res.data.list || [];
  } catch { /* ignore */ }
}

async function fetchData() {
  loading.value = true;
  try {
    const params: any = { page: page.value, pageSize: pageSize.value };
    if (searchKeyword.value) params.keyword = searchKeyword.value;
    if (filterCategory.value) params.category = filterCategory.value;
    if (filterPropertyId.value) params.propertyId = filterPropertyId.value;
    if (filterStatus.value) params.status = filterStatus.value;
    const res = await request.get('/door-locks', { params });
    tableData.value = res.data.list || [];
    total.value = res.data.total || 0;
  } catch { /* ignore */ }
  finally { loading.value = false; }
}

onMounted(() => {
  fetchStats();
  fetchProperties();
  fetchData();
});

// ====== 创建/编辑弹窗 ======
const dialogVisible = ref(false);
const isEdit = ref(false);
const editId = ref<number | null>(null);
const formRef = ref<FormInstance>();
const submitting = ref(false);

const defaultForm = () => ({
  name: '', category: '智能门锁' as string, propertyId: null as number | null,
  lockType: '', manufacturer: '', model: '', sn: '',
  installDate: null as string | null, status: '在线',
  deviceId: '', lockCylinder: '', material: '', keyType: '',
  notes: '',
});

const form = reactive(defaultForm());

const rules: FormRules = {
  name: [{ required: true, message: '请输入门锁名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择门锁品类', trigger: 'change' }],
  propertyId: [{ required: true, message: '请选择房源', trigger: 'change' }],
};

function showCreateDialog() {
  isEdit.value = false;
  editId.value = null;
  Object.assign(form, defaultForm());
  form.status = filterCategory.value === '传统门锁' ? '正常' : '在线';
  if (filterCategory.value) form.category = filterCategory.value;
  dialogVisible.value = true;
}

function onCategoryChange() {
  form.status = form.category === '智能门锁' ? '在线' : '正常';
  form.lockType = '';
  form.manufacturer = '';
  form.deviceId = '';
  form.lockCylinder = '';
  form.material = '';
  form.keyType = '';
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    const payload: any = { ...form };
    if (payload.category === '智能门锁') {
      delete payload.lockCylinder; delete payload.material; delete payload.keyType;
    } else {
      delete payload.deviceId; delete payload.battery; delete payload.firmwareVersion;
    }
    if (isEdit.value && editId.value) {
      await request.put(`/door-locks/${editId.value}`, payload);
      ElMessage.success('门锁更新成功');
    } else {
      await request.post('/door-locks', payload);
      ElMessage.success('门锁注册成功');
    }
    dialogVisible.value = false;
    fetchData();
    fetchStats();
  } catch { /* ignore */ }
  finally { submitting.value = false; }
}

function resetForm() { /* noop */ }

// ====== 远程开锁 ======
const openDialogVisible = ref(false);
const openTarget = ref<any>(null);
const opening = ref(false);

function remoteOpen(row: any) {
  openTarget.value = row;
  openDialogVisible.value = true;
}

async function doRemoteOpen() {
  if (!openTarget.value) return;
  opening.value = true;
  try {
    await request.post(`/door-locks/${openTarget.value.id}/remote-open`);
    ElMessage.success('远程开锁成功');
    openDialogVisible.value = false;
    fetchData();
    fetchStats();
  } catch { /* ignore */ }
  finally { opening.value = false; }
}

// ====== 临时密码 ======
const pwdDialogVisible = ref(false);
const pwdTarget = ref<any>(null);
const pwdSubmitting = ref(false);
const pwdForm = reactive({ purpose: '入住', passwordType: '临时', endTime: null as string | null, password: '', notes: '' });

function generatePwd() {
  pwdForm.password = String(Math.floor(100000 + Math.random() * 900000));
}

function showPwdDialog(row: any) {
  pwdTarget.value = row;
  pwdForm.purpose = '入住';
  pwdForm.passwordType = '临时';
  pwdForm.endTime = null;
  pwdForm.notes = '';
  generatePwd();
  pwdDialogVisible.value = true;
}

async function doCreatePassword() {
  if (!pwdTarget.value) return;
  pwdSubmitting.value = true;
  try {
    await request.post(`/door-locks/${pwdTarget.value.id}/passwords`, { ...pwdForm });
    ElMessage.success('密码生成成功');
    pwdDialogVisible.value = false;
  } catch { /* ignore */ }
  finally { pwdSubmitting.value = false; }
}

// ====== 钥匙借出 ======
const keyLendDialogVisible = ref(false);
const keyLendTarget = ref<any>(null);
const keyLendSubmitting = ref(false);
const availableKeys = ref<any[]>([]);
const keyLendForm = reactive({ keyId: null as number | null, holderType: '租客', holderName: '', holderPhone: '', expectedReturnTime: null as string | null, lendReason: '' });

async function showKeyLendDialog(row: any) {
  keyLendTarget.value = row;
  keyLendForm.keyId = null;
  keyLendForm.holderType = '租客';
  keyLendForm.holderName = '';
  keyLendForm.holderPhone = '';
  keyLendForm.expectedReturnTime = null;
  keyLendForm.lendReason = '';
  try {
    const res = await request.get(`/door-locks/${row.id}/keys`, { params: { status: '在库' } });
    availableKeys.value = res.data || [];
  } catch { availableKeys.value = []; }
  keyLendDialogVisible.value = true;
}

async function doKeyLend() {
  if (!keyLendTarget.value || !keyLendForm.keyId) {
    ElMessage.warning('请选择要借出的钥匙');
    return;
  }
  keyLendSubmitting.value = true;
  try {
    await request.post(`/door-locks/${keyLendTarget.value.id}/keys/${keyLendForm.keyId}/lend`, {
      holderType: keyLendForm.holderType,
      holderName: keyLendForm.holderName,
      holderPhone: keyLendForm.holderPhone,
      expectedReturnTime: keyLendForm.expectedReturnTime,
      lendReason: keyLendForm.lendReason,
    });
    ElMessage.success('钥匙借出成功');
    keyLendDialogVisible.value = false;
    fetchData();
  } catch { /* ignore */ }
  finally { keyLendSubmitting.value = false; }
}

function goDetail(id: number) {
  router.push(`/rent/locks/${id}`);
}
</script>

<style lang="scss" scoped>
.doorlock-list {
  .stats-row {
    display: flex; gap: 16px; margin-bottom: 16px;
    .stat-card {
      flex: 1; background: #fff; border-radius: 8px; padding: 16px 20px;
      text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      .stat-value { font-size: 28px; font-weight: 700; color: #303133; }
      .stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
      &.smart { border-left: 4px solid #409EFF; }
      &.traditional { border-left: 4px solid #909399; }
      &.warning { border-left: 4px solid #E6A23C; .stat-value { color: #E6A23C; } }
    }
  }
  .toolbar {
    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap:10px;
    .search-group { display: flex; gap:10px; align-items: center; flex-wrap: wrap; }
  }
}
</style>
