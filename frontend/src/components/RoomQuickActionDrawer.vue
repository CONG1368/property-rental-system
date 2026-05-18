<template>
  <el-drawer
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    title="房间操作"
    size="380px"
  >
    <template v-if="room">
      <el-descriptions :column="1" border size="small" style="margin-bottom:16px">
        <el-descriptions-item label="房号">{{ room.roomNumber || room.name }}</el-descriptions-item>
        <el-descriptions-item label="楼栋">{{ room.buildingName }}</el-descriptions-item>
        <el-descriptions-item label="楼层">{{ room.floor }}楼</el-descriptions-item>
        <el-descriptions-item label="面积">{{ room.area }}㎡</el-descriptions-item>
        <el-descriptions-item label="当前状态">
          <el-tag :type="statusTagType(room.status)" size="small">{{ room.status }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <div class="section" v-if="room.contract">
        <h4>当前租约</h4>
        <p>租客：{{ room.contract.tenantName }}</p>
        <p>合同到期：{{ room.contract.contractEndDate }}</p>
        <p>月租金：¥{{ room.contract.rentAmount }}</p>
      </div>

      <div class="section">
        <h4>状态变更</h4>
        <el-select v-model="targetStatus" placeholder="选择目标状态" style="width:100%;margin-bottom:8px" @change="onStatusChange">
          <el-option
            v-for="s in validTransitions"
            :key="s"
            :label="s"
            :value="s"
          />
        </el-select>
        <el-input
          v-if="targetStatus"
          v-model="statusNotes"
          placeholder="变更备注（可选）"
          type="textarea"
          :rows="2"
          style="margin-bottom:8px"
        />
        <el-button
          v-if="targetStatus"
          type="primary"
          :loading="submitting"
          @click="submitStatus"
          style="width:100%"
        >
          确认变更为「{{ targetStatus }}」
        </el-button>
      </div>

      <div class="section" v-if="doorLock">
        <h4>门锁操作</h4>
        <p>门锁：{{ doorLock.name }} ({{ doorLock.category }})</p>
        <p>状态：<el-tag :type="doorLock.status === '在线' ? 'success' : 'info'" size="small">{{ doorLock.status }}</el-tag></p>
        <el-button size="small" type="primary" style="margin-top:8px" @click="$emit('remote-unlock', room)">远程开锁</el-button>
      </div>

      <div class="section">
        <h4>最近变更记录</h4>
        <el-timeline v-if="logs.length > 0">
          <el-timeline-item
            v-for="log in logs.slice(0, 5)"
            :key="log.id"
            :timestamp="formatDate(log.createdAt)"
            size="small"
          >
            {{ log.oldStatus }} → {{ log.newStatus }}
            <span v-if="log.notes" class="log-note">（{{ log.notes }}）</span>
          </el-timeline-item>
        </el-timeline>
        <span v-else class="text-muted">暂无变更记录</span>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { getRoomStatusLogs, updatePropertyStatus } from '@/api/properties';
import { ElMessage } from 'element-plus';

const props = defineProps<{
  visible: boolean;
  room: any;
  validTransitions: string[];
  doorLock: any;
}>();

const emit = defineEmits<{
  'update:visible': [val: boolean];
  'status-changed': [];
  'remote-unlock': [room: any];
}>();

const targetStatus = ref('');
const statusNotes = ref('');
const submitting = ref(false);
const logs = ref<any[]>([]);

watch(() => props.visible, async (v) => {
  if (v && props.room) {
    targetStatus.value = '';
    statusNotes.value = '';
    try {
      const res = await getRoomStatusLogs(props.room.id);
      logs.value = (res as any).data || [];
    } catch { logs.value = []; }
  }
});

function statusTagType(status: string): string {
  const m: Record<string, string> = { '空置': 'info', '已预订': 'warning', '已出租': 'success', '维修中': 'danger', '退租中': 'warning', '已锁定': '', '已冻结': 'info' };
  return m[status] || 'info';
}

function formatDate(d: any) {
  if (!d) return '';
  return new Date(d).toLocaleString('zh-CN');
}

function onStatusChange() { statusNotes.value = ''; }

async function submitStatus() {
  if (!targetStatus.value) return;
  submitting.value = true;
  try {
    await updatePropertyStatus(props.room.id, targetStatus.value, statusNotes.value);
    ElMessage.success(`状态已变更为「${targetStatus.value}」`);
    emit('status-changed');
    emit('update:visible', false);
  } catch (e: any) {
    ElMessage.error(e?.message || '状态变更失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.section { margin-top: 20px; border-top: 1px solid #ebeef5; padding-top: 12px; }
.section h4 { margin: 0 0 8px 0; font-size: 14px; color: #303133; }
.section p { margin: 4px 0; font-size: 13px; color: #606266; }
.log-note { color: #909399; font-size: 12px; }
.text-muted { color: #c0c4cc; font-size: 13px; }
</style>
