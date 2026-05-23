<template>
  <div
    class="room-card"
    :class="[`status-${statusKey}`, { 'is-selected': selected }]"
    @click="$emit('click', room)"
  >
    <div class="card-header">
      <span class="room-number">{{ room.roomNumber || room.name }}</span>
      <span class="lock-icon" v-if="room.doorLocks?.length" @click.stop="$emit('lock-click', room)">
        <el-icon :size="14" :color="lockColor">
          <Lock v-if="lockStatus === 'offline'" />
          <Unlock v-else-if="lockStatus === 'online'" />
          <WarningFilled v-else />
        </el-icon>
      </span>
    </div>
    <div class="card-status">
      <el-tag :type="statusTagType" size="small" effect="dark">{{ room.status }}</el-tag>
    </div>
    <div class="card-body">
      <div class="building" v-if="room.buildingName">{{ room.buildingName }}</div>
      <div class="area">{{ room.area }}㎡</div>
      <div v-if="room.contract" class="tenant-info">
        <div class="tenant-name">{{ room.contract.tenantName }}</div>
        <div class="contract-end" v-if="room.contract.contractEndDate">
          到期 {{ room.contract.contractEndDate }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Lock, Unlock, WarningFilled } from '@element-plus/icons-vue';

const props = defineProps<{
  room: any;
  selected?: boolean;
}>();

defineEmits<{
  click: [room: any];
  'lock-click': [room: any];
}>();

const statusMap: Record<string, string> = {
  '空置': 'vacant', '已锁定': 'locked', '已预订': 'reserved', '已出租': 'rented',
  '退租中': 'exiting', '待保洁': 'cleaning', '待验收': 'inspecting',
  '维修中': 'maintenance', '已冻结': 'frozen',
};

const statusKey = computed(() => statusMap[props.room.status] || 'vacant');

const statusTagMap: Record<string, string> = {
  '空置': 'info', '已锁定': '', '已预订': 'warning', '已出租': 'success',
  '退租中': 'warning', '待保洁': '', '待验收': '', '维修中': 'danger', '已冻结': 'info',
};
const statusTagType = computed(() => statusTagMap[props.room.status] || 'info');

const lockStatus = computed(() => {
  if (!props.room.doorLocks?.length) return '';
  const lock = props.room.doorLocks[0];
  if (lock.status === '离线' || lock.status === 'offline') return 'offline';
  if (lock.status === '在线' || lock.status === 'online') return 'online';
  return 'warning';
});

const lockColor = computed(() => {
  if (lockStatus.value === 'online') return '#67C23A';
  if (lockStatus.value === 'offline') return '#909399';
  return '#E6A23C';
});
</script>

<style scoped>
.room-card {
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
  min-width: 130px;
  position: relative;
}
.room-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.room-card.is-selected { border-color: #409EFF; box-shadow: 0 0 0 2px rgba(64,158,255,0.3); }

.status-vacant { background: #f0f9eb; border-color: #c2e7b0; }
.status-locked { background: #f5f7fa; border-color: #d3d6db; }
.status-reserved { background: #fef3e6; border-color: #f5dab1; }
.status-rented { background: #ecf5ff; border-color: #b3d8ff; }
.status-exiting { background: #fdf6ec; border-color: #fae2b4; }
.status-cleaning { background: #f4f0fe; border-color: #d9cff5; }
.status-inspecting { background: #e8f8f0; border-color: #b7e4d0; }
.status-maintenance { background: #fef0f0; border-color: #fbc4c4; }
.status-frozen { background: #e9e9eb; border-color: #c8c9cc; }

.card-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;
}
.room-number { font-size: 16px; font-weight: 700; color: #303133; }
.lock-icon { cursor: pointer; padding: 2px; border-radius: 4px; }
.lock-icon:hover { background: rgba(0,0,0,0.05); }

.card-status { margin-bottom: 6px; }

.card-body { font-size: 12px; color: #606266; }
.building { color: #909399; font-size: 11px; margin-bottom: 2px; }
.area { margin-bottom: 2px; }
.tenant-name { color: #409EFF; font-weight: 500; }
.contract-end { color: #909399; font-size: 11px; margin-top: 2px; }
</style>
