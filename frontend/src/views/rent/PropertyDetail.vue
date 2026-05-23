<template>
  <div class="property-detail">
    <el-page-header @back="$router.back()" :title="property?.name || '房源详情'" />

    <el-card class="info-card" style="margin-top:16px">
      <template #header>
        <span>基本信息</span>
        <el-tag :type="statusTagType(property?.status)" style="margin-left:12px">{{ property?.status }}</el-tag>
      </template>
      <el-descriptions :column="3" v-if="property">
        <el-descriptions-item label="房源名称">{{ property.name }}</el-descriptions-item>
        <el-descriptions-item label="楼栋">{{ property.buildingName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="房号">{{ property.roomNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="业态类型">{{ property.type }}</el-descriptions-item>
        <el-descriptions-item label="面积">{{ property.area }} ㎡</el-descriptions-item>
        <el-descriptions-item label="地址">{{ property.address }}</el-descriptions-item>
        <el-descriptions-item label="楼层">{{ property.floor }}</el-descriptions-item>
        <el-descriptions-item label="单元">{{ property.unit }}</el-descriptions-item>
        <el-descriptions-item label="业主">{{ property.owner }}</el-descriptions-item>
        <el-descriptions-item label="子类型">{{ property.subType }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ property.notes }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 状态流转快捷操作 -->
    <el-card class="info-card" style="margin-top:16px" v-if="validTransitions.length > 0">
      <template #header><span>状态变更</span></template>
      <div class="transition-buttons">
        <el-button
          v-for="s in validTransitions"
          :key="s"
          :type="transitionBtnType(s)"
          size="small"
          @click="quickChangeStatus(s)"
        >变更为「{{ s }}」</el-button>
      </div>
      <el-input v-if="showStatusNote" v-model="statusNote" placeholder="变更备注（可选）" size="small" style="margin-top:8px;width:300px" />
      <el-button v-if="showStatusNote" type="primary" size="small" :loading="changing" @click="confirmStatusChange" style="margin-top:8px">确认变更</el-button>
    </el-card>

    <!-- 房态变更时间线 -->
    <el-card class="info-card" style="margin-top:16px">
      <template #header><span>房态变更记录</span></template>
      <el-timeline v-if="statusLogs.length > 0">
        <el-timeline-item
          v-for="log in statusLogs"
          :key="log.id"
          :timestamp="formatDate(log.createdAt)"
          placement="top"
          size="small"
        >
          <p style="margin:0">
            <el-tag :type="statusTagType(log.oldStatus)" size="small">{{ log.oldStatus }}</el-tag>
            <span style="margin:0 8px;color:#909399">→</span>
            <el-tag :type="statusTagType(log.newStatus)" size="small">{{ log.newStatus }}</el-tag>
          </p>
          <p v-if="log.notes" style="margin:4px 0 0;font-size:12px;color:#909399">{{ log.notes }}</p>
        </el-timeline-item>
      </el-timeline>
      <span v-else style="color:#c0c4cc;font-size:13px">暂无变更记录</span>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { getProperty, getRoomStatusLogs, updatePropertyStatus } from '@/api/properties';
import { ElMessage } from 'element-plus';

const route = useRoute();
const property = ref<any>(null);
const validTransitions = ref<string[]>([]);
const statusLogs = ref<any[]>([]);
const showStatusNote = ref(false);
const targetStatus = ref('');
const statusNote = ref('');
const changing = ref(false);

function statusTagType(s: string): string {
  const m: Record<string, string> = {
    '空置': 'info', '已锁定': '', '已预订': 'warning', '已出租': 'success',
    '退租中': 'warning', '待保洁': '', '待验收': '', '维修中': 'danger', '已冻结': 'info',
  };
  return m[s] || 'info';
}

function transitionBtnType(s: string): string {
  if (s === '已出租') return 'success';
  if (s === '空置') return 'info';
  if (s === '维修中') return 'danger';
  return 'primary';
}

function formatDate(d: any) {
  if (!d) return '';
  return new Date(d).toLocaleString('zh-CN');
}

function quickChangeStatus(status: string) {
  targetStatus.value = status;
  showStatusNote.value = true;
  statusNote.value = '';
}

async function confirmStatusChange() {
  if (!property.value) return;
  changing.value = true;
  try {
    await updatePropertyStatus(property.value.id, targetStatus.value, statusNote.value);
    ElMessage.success('状态变更成功');
    showStatusNote.value = false;
    fetchData();
  } catch (e: any) {
    ElMessage.error(e?.message || '变更失败');
  } finally {
    changing.value = false;
  }
}

async function fetchData() {
  try {
    const res = await getProperty(Number(route.params.id));
    const data = (res as any).data;
    // data may be { ...propertyFields, validTransitions: [...] } or just the raw property
    if (data && typeof data === 'object') {
      property.value = data;
      validTransitions.value = data.validTransitions || [];
    }
    // 获取状态日志
    const logRes = await getRoomStatusLogs(Number(route.params.id));
    statusLogs.value = (logRes as any).data || [];
  } catch {}
}

onMounted(fetchData);
</script>

<style scoped>
.property-detail { padding: 0; }
.info-card { margin-bottom: 0; }
.transition-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
