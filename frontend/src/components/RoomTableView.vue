<template>
  <DataTable
    ref="tableRef"
    :data="rooms"
    :loading="loading"
    :columns="COLUMNS"
    row-key="id"
    selectable
    style="cursor: pointer"
    empty-title="暂无房源"
    empty-description="调整筛选条件后重试"
    @selection-change="(rows: any[]) => $emit('selection-change', rows.map((r) => r.id))"
    @row-click="(row: any) => $emit('room-click', row)"
  >
    <template #batch>
      <el-button size="small" type="primary" @click="$emit('batch-status')">批量改状态</el-button>
    </template>
    <template #tenant="{ row }">{{ row.contract?.tenantName || '-' }}</template>
    <template #lock="{ row }">
      <span v-if="row.doorLocks?.length">
        <el-icon :size="16" :color="row.doorLocks[0].status === '在线' ? 'var(--ok-600)' : 'var(--n-600)'">
          <Lock v-if="row.doorLocks[0].status !== '在线'" />
          <Unlock v-else />
        </el-icon>
        {{ row.doorLocks[0].category || '门锁' }}
      </span>
      <span v-else class="text-muted">-</span>
    </template>
    <template #ops="{ row }">
      <el-button size="small" @click.stop="$emit('room-click', row)">详情</el-button>
      <el-button size="small" type="primary" @click.stop="$emit('status-edit', row)">改状态</el-button>
    </template>
  </DataTable>
</template>

<script setup lang="ts">
// 房态看板的表格视图（与 RoomGrid 卡片视图互为切换）。
// 状态着色走房态阶令牌（modules/room/room-status），base/ 不含业务映射。
import { ref } from 'vue';
import { Lock, Unlock } from '@element-plus/icons-vue';
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';
import { ROOM_STATUS_MAP } from '@/components/modules/room/room-status';

defineProps<{ rooms: any[]; loading?: boolean }>();
defineEmits<{
  'room-click': [room: any];
  'status-edit': [room: any];
  'selection-change': [ids: number[]];
  'batch-status': [];
}>();

const tableRef = ref();
// 让页面能在切换视图 / 批量完成后清空表格内部选择
defineExpose({ clearSelection: () => tableRef.value?.clearSelection() });

const COLUMNS: TableColumn[] = [
  { prop: 'roomNumber', label: '房号', width: 110, sortable: true },
  { prop: 'buildingName', label: '楼栋', width: 90 },
  { prop: 'floorOrder', label: '楼层', width: 70, sortable: true },
  { prop: 'type', label: '类型', width: 80 },
  { prop: 'status', label: '状态', width: 100, type: 'status', statusMap: ROOM_STATUS_MAP },
  { label: '租客', minWidth: 100, slot: 'tenant' },
  { prop: 'area', label: '面积(㎡)', width: 90 },
  { label: '门锁', width: 100, slot: 'lock' },
  { prop: 'contract.contractEndDate', label: '合同到期', width: 120, type: 'date' },
  { label: '操作', width: 140, fixed: 'right', slot: 'ops' },
];
</script>

<style lang="scss" scoped>
.text-muted { color: $n-600; }
</style>
