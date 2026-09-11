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

<script setup lang="ts">import { tokens } from '@/styles/tokens';

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
  if (lockStatus.value === 'online') return tokens.ok600;
  if (lockStatus.value === 'offline') return tokens.n600;
  return tokens.warn600;
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
.room-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px $n-100; }
.room-card.is-selected { border-color: $brand-600; box-shadow: 0 0 0 2px $brand-300; }

.status-vacant { background: $ok-100; border-color: $ok-100; }
.status-locked { background: $n-50; border-color: $n-200; }
.status-reserved { background: $warn-100; border-color: $warn-100; }
.status-rented { background: $brand-100; border-color: $brand-100; }
.status-exiting { background: $warn-100; border-color: $warn-100; }
.status-cleaning { background: $info-100; border-color: $info-100; }
.status-inspecting { background: $ok-100; border-color: $ok-100; }
.status-maintenance { background: $bad-100; border-color: $bad-100; }
.status-frozen { background: $n-200; border-color: $n-300; }

.card-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;
}
.room-number { font-size: 16px; font-weight: 700; color: $n-900; }
.lock-icon { cursor: pointer; padding: 2px; border-radius: 4px; }
.lock-icon:hover { background: $n-100; }

.card-status { margin-bottom: 6px; }

.card-body { font-size: 12px; color: $n-700; }
.building { color: $n-600; font-size: 11px; margin-bottom: 2px; }
.area { margin-bottom: 2px; }
.tenant-name { color: $brand-600; font-weight: 500; }
.contract-end { color: $n-600; font-size: 11px; margin-top: 2px; }
</style>
