<template>
  <div class="property-import">
    <h2 class="page-title">批量导入房源</h2>
    <el-card>
      <el-upload drag :auto-upload="false" :on-change="handleFileChange" :limit="1" accept=".xlsx">
        <el-icon :size="48" color="#2b57c9"><Upload /></el-icon>
        <div class="upload-text">将Excel文件拖到此处，或点击上传</div>
        <template #tip><div class="upload-tip">仅支持 .xlsx 格式，第一行为表头（老版 .xls 请先另存为 .xlsx）</div></template>
      </el-upload>
      <div v-if="previewData.length" style="margin-top:16px">
        <h4>预览数据 ({{ previewData.length }} 条)</h4>
        <el-table :data="previewData.slice(0, 10)" stripe max-height="300">
          <el-table-column prop="name" label="名称" width="120" />
          <el-table-column prop="type" label="类型" width="80" />
          <el-table-column prop="area" label="面积" width="80" />
          <el-table-column prop="address" label="地址" />
        </el-table>
        <el-button type="primary" style="margin-top:16px" @click="handleImport" :loading="importing">确认导入</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Upload } from '@element-plus/icons-vue';
import { readFileAsObjects } from '@/utils/excel';
import { importProperties } from '@/api/properties';

const router = useRouter();
const previewData = ref<any[]>([]);
const file = ref<File | null>(null);
const importing = ref(false);

async function handleFileChange(uploadFile: any) {
  file.value = uploadFile.raw;
  try {
    // exceljs 只支持 .xlsx；老版 .xls 直接给出可操作提示，避免解析抛错后无从下手
    if (!/\.xlsx$/i.test(file.value?.name || '')) {
      previewData.value = [];
      ElMessage.warning('仅支持 .xlsx 格式，老版 .xls 请在 Excel/WPS 中「另存为 .xlsx」后重试');
      return;
    }
    previewData.value = await readFileAsObjects(file.value!);
  } catch (e: any) {
    previewData.value = [];
    ElMessage.error('解析失败：' + (e?.message || '文件格式不正确'));
  }
}

async function handleImport() {
  if (!file.value) return;
  importing.value = true;
  try {
    const res = await importProperties(file.value);
    ElMessage.success((res as any).message || '导入成功');
    router.push('/rent/properties');
  } catch {} finally { importing.value = false; }
}
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #1f2430; margin-bottom: 16px; }
.upload-text { margin-top: 12px; font-size: 14px; color: #34495E; }
.upload-tip { font-size: 11px; color: #7F8C8D; margin-top: 8px; }
</style>
