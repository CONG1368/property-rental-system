<template>
  <div class="voucher-edit">
    <h2 class="page-title">{{ isEdit ? '编辑凭证' : '新增凭证' }}</h2>
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
      <template #header>分录列表 <el-button type="primary" size="small" style="margin-left:16px" @click="addEntry">添加分录</el-button></template>
      <el-table :data="form.entries" stripe>
        <el-table-column label="科目" width="220">
          <template #default="{ row }">
            <el-select
              v-model="row.accountId"
              filterable
              remote
              reserve-keyword
              placeholder="搜索科目名称/编码"
              :remote-method="(q: string) => searchAccounts(q)"
              :loading="accountLoading"
              clearable
              style="width:100%"
            >
              <el-option
                v-for="a in accountOptions"
                :key="a.id"
                :label="a.code + ' ' + a.name"
                :value="a.id"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="摘要" width="200">
          <template #default="{ row }"><el-input v-model="row.summary" /></template>
        </el-table-column>
        <el-table-column label="借方金额" width="140">
          <template #default="{ row }"><el-input-number v-model="row.debitAmount" :min="0" :precision="2" /></template>
        </el-table-column>
        <el-table-column label="贷方金额" width="140">
          <template #default="{ row }"><el-input-number v-model="row.creditAmount" :min="0" :precision="2" /></template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ $index }"><el-button type="danger" size="small" @click="form.entries.splice($index, 1)">删除</el-button></template>
        </el-table-column>
      </el-table>
      <div style="margin-top:12px; font-size:13px">借方合计: {{ debitTotal.toFixed(2) }} | 贷方合计: {{ creditTotal.toFixed(2) }}</div>
    </el-card>
    <el-button type="primary" style="margin-top:16px" @click="handleSubmit">保存凭证</el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const route = useRoute(); const router = useRouter();
const isEdit = computed(() => !!route.params.id);

const form = ref({ bookId: null as number | null, voucherNo: '', date: new Date().toISOString().split('T')[0], period: '', type: '收', summary: '', entries: [] as any[] });
const bookOptions = ref<{ id: number; name: string }[]>([]);

const accountOptions = ref<{ id: number; code: string; name: string }[]>([]);
const accountLoading = ref(false);

const debitTotal = computed(() => form.value.entries.reduce((s: number, e: any) => s + Number(e.debitAmount), 0));
const creditTotal = computed(() => form.value.entries.reduce((s: number, e: any) => s + Number(e.creditAmount), 0));

let searchTimer: any;
function searchAccounts(query: string) {
  if (!query) return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    accountLoading.value = true;
    try {
      const res = await request.get('/accounts', { params: { keyword: query, pageSize: 20 } });
      accountOptions.value = res.data?.list || [];
    } catch { /* ignore */ } finally { accountLoading.value = false; }
  }, 300);
}

// 按ID加载指定科目（编辑模式下预加载已选科目）
async function loadAccountByIds(ids: number[]) {
  if (ids.length === 0) return;
  try {
    const res = await request.get('/accounts', { params: { ids: ids.join(','), pageSize: ids.length } });
    const loaded = res.data?.list || [];
    // 合并到已有选项中
    for (const a of loaded) {
      if (!accountOptions.value.find(o => o.id === a.id)) {
        accountOptions.value.push(a);
      }
    }
  } catch { /* ignore */ }
}

function addEntry() {
  form.value.entries.push({ accountId: null, summary: '', debitAmount: 0, creditAmount: 0 });
}

async function handleSubmit() {
  if (Math.abs(debitTotal.value - creditTotal.value) > 0.01) {
    ElMessage.error('借方合计必须等于贷方合计');
    return;
  }
  try {
    if (isEdit.value) { await request.put('/vouchers/' + route.params.id, form.value); ElMessage.success('更新成功'); }
    else { await request.post('/vouchers', form.value); ElMessage.success('创建成功'); }
    router.push('/finance/vouchers');
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '保存失败'); }
}

onMounted(async () => {
  // 加载账套列表
  try {
    const bookRes = await request.get('/account-books');
    bookOptions.value = bookRes.data?.list || [];
    if (bookOptions.value.length > 0 && !form.value.bookId) {
      form.value.bookId = bookOptions.value[0].id;
    }
  } catch {}
  // 预加载一批科目供选择
  searchAccounts('');

  if (isEdit.value) {
    try {
      const res = await request.get('/vouchers/' + route.params.id);
      form.value = res.data;
      // 预加载已选科目
      const ids = (form.value.entries || []).map((e: any) => Number(e.accountId)).filter((id: number) => !isNaN(id) && id > 0);
      await loadAccountByIds(ids);
    } catch {}
  }
});
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
</style>
