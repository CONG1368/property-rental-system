<template>
  <div class="room-card" :class="{ 'is-selected': selected }" @click="$emit('click', room)">
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
      <span :class="roomStatusClass(room.status)">{{ room.status }}</span>
    </div>
    <div class="card-body">
      <div class="building" v-if="room.buildingName">{{ room.buildingName }}</div>
      <div class="area">{{ room.area }}㎡</div>
      <div v-if="room.contract" class="tenant-info">
        <div class="tenant-name">{{ room.contract.tenantName }}</div>
        <div class="contract-end" v-if="room.contract.contractEndDate">
          到期 <DateText :value="room.contract.contractEndDate" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 房态卡片：净表面（不着色整卡），状态由 .room-chip 令牌色阶承担；
// 状态映射来自 modules/room（业务层），本组件不含颜色字面量。
import { computed } from 'vue';
import { Lock, Unlock, WarningFilled } from '@element-plus/icons-vue';
import { tokens } from '@/styles/tokens';
import DateText from '@/components/base/DateText.vue';
import { roomStatusClass } from '@/components/modules/room/room-status';

const props = defineProps<{
  room: any;
  selected?: boolean;
}>();

defineEmits<{
  click: [room: any];
  'lock-click': [room: any];
}>();

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

<style lang="scss" scoped>
// 净表面：白底 + 1px 细边，无模糊无阴影（硬约束：内容卡片一律净表面）
.room-card {
  background: $n-0;
  border: 1px solid $n-200;
  border-radius: $r-box;
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color .15s, border-color .15s;
  min-width: 130px;
  position: relative;
}
.room-card:hover { background: $n-50; }
.room-card.is-selected { border-color: $brand-600; outline: 2px solid $brand-300; outline-offset: -2px; }

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
