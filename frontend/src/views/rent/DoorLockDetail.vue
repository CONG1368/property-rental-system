<template>
  <div class="doorlock-detail" v-loading="loading">
    <!-- 头部信息 -->
    <div class="detail-header">
      <div class="header-left">
        <el-button @click="$router.back()" :icon="'ArrowLeft'" text>返回</el-button>
        <h2>{{ lock?.name }}</h2>
        <el-tag :type="lock?.category === '智能门锁' ? '' : 'info'" size="small" style="margin-left:12px">{{ lock?.category }}</el-tag>
        <el-tag :type="statusTagType(lock)" size="small" style="margin-left:6px">{{ lock?.status }}</el-tag>
      </div>
      <div class="header-right">
        <template v-if="lock?.category === '智能门锁'">
          <el-button type="success" @click="remoteOpen">远程开锁</el-button>
          <el-button type="warning" @click="showPwdDialog">创建密码</el-button>
        </template>
        <template v-else>
          <el-button type="warning" @click="showKeyLendDialog">钥匙借出</el-button>
          <el-button type="primary" @click="showKeyCreateDialog">登记钥匙</el-button>
        </template>
        <el-button @click="showEditDialog">编辑信息</el-button>
      </div>
    </div>

    <!-- 概览卡片 -->
    <div class="info-cards" v-if="lock">
      <div class="info-card">
        <div class="card-label">所属房源</div>
        <div class="card-value">{{ lock.property?.name || '-' }}</div>
      </div>
      <div class="info-card">
        <div class="card-label">门锁类型</div>
        <div class="card-value">{{ lock.lockType || '-' }}</div>
      </div>
      <div class="info-card">
        <div class="card-label">品牌型号</div>
        <div class="card-value">{{ lock.manufacturer }}{{ lock.model ? ' / ' + lock.model : '' }}</div>
      </div>
      <div class="info-card">
        <div class="card-label">序列号</div>
        <div class="card-value">{{ lock.sn || '-' }}</div>
      </div>
      <!-- 智能锁专属 -->
      <template v-if="lock.category === '智能门锁'">
        <div class="info-card">
          <div class="card-label">电量</div>
          <div class="card-value">
            <el-progress :percentage="lock.battery ?? 0" :stroke-width="8" style="width:120px"
              :color="(lock.battery ?? 100) <= 30 ? '#F56C6C' : (lock.battery ?? 100) <= 60 ? '#E6A23C' : '#67C23A'" />
          </div>
        </div>
        <div class="info-card">
          <div class="card-label">固件版本</div>
          <div class="card-value">{{ lock.firmwareVersion || '-' }}</div>
        </div>
        <div class="info-card">
          <div class="card-label">最后在线</div>
          <div class="card-value">{{ lock.lastOnlineAt ? new Date(lock.lastOnlineAt).toLocaleString() : '-' }}</div>
        </div>
      </template>
      <!-- 传统锁专属 -->
      <template v-if="lock.category === '传统门锁'">
        <div class="info-card">
          <div class="card-label">锁芯等级</div>
          <div class="card-value">
            <el-tag size="small" :type="lock.lockCylinder === 'C级' || lock.lockCylinder === '超B级' ? 'success' : 'warning'">{{ lock.lockCylinder || '-' }}</el-tag>
          </div>
        </div>
        <div class="info-card">
          <div class="card-label">材质</div>
          <div class="card-value">{{ lock.material || '-' }}</div>
        </div>
        <div class="info-card">
          <div class="card-label">钥匙类型</div>
          <div class="card-value">{{ lock.keyType || '-' }}</div>
        </div>
      </template>
      <div class="info-card">
        <div class="card-label">安装日期</div>
        <div class="card-value">{{ lock.installDate || '-' }}</div>
      </div>
    </div>

    <!-- 标签页内容 -->
    <el-tabs v-model="activeTab" style="margin-top:20px">
      <!-- 基本信息 -->
      <el-tab-pane label="基本信息" name="info">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="门锁名称">{{ lock?.name }}</el-descriptions-item>
          <el-descriptions-item label="门锁品类">{{ lock?.category }}</el-descriptions-item>
          <el-descriptions-item label="门锁类型">{{ lock?.lockType }}</el-descriptions-item>
          <el-descriptions-item label="品牌">{{ lock?.manufacturer }}</el-descriptions-item>
          <el-descriptions-item label="型号">{{ lock?.model || '-' }}</el-descriptions-item>
          <el-descriptions-item label="序列号">{{ lock?.sn || '-' }}</el-descriptions-item>
          <el-descriptions-item label="所属房源">{{ lock?.property?.name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="房源地址">{{ lock?.property?.address || '-' }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ lock?.status }}</el-descriptions-item>
          <el-descriptions-item label="安装日期">{{ lock?.installDate || '-' }}</el-descriptions-item>
          <template v-if="lock?.category === '智能门锁'">
            <el-descriptions-item label="IoT设备ID">{{ lock?.deviceId || '-' }}</el-descriptions-item>
            <el-descriptions-item label="电量">{{ lock?.battery != null ? lock.battery + '%' : '-' }}</el-descriptions-item>
            <el-descriptions-item label="固件版本">{{ lock?.firmwareVersion || '-' }}</el-descriptions-item>
            <el-descriptions-item label="IP地址">{{ lock?.ipAddress || '-' }}</el-descriptions-item>
          </template>
          <template v-if="lock?.category === '传统门锁'">
            <el-descriptions-item label="锁芯等级">{{ lock?.lockCylinder || '-' }}</el-descriptions-item>
            <el-descriptions-item label="材质">{{ lock?.material || '-' }}</el-descriptions-item>
            <el-descriptions-item label="钥匙类型">{{ lock?.keyType || '-' }}</el-descriptions-item>
            <el-descriptions-item label="钥匙总数">{{ lock?.totalKeyCount || 0 }}</el-descriptions-item>
          </template>
          <el-descriptions-item label="备注" :span="2">{{ lock?.notes || '-' }}</el-descriptions-item>
        </el-descriptions>
      </el-tab-pane>

      <!-- 智能门锁：密码管理 -->
      <el-tab-pane label="密码管理" name="passwords" v-if="lock?.category === '智能门锁'">
        <div style="margin-bottom:12px">
          <el-button type="primary" size="small" @click="showPwdDialog">创建密码</el-button>
        </div>
        <el-table :data="passwords" stripe>
          <el-table-column prop="password" label="密码" width="120" />
          <el-table-column prop="passwordType" label="类型" width="80">
            <template #default="{ row }">
              <el-tag :type="row.passwordType === '永久' ? 'success' : row.passwordType === '临时' ? 'warning' : 'info'" size="small">{{ row.passwordType }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="purpose" label="用途" width="80" />
          <el-table-column label="有效期" width="200">
            <template #default="{ row }">
              <span v-if="row.startTime">{{ new Date(row.startTime).toLocaleDateString() }}</span>
              <span v-else>-</span>
              <span> ~ </span>
              <span v-if="row.endTime">{{ new Date(row.endTime).toLocaleDateString() }}</span>
              <span v-else>永久</span>
            </template>
          </el-table-column>
          <el-table-column prop="isActive" label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.isActive ? 'success' : 'danger'" size="small">{{ row.isActive ? '启用' : '禁用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="usedCount" label="已用次数" width="90" />
          <el-table-column prop="notes" label="备注" min-width="120" show-overflow-tooltip />
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button size="small" v-if="row.isActive" @click="togglePassword(row, false)">禁用</el-button>
              <el-button size="small" v-else @click="togglePassword(row, true)">启用</el-button>
              <el-popconfirm title="确定删除该密码?" @confirm="deletePassword(row.id)">
                <template #reference><el-button size="small" type="danger">删除</el-button></template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 传统门锁：钥匙管理 -->
      <el-tab-pane label="钥匙管理" name="keys" v-if="lock?.category === '传统门锁'">
        <div style="margin-bottom:12px; display:flex; gap:8px">
          <el-button type="primary" size="small" @click="showKeyCreateDialog">登记新钥匙</el-button>
          <el-select v-model="keyFilter" placeholder="钥匙状态" clearable style="width:130px" size="small" @change="fetchKeys">
            <el-option label="在库" value="在库" /><el-option label="借出" value="借出" />
            <el-option label="丢失" value="丢失" /><el-option label="作废" value="作废" />
          </el-select>
        </div>
        <el-table :data="keys" stripe>
          <el-table-column prop="keyCode" label="钥匙编号" width="150" />
          <el-table-column prop="keyStatus" label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.keyStatus === '在库' ? 'success' : row.keyStatus === '借出' ? 'warning' : row.keyStatus === '丢失' ? 'danger' : 'info'" size="small">{{ row.keyStatus }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="holderName" label="持有人" width="100" />
          <el-table-column prop="holderPhone" label="联系电话" width="130" />
          <el-table-column label="借出时间" width="160">
            <template #default="{ row }">{{ row.lendTime ? new Date(row.lendTime).toLocaleString() : '-' }}</template>
          </el-table-column>
          <el-table-column label="预计归还" width="160">
            <template #default="{ row }">
              <span :style="{ color: row.expectedReturnTime && new Date(row.expectedReturnTime) < new Date() && row.keyStatus === '借出' ? '#F56C6C' : '' }">
                {{ row.expectedReturnTime ? new Date(row.expectedReturnTime).toLocaleString() : '-' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="实际归还" width="160">
            <template #default="{ row }">{{ row.returnTime ? new Date(row.returnTime).toLocaleString() : '-' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <template v-if="row.keyStatus === '在库'">
                <el-button size="small" type="warning" @click="showKeyLendSingle(row)">借出</el-button>
              </template>
              <template v-if="row.keyStatus === '借出'">
                <el-button size="small" type="success" @click="doKeyReturn(row.id)">归还</el-button>
              </template>
              <template v-if="row.keyStatus === '在库' || row.keyStatus === '借出'">
                <el-button size="small" type="danger" @click="doKeyLost(row.id)">挂失</el-button>
              </template>
              <template v-if="row.keyStatus === '丢失'">
                <el-button size="small" type="info" @click="doKeyScrap(row.id)">作废</el-button>
              </template>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 操作日志（通用） -->
      <el-tab-pane label="操作日志" name="logs">
        <div style="margin-bottom:12px">
          <el-select v-model="logFilter" placeholder="操作类型" clearable style="width:160px" size="small" @change="fetchLogs">
            <el-option v-if="lock?.category === '智能门锁'" v-for="t in smartLogTypes" :key="t" :label="t" :value="t" />
            <el-option v-if="lock?.category === '传统门锁'" v-for="t in traditionalLogTypes" :key="t" :label="t" :value="t" />
          </el-select>
        </div>
        <el-timeline v-if="logs.length > 0">
          <el-timeline-item
            v-for="log in logs" :key="log.id"
            :timestamp="new Date(log.createdAt).toLocaleString()"
            :color="log.result === '成功' ? '#67C23A' : '#F56C6C'"
          >
            <div class="log-item">
              <el-tag size="small" :type="log.operationType.includes('开锁') ? 'success' : log.operationType.includes('借') ? 'warning' : log.operationType.includes('归') ? '' : 'info'" style="margin-right:8px">{{ log.operationType }}</el-tag>
              <span>{{ log.detail || log.operatorName + ' - ' + log.result }}</span>
            </div>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无操作日志" />
        <el-pagination
          v-if="logTotal > pageSize"
          v-model:current-page="logPage"
          :total="logTotal"
          :page-size="pageSize"
          @current-change="fetchLogs"
          layout="total, prev, pager, next"
          style="margin-top:16px; justify-content:flex-end"
        />
      </el-tab-pane>
    </el-tabs>

    <!-- ====== 编辑弹窗 ====== -->
    <el-dialog title="编辑门锁信息" v-model="editDialogVisible" width="600px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="门锁名称"><el-input v-model="editForm.name" /></el-form-item>
        <el-form-item label="门锁类型">
          <el-select v-model="editForm.lockType" style="width:100%" filterable>
            <el-option v-for="t in (lock?.category === '智能门锁' ? smartLockTypes : traditionalLockTypes)" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="品牌">
          <el-select v-model="editForm.manufacturer" style="width:100%" filterable allow-create>
            <el-option v-for="b in (lock?.category === '智能门锁' ? smartBrands : traditionalBrands)" :key="b" :label="b" :value="b" />
          </el-select>
        </el-form-item>
        <el-form-item label="型号"><el-input v-model="editForm.model" /></el-form-item>
        <el-form-item label="序列号"><el-input v-model="editForm.sn" /></el-form-item>
        <template v-if="lock?.category === '智能门锁'">
          <el-form-item label="状态">
            <el-select v-model="editForm.status" style="width:100%">
              <el-option label="在线" value="在线" /><el-option label="离线" value="离线" />
              <el-option label="故障" value="故障" /><el-option label="未激活" value="未激活" />
            </el-select>
          </el-form-item>
        </template>
        <template v-if="lock?.category === '传统门锁'">
          <el-form-item label="锁芯等级">
            <el-select v-model="editForm.lockCylinder" style="width:100%">
              <el-option label="A级" value="A级" /><el-option label="B级" value="B级" />
              <el-option label="C级" value="C级" /><el-option label="超B级" value="超B级" />
            </el-select>
          </el-form-item>
          <el-form-item label="材质">
            <el-select v-model="editForm.material" style="width:100%">
              <el-option label="不锈钢" value="不锈钢" /><el-option label="铜" value="铜" />
              <el-option label="锌合金" value="锌合金" /><el-option label="铝合金" value="铝合金" /><el-option label="铁" value="铁" />
            </el-select>
          </el-form-item>
          <el-form-item label="钥匙类型">
            <el-select v-model="editForm.keyType" style="width:100%">
              <el-option label="普通钥匙" value="普通钥匙" /><el-option label="异形钥匙" value="异形钥匙" />
              <el-option label="磁性钥匙" value="磁性钥匙" /><el-option label="电子钥匙" value="电子钥匙" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="editForm.status" style="width:100%">
              <el-option label="正常" value="正常" /><el-option label="需维修" value="需维修" /><el-option label="已报废" value="已报废" />
            </el-select>
          </el-form-item>
        </template>
        <el-form-item label="备注"><el-input v-model="editForm.notes" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doEdit" :loading="editSubmitting">保存</el-button>
      </template>
    </el-dialog>

    <!-- ====== 创建密码弹窗 ====== -->
    <el-dialog title="创建密码" v-model="pwdDialogVisible" width="460px">
      <el-form :model="pwdForm" label-width="100px">
        <el-form-item label="密码用途">
          <el-select v-model="pwdForm.purpose" style="width:100%">
            <el-option label="入住" value="入住" /><el-option label="保洁" value="保洁" />
            <el-option label="维修" value="维修" /><el-option label="访客" value="访客" /><el-option label="管理员" value="管理员" />
          </el-select>
        </el-form-item>
        <el-form-item label="密码类型">
          <el-select v-model="pwdForm.passwordType" style="width:100%">
            <el-option label="临时" value="临时" /><el-option label="一次性" value="一次性" /><el-option label="周期" value="周期" />
          </el-select>
        </el-form-item>
        <el-form-item label="有效期至" v-if="pwdForm.passwordType === '临时'">
          <el-date-picker v-model="pwdForm.endTime" type="datetime" placeholder="选择有效期" style="width:100%" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="密码值">
          <el-input v-model="pwdForm.password">
            <template #append><el-button @click="pwdForm.password = String(Math.floor(100000 + Math.random() * 900000))">随机</el-button></template>
          </el-input>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="pwdForm.notes" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doCreatePassword" :loading="pwdSubmitting">生成</el-button>
      </template>
    </el-dialog>

    <!-- ====== 登记钥匙弹窗 ====== -->
    <el-dialog title="登记新钥匙" v-model="keyCreateDialogVisible" width="400px">
      <el-form :model="keyCreateForm" label-width="100px">
        <el-form-item label="钥匙编号"><el-input v-model="keyCreateForm.keyCode" placeholder="如 KEY-301-001" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="keyCreateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doCreateKey" :loading="keyCreateSubmitting">登记</el-button>
      </template>
    </el-dialog>

    <!-- ====== 钥匙借出弹窗 ====== -->
    <el-dialog title="钥匙借出" v-model="keyLendDialogVisible" width="460px">
      <el-form :model="keyLendForm" label-width="100px">
        <el-form-item label="钥匙编号">{{ keyLendTargetKey?.keyCode }}</el-form-item>
        <el-form-item label="借用人类型">
          <el-select v-model="keyLendForm.holderType" style="width:100%">
            <el-option label="租客" value="租客" /><el-option label="保洁" value="保洁" />
            <el-option label="维修" value="维修" /><el-option label="中介" value="中介" /><el-option label="管理员" value="管理员" />
          </el-select>
        </el-form-item>
        <el-form-item label="借用人姓名"><el-input v-model="keyLendForm.holderName" /></el-form-item>
        <el-form-item label="借用人电话"><el-input v-model="keyLendForm.holderPhone" /></el-form-item>
        <el-form-item label="预计归还">
          <el-date-picker v-model="keyLendForm.expectedReturnTime" type="datetime" style="width:100%" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="借用原因"><el-input v-model="keyLendForm.lendReason" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="keyLendDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doKeyLend" :loading="keyLendSubmitting">确认借出</el-button>
      </template>
    </el-dialog>

    <!-- ====== 远程开锁确认 ====== -->
    <el-dialog title="远程开锁" v-model="openDialogVisible" width="400px">
      <div style="text-align:center; padding:20px 0">
        <el-icon :size="48" color="#409EFF"><Lock /></el-icon>
        <p style="margin-top:16px; font-size:16px">确认对 <b>{{ lock?.name }}</b> 执行远程开锁？</p>
      </div>
      <template #footer>
        <el-button @click="openDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="doRemoteOpen" :loading="opening">确认开锁</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Lock } from '@element-plus/icons-vue';
import request from '@/api/request';

const route = useRoute();
const lockId = Number(route.params.id);

const smartLockTypes = ['指纹密码锁', '人脸识别锁', '指静脉锁', '密码锁', '刷卡锁', '蓝牙锁', 'WiFi锁', 'NB-IoT锁', 'Zigbee锁'];
const traditionalLockTypes = ['防盗门锁', '室内门锁', '挂锁', '球形锁', '执手锁', '卷闸门锁', '抽屉锁', '玻璃门锁', '链条锁'];
const smartBrands = ['涂鸦智能', '小米', 'Aqara', '德施曼', '凯迪仕', '鹿客', '三星', '耶鲁', 'VOC', '博世'];
const traditionalBrands = ['玥玛', '金点原子', '梅花', '固力', '三环', '王力', '顶固', '汇泰龙', '摩力', '雅洁'];
const smartLogTypes = ['远程开锁', '密码开锁', '指纹开锁', '人脸开锁', '刷卡开锁', '蓝牙开锁', '告警'];
const traditionalLogTypes = ['钥匙借出', '钥匙归还', '钥匙丢失', '钥匙开锁', '换锁', '维修'];

const loading = ref(false);
const lock = ref<any>(null);
const activeTab = ref('info');

function statusTagType(row: any) {
  if (!row) return 'info';
  if (row.category === '智能门锁') {
    const map: Record<string, string> = { '在线': 'success', '离线': 'info', '故障': 'danger', '未激活': 'warning' };
    return map[row.status] || 'info';
  }
  const map: Record<string, string> = { '正常': 'success', '需维修': 'warning', '已报废': 'info' };
  return map[row.status] || 'info';
}

async function fetchLock() {
  loading.value = true;
  try {
    const res = await request.get(`/door-locks/${lockId}`);
    lock.value = res.data;
  } catch { /* ignore */ }
  finally { loading.value = false; }
}

onMounted(() => {
  fetchLock();
  fetchPasswords();
  fetchKeys();
  fetchLogs();
});

// ====== 编辑弹窗 ======
const editDialogVisible = ref(false);
const editSubmitting = ref(false);
const editForm = reactive<any>({});

function showEditDialog() {
  Object.assign(editForm, {
    name: lock.value?.name,
    lockType: lock.value?.lockType,
    manufacturer: lock.value?.manufacturer,
    model: lock.value?.model,
    sn: lock.value?.sn,
    status: lock.value?.status,
    lockCylinder: lock.value?.lockCylinder,
    material: lock.value?.material,
    keyType: lock.value?.keyType,
    notes: lock.value?.notes,
  });
  editDialogVisible.value = true;
}

async function doEdit() {
  editSubmitting.value = true;
  try {
    await request.put(`/door-locks/${lockId}`, editForm);
    ElMessage.success('门锁信息已更新');
    editDialogVisible.value = false;
    fetchLock();
  } catch { /* ignore */ }
  finally { editSubmitting.value = false; }
}

// ====== 密码管理 ======
const passwords = ref<any[]>([]);
const pwdDialogVisible = ref(false);
const pwdSubmitting = ref(false);
const pwdForm = reactive({ purpose: '入住', passwordType: '临时', endTime: null as string | null, password: '', notes: '' });

async function fetchPasswords() {
  try {
    const res = await request.get(`/door-locks/${lockId}/passwords`);
    passwords.value = res.data || [];
  } catch { passwords.value = []; }
}

function showPwdDialog() {
  pwdForm.purpose = '入住';
  pwdForm.passwordType = '临时';
  pwdForm.endTime = null;
  pwdForm.password = String(Math.floor(100000 + Math.random() * 900000));
  pwdForm.notes = '';
  pwdDialogVisible.value = true;
}

async function doCreatePassword() {
  pwdSubmitting.value = true;
  try {
    await request.post(`/door-locks/${lockId}/passwords`, { ...pwdForm });
    ElMessage.success('密码创建成功');
    pwdDialogVisible.value = false;
    fetchPasswords();
  } catch { /* ignore */ }
  finally { pwdSubmitting.value = false; }
}

async function togglePassword(row: any, active: boolean) {
  try {
    await request.put(`/door-locks/${lockId}/passwords/${row.id}`, { isActive: active });
    ElMessage.success(active ? '密码已启用' : '密码已禁用');
    fetchPasswords();
  } catch { /* ignore */ }
}

async function deletePassword(id: number) {
  try {
    await request.delete(`/door-locks/${lockId}/passwords/${id}`);
    ElMessage.success('密码已删除');
    fetchPasswords();
  } catch { /* ignore */ }
}

// ====== 钥匙管理 ======
const keys = ref<any[]>([]);
const keyFilter = ref('');
const keyCreateDialogVisible = ref(false);
const keyCreateSubmitting = ref(false);
const keyCreateForm = reactive({ keyCode: '' });
const keyLendDialogVisible = ref(false);
const keyLendSubmitting = ref(false);
const keyLendTargetKey = ref<any>(null);
const keyLendForm = reactive({ holderType: '租客', holderName: '', holderPhone: '', expectedReturnTime: null as string | null, lendReason: '' });

async function fetchKeys() {
  try {
    const params: any = {};
    if (keyFilter.value) params.status = keyFilter.value;
    const res = await request.get(`/door-locks/${lockId}/keys`, { params });
    keys.value = res.data || [];
  } catch { keys.value = []; }
}

function showKeyCreateDialog() {
  keyCreateForm.keyCode = '';
  keyCreateDialogVisible.value = true;
}

async function doCreateKey() {
  if (!keyCreateForm.keyCode) { ElMessage.warning('请输入钥匙编号'); return; }
  keyCreateSubmitting.value = true;
  try {
    await request.post(`/door-locks/${lockId}/keys`, { keyCode: keyCreateForm.keyCode });
    ElMessage.success('钥匙登记成功');
    keyCreateDialogVisible.value = false;
    fetchKeys();
    fetchLock();
  } catch { /* ignore */ }
  finally { keyCreateSubmitting.value = false; }
}

function showKeyLendSingle(keyRow: any) {
  keyLendTargetKey.value = keyRow;
  keyLendForm.holderType = '租客';
  keyLendForm.holderName = '';
  keyLendForm.holderPhone = '';
  keyLendForm.expectedReturnTime = null;
  keyLendForm.lendReason = '';
  keyLendDialogVisible.value = true;
}

function showKeyLendDialog() {
  // 从在库钥匙中选择第一个
  const available = keys.value.filter((k: any) => k.keyStatus === '在库');
  if (available.length === 0) { ElMessage.warning('没有在库的钥匙可借出'); return; }
  showKeyLendSingle(available[0]);
}

async function doKeyLend() {
  if (!keyLendTargetKey.value) return;
  keyLendSubmitting.value = true;
  try {
    await request.post(`/door-locks/${lockId}/keys/${keyLendTargetKey.value.id}/lend`, {
      holderType: keyLendForm.holderType,
      holderName: keyLendForm.holderName,
      holderPhone: keyLendForm.holderPhone,
      expectedReturnTime: keyLendForm.expectedReturnTime,
      lendReason: keyLendForm.lendReason,
    });
    ElMessage.success('钥匙借出成功');
    keyLendDialogVisible.value = false;
    fetchKeys();
    fetchLock();
    fetchLogs();
  } catch { /* ignore */ }
  finally { keyLendSubmitting.value = false; }
}

async function doKeyReturn(keyId: number) {
  try {
    await request.post(`/door-locks/${lockId}/keys/${keyId}/return`);
    ElMessage.success('钥匙已归还');
    fetchKeys();
    fetchLogs();
  } catch { /* ignore */ }
}

async function doKeyLost(keyId: number) {
  try {
    await request.put(`/door-locks/${lockId}/keys/${keyId}`, { keyStatus: '丢失' });
    ElMessage.success('钥匙已挂失');
    fetchKeys();
    fetchLogs();
  } catch { /* ignore */ }
}

async function doKeyScrap(keyId: number) {
  try {
    await request.put(`/door-locks/${lockId}/keys/${keyId}`, { keyStatus: '作废' });
    ElMessage.success('钥匙已作废');
    fetchKeys();
    fetchLogs();
  } catch { /* ignore */ }
}

// ====== 远程开锁 ======
const openDialogVisible = ref(false);
const opening = ref(false);

function remoteOpen() { openDialogVisible.value = true; }

async function doRemoteOpen() {
  opening.value = true;
  try {
    await request.post(`/door-locks/${lockId}/remote-open`);
    ElMessage.success('远程开锁成功');
    openDialogVisible.value = false;
    fetchLock();
    fetchLogs();
  } catch { /* ignore */ }
  finally { opening.value = false; }
}

// ====== 操作日志 ======
const logs = ref<any[]>([]);
const logTotal = ref(0);
const logPage = ref(1);
const pageSize = ref(20);
const logFilter = ref('');

async function fetchLogs() {
  try {
    const params: any = { page: logPage.value, pageSize: pageSize.value };
    if (logFilter.value) params.operationType = logFilter.value;
    const res = await request.get(`/door-locks/${lockId}/logs`, { params });
    logs.value = res.data.list || [];
    logTotal.value = res.data.total || 0;
  } catch { logs.value = []; }
}
</script>

<style lang="scss" scoped>
.doorlock-detail {
  .detail-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 20px;
    .header-left { display: flex; align-items: center; gap: 8px;
      h2 { margin: 0; font-size: 20px; }
    }
    .header-right { display: flex; gap: 8px; }
  }
  .info-cards {
    display: flex; flex-wrap: wrap; gap: 12px;
    .info-card {
      background: #fff; border-radius: 6px; padding: 12px 18px;
      min-width: 130px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      .card-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
      .card-value { font-size: 15px; color: #303133; font-weight: 500; }
    }
  }
  .log-item { display: flex; align-items: center; }
}
</style>
