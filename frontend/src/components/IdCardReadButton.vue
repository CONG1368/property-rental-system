<template>
  <div class="id-card-read-btn">
    <el-button
      :type="buttonType"
      :loading="reader.reading.value"
      :disabled="reader.reading.value"
      @click="handleRead"
    >
      <el-icon><Reading /></el-icon> {{ reader.reading.value ? '读取中...' : '读身份证' }}
    </el-button>
    <el-alert
      v-if="lastWarning"
      :title="lastWarning"
      type="warning"
      show-icon
      :closable="true"
      @close="lastWarning = ''"
      style="margin-top:6px"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Reading } from '@element-plus/icons-vue';
import { useIdCardReader, IdCardData } from '@/composables/useIdCardReader';

const props = withDefaults(defineProps<{
  readerId?: number;
  mode?: 'replace' | 'fill';
  buttonType?: 'primary' | 'default' | 'success';
}>(), {
  mode: 'fill',
  buttonType: 'default',
});

const emit = defineEmits<{
  (e: 'success', data: IdCardData): void;
  (e: 'error', message: string): void;
}>();

const reader = useIdCardReader();
const lastWarning = ref('');

async function handleRead() {
  try {
    let deviceId = props.readerId;
    if (!deviceId) {
      const device = await reader.getFirstOnlineDevice();
      if (!device) {
        ElMessage.warning('未找到可用的读卡器设备，请先在系统设置中配置');
        return;
      }
      deviceId = device.id;
    }
    const result = await reader.readCard(deviceId!);
    if (result.success && result.data) {
      emit('success', result.data);
      if (result.warnings && result.warnings.length > 0) {
        lastWarning.value = result.warnings.join('；');
      } else {
        ElMessage.success('身份证读取成功');
      }
    }
  } catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || '读卡失败';
    emit('error', msg);
    ElMessage.error(msg);
  }
}
</script>

<style scoped>
.id-card-read-btn { display: inline-flex; flex-direction: column; align-items: flex-start; }
</style>
