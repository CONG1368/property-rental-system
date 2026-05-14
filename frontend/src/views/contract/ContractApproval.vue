<template>
  <div class="contract-approval">
    <h2 class="page-title">合同审批</h2>
    <el-table :data="approvals" stripe v-loading="loading">
      <el-table-column label="合同编号" width="160">
        <template #default="{ row }">
          <el-link type="primary" @click="$router.push('/contract/detail/' + row.contractId)" v-if="row.contract">{{ row.contract.contractNo }}</el-link>
          <span v-else>合同#{{ row.contractId }}</span>
        </template>
      </el-table-column>
      <el-table-column label="合同状态" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.contract" :type="row.contract.status === '执行中' ? 'success' : 'warning'" size="small">{{ row.contract.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="nodeName" label="审批节点" width="100" />
      <el-table-column prop="status" label="审批状态" width="100">
        <template #default="{ row }"><el-tag :type="row.status === '已通过' ? 'success' : row.status === '已驳回' ? 'danger' : 'warning'" size="small">{{ row.status }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="opinion" label="审批意见" min-width="160" show-overflow-tooltip />
      <el-table-column prop="approvedAt" label="审批时间" width="160"><template #default="{ row }">{{ row.approvedAt?.slice(0, 16)?.replace('T', ' ') || '-' }}</template></el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
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
  try {
    const res = await request.get('/approvals', { params: { status: '待审批' } });
    approvals.value = res.data.list;
  } catch {} finally { loading.value = false; }
}

function showComment(row: any) { currentRow.value = row; commentText.value = row.opinion || ''; commentVisible.value = true; }

async function submitComment() {
  try { await request.post('/approvals/' + currentRow.value.id + '/comment', { opinion: commentText.value }); ElMessage.success('意见已保存'); commentVisible.value = false; fetchApprovals(); } catch {}
}

async function handleAction(row: any, status: string) {
  try {
    // 审批路由统一处理审批记录+合同状态，无需额外调合同接口
    await request.put('/approvals/' + row.id, { status, opinion: row.opinion || '' });
    ElMessage.success(status === '已通过' ? '审批已通过，合同已签订' : '审批已驳回，合同已退回');
    fetchApprovals();
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}

onMounted(() => fetchApprovals());
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
</style>
