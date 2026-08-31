<template>
  <div class="contract-approval">
    <h2 class="page-title">合同审批</h2>
    <TableSkeleton v-if="loading && !approvals.length" :rows="8" :columns="7" />
    <el-table v-show="!(loading && !approvals.length)" :data="approvals" stripe v-loading="loading" @expand-change="onExpandChange" row-style="cursor:pointer">
      <el-table-column type="expand">
        <template #default="{ row }">
          <div style="padding:16px 24px" v-if="row._contractData" v-loading="row._loading">
            <el-descriptions title="合同信息" :column="3" border size="small" style="margin-bottom:16px">
              <el-descriptions-item label="合同编号">{{ row._contractData.contractNo }}</el-descriptions-item>
              <el-descriptions-item label="月租金">¥{{ Number(row._contractData.rentAmount || 0).toFixed(2) }}</el-descriptions-item>
              <el-descriptions-item label="押金">¥{{ Number(row._contractData.depositAmount || 0).toFixed(2) }}</el-descriptions-item>
              <el-descriptions-item label="开始日期">{{ row._contractData.startDate }}</el-descriptions-item>
              <el-descriptions-item label="结束日期">{{ row._contractData.endDate }}</el-descriptions-item>
              <el-descriptions-item label="付款周期">{{ formatCycle(row._contractData.paymentCycle) }}</el-descriptions-item>
            </el-descriptions>

            <el-card shadow="never" style="margin-bottom:16px" v-if="getClausesArr(row).length > 0">
              <template #header><span style="font-weight:bold">合同条款 ({{ getClausesArr(row).length }} 条)</span></template>
              <div v-for="(clause, idx) in getClausesArr(row)" :key="idx"
                style="margin-bottom:10px;padding:10px 14px;background:#f5f7fa;border-radius:4px;border-left:3px solid #4f7cf7">
                <h4 style="margin:0 0 4px;color:#1f2430;font-size:13px">{{ clause.title || '(无标题)' }}</h4>
                <p style="margin:0;font-size:12px;color:#606266;white-space:pre-wrap;line-height:1.6">{{ clause.content }}</p>
              </div>
            </el-card>

            <el-empty v-if="getClausesArr(row).length === 0" description="本合同暂无条款" :image-size="40" style="margin-bottom:12px" />

            <el-card shadow="never" v-if="hasFireSafety(row)">
              <template #header><span style="font-weight:bold">消防安全约定</span></template>
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="责任方">{{ getFireSafety(row).responsibilityParty || '--' }}</el-descriptions-item>
                <el-descriptions-item label="检查频率">{{ getFireSafety(row).inspectionFrequency || '--' }}</el-descriptions-item>
                <el-descriptions-item label="违规处罚" :span="2">{{ getFireSafety(row).violationPenalty || '--' }}</el-descriptions-item>
              </el-descriptions>
            </el-card>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="合同编号" width="160">
        <template #default="{ row }">
          <el-link type="primary" @click="$router.push('/contract/detail/' + row.contractId)" v-if="row.contract">{{ row.contract.contractNo }}</el-link>
          <span v-else>合同#{{ row.contractId }}</span>
        </template>
      </el-table-column>
      <el-table-column label="租客" width="120">
        <template #default="{ row }">{{ row.contract?.tenant?.name || '--' }}</template>
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
      <el-table-column prop="opinion" label="审批意见" min-width="140" show-overflow-tooltip />
      <el-table-column prop="approvedAt" label="审批时间" width="160"><template #default="{ row }">{{ row.approvedAt?.slice(0, 16)?.replace('T', ' ') || '-' }}</template></el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="success" @click="handleAction(row, '已通过')" v-if="row.status === '待审批'">通过</el-button>
          <el-button size="small" type="danger" @click="handleAction(row, '已驳回')" v-if="row.status === '待审批'">驳回</el-button>
          <el-button size="small" @click="showComment(row)">批注</el-button>
        </template>
      </el-table-column>
          <template #empty>
        <EmptyState title="暂无数据" description="调整筛选条件或新增记录后，数据会显示在这里" />
      </template>
    </el-table>

    <el-dialog title="审批意见" v-model="commentVisible" width="400px">
      <el-input v-model="commentText" type="textarea" :rows="4" placeholder="请输入审批意见..." />
      <template #footer><el-button @click="commentVisible = false">取消</el-button><el-button type="primary" @click="submitComment">确认</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

const approvals = ref<any[]>([])
const loading = ref(false)
const commentVisible = ref(false)
const commentText = ref('')
const currentRow = ref<any>(null)

function getClausesArr(row: any) {
  const raw = row._contractData?.clauses
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return [] } }
  return []
}

function hasFireSafety(row: any) {
  const fs = getFireSafety(row)
  return !!(fs.clauses?.length || fs.restrictions?.length || fs.equipment?.length)
}

function getFireSafety(row: any) {
  const bc = row._contractData?.billingConfig || {}
  return bc.fireSafety || {}
}

function formatCycle(cycle: string) {
  const map: Record<string, string> = { '月': '月付（每月）', '季': '季付（每季）', '年': '年付（每年）', '半年': '半年付' }
  return map[cycle] || cycle || '--'
}

async function onExpandChange(row: any, expandedRows: any[]) {
  const isExpanded = expandedRows.some((r: any) => r.id === row.id)
  if (!isExpanded || row._contractData) return
  row._loading = true
  try {
    const res = await request.get('/contracts/' + row.contractId)
    row._contractData = res.data
  } catch { /* ignore */ } finally { row._loading = false }
}

async function fetchApprovals() {
  loading.value = true
  try {
    const res = await request.get('/approvals', { params: { status: '待审批', pageSize: 200 } })
    approvals.value = res.data.list
  } catch {} finally { loading.value = false }
}

function showComment(row: any) {
  currentRow.value = row
  commentText.value = row.opinion || ''
  commentVisible.value = true
}

async function submitComment() {
  try {
    await request.post('/approvals/' + currentRow.value.id + '/comment', { opinion: commentText.value })
    ElMessage.success('意见已保存')
    commentVisible.value = false
    fetchApprovals()
  } catch {}
}

async function handleAction(row: any, status: string) {
  try {
    await request.put('/approvals/' + row.id, { status, opinion: row.opinion || '' })
    ElMessage.success(status === '已通过' ? '审批已通过，合同已签订' : '审批已驳回，合同已退回')
    fetchApprovals()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '操作失败')
  }
}

onMounted(() => fetchApprovals())
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #1f2430; margin-bottom: 16px; }
</style>
