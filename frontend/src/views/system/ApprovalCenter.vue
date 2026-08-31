<template>
  <div class="approval-page">
    <el-tabs v-model="tab">
      <el-tab-pane label="待我审批" name="pending">
        <el-table :data="pending" stripe v-loading="loading">
          <el-table-column prop="title" label="标题" min-width="160" />
          <el-table-column prop="bizType" label="业务类型" width="100" />
          <el-table-column prop="bizNo" label="业务单号" width="140" />
          <el-table-column prop="amount" label="金额" width="120" align="right"><template #default="{ row }">{{ fmt(row.amount) }}</template></el-table-column>
          <el-table-column prop="applicantName" label="申请人" width="100" />
          <el-table-column prop="currentRole" label="当前节点" width="100" />
          <el-table-column label="操作" width="170" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="success" @click="act(row, 'approve')">通过</el-button>
              <el-button size="small" type="danger" @click="act(row, 'reject')">驳回</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="我发起的" name="my">
        <el-table :data="my" stripe v-loading="loading">
          <el-table-column prop="title" label="标题" min-width="160" />
          <el-table-column prop="bizNo" label="单号" width="140" />
          <el-table-column prop="status" label="状态" width="100"><template #default="{ row }"><el-tag :type="statusTag(row.status)" size="small">{{ row.status }}</el-tag></template></el-table-column>
          <el-table-column prop="currentRole" label="当前节点" width="100" />
          <el-table-column prop="comment" label="审批意见" min-width="160" show-overflow-tooltip />
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-button type="primary" style="margin-bottom:14px" @click="openCreate">发起审批</el-button>

    <el-dialog title="发起审批" v-model="createVisible" width="520px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="业务类型" required><el-select v-model="form.bizType" style="width:100%"><el-option v-for="t in bizTypes" :key="t" :label="t" :value="t" /></el-select></el-form-item>
        <el-form-item label="标题" required><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="业务单号"><el-input v-model="form.bizNo" /></el-form-item>
        <el-form-item label="金额"><el-input-number v-model="form.amount" :min="0" :precision="2" style="width:100%" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="createVisible = false">取消</el-button><el-button type="primary" @click="submitRequest">提交</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/api/request';

const tab = ref('pending'); const loading = ref(false);
const pending = ref<any[]>([]); const my = ref<any[]>([]);
const createVisible = ref(false);
const form = ref({ bizType: '', title: '', bizNo: '', amount: 0 });
const bizTypes = ['合同', '预算', '费用', '退租', '装修', '采购'];
function fmt(v: any): string { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }); }
function statusTag(s: string): string { return ({ '待审批': 'warning', '审批中': 'primary', '已通过': 'success', '已驳回': 'danger' } as Record<string, string>)[s] || 'info'; }

async function load() {
  loading.value = true;
  try {
    const p = await request.get('/approval-requests/pending', { silent: true });
    pending.value = p.data?.list || [];
    const m = await request.get('/approval-requests/my', { silent: true });
    my.value = m.data?.list || [];
  } catch { /* 静默 */ } finally { loading.value = false; }
}
async function act(row: any, mode: 'approve' | 'reject') {
  let comment = '';
  try {
    const r = await ElMessageBox.prompt(mode === 'approve' ? '通过审批' : '驳回审批', '审批意见', { inputPlaceholder: '请输入意见', confirmButtonText: '确定', cancelButtonText: '取消' });
    comment = r.value || '';
  } catch { return; }
  try { await request.post(`/approval-requests/${row.id}/${mode}`, { comment }); ElMessage.success('已处理'); load(); }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}
function openCreate() { form.value = { bizType: '', title: '', bizNo: '', amount: 0 }; createVisible.value = true; }
async function submitRequest() {
  if (!form.value.bizType || !form.value.title) return ElMessage.warning('请填写类型与标题');
  try { await request.post('/approval-requests', form.value); ElMessage.success('已提交'); createVisible.value = false; load(); }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '提交失败'); }
}
onMounted(() => load());
</script>

<style lang="scss" scoped>.approval-page { padding: 0; }</style>