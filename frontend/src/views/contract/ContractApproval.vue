<template>
  <div class="contract-approval">
    <h2 class="page-title">合同审批</h2>
    <el-table :data="approvals" stripe v-loading="loading">
      <el-table-column prop="nodeName" label="审批节点" width="120" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }"><el-tag :type="row.status === '已通过' ? 'success' : row.status === '已驳回' ? 'danger' : 'warning'" size="small">{{ row.status }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="opinion" label="意见" />
      <el-table-column label="操作" width="240">
        <template #default="{ row }">
          <el-button size="small" type="success" @click="handleAction(row, '已通过')" v-if="row.status === '待审批'">通过</el-button>
          <el-button size="small" type="danger" @click="handleAction(row, '已驳回')" v-if="row.status === '待审批'">驳回</el-button>
          <el-button size="small" @click="showComment(row)">批注</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog title="审批意见" v-model="commentVisible" width="400px">
      <el-input v-model="commentText" type="textarea" :rows="4" placeholder="请输入审批意见..." />
      <template #footer><el-button @click="commentVisible = false">取消</el-button><el-button type="primary" @click="submitComment">确认</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const approvals = ref<any[]>([]); const loading = ref(false);
const commentVisible = ref(false); const commentText = ref(''); const currentRow = ref<any>(null);

async function fetchApprovals() {
  loading.value = true;
  try { const res = await request.get('/approvals', { params: { status: '待审批' } }); approvals.value = res.data.list; } catch {} finally { loading.value = false; }
}

function showComment(row: any) { currentRow.value = row; commentText.value = row.opinion || ''; commentVisible.value = true; }

async function submitComment() {
  try { await request.post('/approvals/' + currentRow.value.id + '/comment', { opinion: commentText.value }); ElMessage.success('意见已保存'); commentVisible.value = false; fetchApprovals(); } catch {}
}

async function handleAction(row: any, status: string) {
  try { await request.put('/approvals/' + row.id, { status, opinion: row.opinion }); ElMessage.success(status === '已通过' ? '已通过' : '已驳回'); fetchApprovals(); } catch {}
}

onMounted(() => fetchApprovals());
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
</style>
