<template>
  <div class="property-import">
    <h2 class="page-title">批量导入房源</h2>
    <el-card>
      <el-upload drag :auto-upload="false" :on-change="handleFileChange" :limit="1" accept=".xlsx,.xls">
        <el-icon :size="48" color="#0A3D62"><Upload /></el-icon>
        <div class="upload-text">将Excel文件拖到此处，或点击上传</div>
        <template #tip><div class="upload-tip">支持 .xlsx / .xls 格式，第一行为表头</div></template>
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
import * as XLSX from 'xlsx';
import { importProperties } from '@/api/properties';

const router = useRouter();
const previewData = ref<any[]>([]);
const file = ref<File | null>(null);
const importing = ref(false);

function handleFileChange(uploadFile: any) {
  file.value = uploadFile.raw;
  const reader = new FileReader();
  reader.onload = (e) => {
    const wb = XLSX.read(e.target?.result, { type: 'binary' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    previewData.value = XLSX.utils.sheet_to_json(ws);
  };
  reader.readAsBinaryString(file.value!);
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
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.upload-text { margin-top: 12px; font-size: 14px; color: #34495E; }
.upload-tip { font-size: 11px; color: #7F8C8D; margin-top: 8px; }
</style>
