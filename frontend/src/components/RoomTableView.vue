<template>
  <el-table
    :data="rooms"
    stripe
    v-loading="loading"
    @selection-change="(rows: any[]) => $emit('selection-change', rows.map(r => r.id))"
    @row-click="(row: any) => $emit('room-click', row)"
    style="cursor: pointer"
  >
    <el-table-column type="selection" width="45" />
    <el-table-column prop="roomNumber" label="房号" width="110" sortable />
    <el-table-column prop="buildingName" label="楼栋" width="90" />
    <el-table-column prop="floorOrder" label="楼层" width="70" sortable />
    <el-table-column prop="type" label="类型" width="80" />
    <el-table-column prop="status" label="状态" width="100">
      <template #default="{ row }">
        <el-tag :type="statusTagType(row.status)" size="small">{{ row.status }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column label="租客" min-width="100">
      <template #default="{ row }">
        {{ row.contract?.tenantName || '-' }}
      </template>
    </el-table-column>
    <el-table-column prop="area" label="面积(㎡)" width="90" />
    <el-table-column label="门锁" width="100">
      <template #default="{ row }">
        <span v-if="row.doorLocks?.length">
          <el-icon :size="16" :color="row.doorLocks[0].status === '在线' ? '#67C23A' : '#909399'">
            <Lock v-if="row.doorLocks[0].status !== '在线'" />
            <Unlock v-else />
          </el-icon>
          {{ row.doorLocks[0].category || '门锁' }}
        </span>
        <span v-else class="text-muted">-</span>
      </template>
    </el-table-column>
    <el-table-column label="合同到期" width="120">
      <template #default="{ row }">
        {{ row.contract?.contractEndDate || '-' }}
      </template>
    </el-table-column>
    <el-table-column label="操作" width="140" fixed="right">
      <template #default="{ row }">
        <el-button size="small" @click.stop="$emit('room-click', row)">详情</el-button>
        <el-button size="small" type="primary" @click.stop="$emit('status-edit', row)">改状态</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import { Lock, Unlock } from '@element-plus/icons-vue';

defineProps<{ rooms: any[]; loading?: boolean }>();
defineEmits<{ 'room-click': [room: any]; 'status-edit': [room: any]; 'selection-change': [ids: number[]] }>();

function statusTagType(status: string): string {
  const m: Record<string, string> = { '空置': 'info', '已预订': 'warning', '已出租': 'success', '维修中': 'danger', '退租中': 'warning', '已锁定': '', '已冻结': 'info', '待保洁': '', '待验收': '' };
  return m[status] || 'info';
}
</script>

<style scoped>
.text-muted { color: #c0c4cc; }
</style>
