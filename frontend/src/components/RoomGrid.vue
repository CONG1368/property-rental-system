<template>
  <div class="room-grid" v-loading="loading">
    <div v-if="rooms.length === 0" class="empty-hint">暂无房间数据</div>
    <RoomCard
      v-for="room in rooms"
      :key="room.id"
      :room="room"
      :selected="selectedIds.includes(room.id)"
      @click="$emit('room-click', room)"
      @lock-click="$emit('lock-click', room)"
    />
  </div>
</template>

<script setup lang="ts">
import RoomCard from './RoomCard.vue';

defineProps<{
  rooms: any[];
  selectedIds: number[];
  loading?: boolean;
}>();

defineEmits<{
  'room-click': [room: any];
  'lock-click': [room: any];
}>();
</script>

<style scoped>
.room-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  padding: 4px;
}
.empty-hint {
  grid-column: 1 / -1;
  text-align: center;
  color: #909399;
  padding: 60px 0;
  font-size: 14px;
}
</style>
