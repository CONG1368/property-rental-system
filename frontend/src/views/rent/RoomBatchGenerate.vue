<template>
  <div class="batch-generate">
    <div class="page-header">
      <el-button @click="$router.push('/rent/room-kanban')" :icon="ArrowLeft">返回房态看板</el-button>
      <h3>批量生成房间</h3>
    </div>

    <el-card style="max-width:700px;margin:20px auto">
      <el-form :model="form" label-width="110px">
        <el-form-item label="楼栋名称" required>
          <el-input v-model="form.buildingName" placeholder="如：A栋、1号楼" />
        </el-form-item>
        <el-form-item label="楼栋排序">
          <el-input-number v-model="form.buildingOrder" :min="0" />
        </el-form-item>
        <el-form-item label="起始楼层" required>
          <el-input-number v-model="form.startFloor" :min="1" />
        </el-form-item>
        <el-form-item label="结束楼层" required>
          <el-input-number v-model="form.endFloor" :min="form.startFloor" />
        </el-form-item>
        <el-form-item label="每层房间数" required>
          <el-input-number v-model="form.roomsPerFloor" :min="1" :max="20" />
        </el-form-item>
        <el-form-item label="房号前缀">
          <el-input v-model="form.roomNamePrefix" placeholder="如 A" />
        </el-form-item>
        <el-form-item label="默认面积(㎡)">
          <el-input-number v-model="form.defaultArea" :min="10" :max="500" :precision="1" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="generating" @click="handleGenerate">开始生成</el-button>
          <el-button @click="$router.push('/rent/room-kanban')">取消</el-button>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="result"
        :title="result"
        type="success"
        :closable="false"
        show-icon
        style="margin-top:16px"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { ArrowLeft } from '@element-plus/icons-vue';
import { batchGenerateRooms } from '@/api/properties';
import { ElMessage } from 'element-plus';

const form = reactive({
  buildingName: '',
  buildingOrder: 0,
  startFloor: 1,
  endFloor: 10,
  roomsPerFloor: 2,
  roomNamePrefix: '',
  defaultArea: 35,
});

const generating = ref(false);
const result = ref('');

async function handleGenerate() {
  if (!form.buildingName) { ElMessage.warning('请输入楼栋名称'); return; }
  generating.value = true;
  result.value = '';
  try {
    const res = await batchGenerateRooms({
      buildingName: form.buildingName,
      buildingOrder: form.buildingOrder,
      startFloor: form.startFloor,
      endFloor: form.endFloor,
      roomsPerFloor: Array(form.endFloor - form.startFloor + 1).fill(form.roomsPerFloor),
      roomNamePrefix: form.roomNamePrefix,
      defaultArea: form.defaultArea,
    });
    result.value = (res as any).message || '生成成功';
    ElMessage.success(result.value);
  } catch (e: any) {
    ElMessage.error(e?.message || '生成失败');
  } finally {
    generating.value = false;
  }
}
</script>

<style scoped>
.page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.page-header h3 { margin: 0; }
</style>
