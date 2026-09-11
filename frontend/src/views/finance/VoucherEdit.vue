<template>
  <div class="voucher-edit">
    <PageHeader :title="isEdit ? '编辑凭证' : '新增凭证'" :breadcrumb="[{ label: '财务' }, { label: '凭证管理', to: '/finance/vouchers' }, { label: isEdit ? '编辑' : '新增' }]" />

    <el-card>
      <el-form :model="form" ref="formRef" label-width="100px" inline>
        <el-form-item label="账套">
          <el-select v-model="form.bookId" style="width:180px"><el-option v-for="b in bookOptions" :key="b.id" :label="b.name" :value="b.id" /></el-select>
        </el-form-item>
        <el-form-item label="凭证号"><el-input v-model="form.voucherNo" style="width:180px" /></el-form-item>
        <el-form-item label="日期"><el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" style="width:180px" /></el-form-item>
        <el-form-item label="期间"><el-input v-model="form.period" style="width:120px" placeholder="YYYY-MM" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type" style="width:120px"><el-option label="收" value="收" /><el-option label="付" value="付" /><el-option label="转" value="转" /></el-select>
        </el-form-item>
        <el-form-item label="摘要"><el-input v-model="form.summary" type="textarea" style="width:400px" /></el-form-item>
      </el-form>
    </el-card>

    <el-card style="margin-top:16px">
      <template #header>分录列表</template>
      <VoucherEntryRows v-model="form.entries" :accounts="accountOptions" remote :loading="accountLoading" :search="searchAccounts" />
    </el-card>

    <el-button type="primary" style="margin-top:16px" @click="handleSubmit">保存凭证</el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import request from '@/api/request';
import PageHeader from '@/components/base/PageHeader.vue';
import VoucherEntryRows from '@/components/modules/finance/VoucherEntryRows.vue';

const route = useRoute(); const router = useRouter();
const isEdit = computed(() => !!route.params.id);

const form = ref<any>({ bookId: null, voucherNo: '', date: new Date().toISOString().split('T')[0], period: '', type: '收', summary: '', entries: [] });
const bookOptions = ref<{ id: number; name: string }[]>([]);
const accountOptions = ref<{ id: number; code: string; name: string }[]>([]);
const accountLoading = ref(false);

let searchTimer: any;
function searchAccounts(query: string) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    accountLoading.value = true;
    try {
      const res = await request.get('/accounts', { params: { keyword: query || undefined, pageSize: 20 } });
      accountOptions.value = res.data?.list || [];
    } catch { /* ignore */ } finally { accountLoading.value = false; }
  }, 300);
}
// 编辑模式：预加载已选科目，避免下拉里显示成空
async function loadAccountByIds(ids: number[]) {
  if (!ids.length) return;
  try {
    const res = await request.get('/accounts', { params: { ids: ids.join(','), pageSize: ids.length } });
    for (const a of (res.data?.list || [])) if (!accountOptions.value.find(o => o.id === a.id)) accountOptions.value.push(a);
  } catch { /* ignore */ }
}
async function handleSubmit() {
  const d = (form.value.entries || []).reduce((s: number, e: any) => s + Number(e.debitAmount || 0), 0);
  const c = (form.value.entries || []).reduce((s: number, e: any) => s + Number(e.creditAmount || 0), 0);
  if (Math.abs(d - c) > 0.01) return ElMessage.error('借方合计必须等于贷方合计');
  try {
    if (isEdit.value) { await request.put('/vouchers/' + route.params.id, form.value); ElMessage.success('更新成功'); }
    else { await request.post('/vouchers', form.value); ElMessage.success('创建成功'); }
    router.push('/finance/vouchers');
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '保存失败'); }
}
onMounted(async () => {
  try {
    const bookRes = await request.get('/account-books');
    bookOptions.value = bookRes.data?.list || [];
    if (bookOptions.value.length && !form.value.bookId) form.value.bookId = bookOptions.value[0].id;
  } catch { /* ignore */ }
  searchAccounts('');
  if (isEdit.value) {
    try {
      const res = await request.get('/vouchers/' + route.params.id);
      form.value = res.data;
      await loadAccountByIds((form.value.entries || []).map((e: any) => Number(e.accountId)).filter((id: number) => !isNaN(id) && id > 0));
    } catch { /* ignore */ }
  }
});
</script>
