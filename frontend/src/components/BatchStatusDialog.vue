<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    title="批量更新房态"
    width="450px"
  >
    <div class="batch-content">
      <p class="batch-info">已选择 <strong>{{ ids.length }}</strong> 间房源</p>
      <el-select v-model="newStatus" placeholder="选择目标状态" style="width:100%;margin-bottom:12px">
        <el-option
          v-for="s in statusOptions"
          :key="s"
          :label="s"
          :value="s"
        />
      </el-select>
      <el-input
        v-model="notes"
        placeholder="批量操作备注（可选）"
        type="textarea"
        :rows="3"
      />
    </div>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">确认更新</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { batchUpdateRoomStatus } from '@/api/properties';
import { ElMessage } from 'element-plus';

const props = defineProps<{
  visible: boolean;
  ids: number[];
}>();

const emit = defineEmits<{
  'update:visible': [val: boolean];
  'done': [];
}>();

const newStatus = ref('');
const notes = ref('');
const submitting = ref(false);

const statusOptions = [
  '空置', '已锁定', '已预订', '已出租', '退租中', '待保洁', '待验收', '维修中', '已冻结',
];

async function submit() {
  if (!newStatus.value) { ElMessage.warning('请选择目标状态'); return; }
  submitting.value = true;
  try {
    const res = await batchUpdateRoomStatus({ ids: props.ids, newStatus: newStatus.value, notes: notes.value });
    ElMessage.success((res as any).message || '批量更新完成');
    emit('done');
    emit('update:visible', false);
  } catch (e: any) {
    ElMessage.error(e?.message || '批量更新失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.batch-info { margin-bottom: 16px; font-size: 14px; color: #606266; }
</style>
