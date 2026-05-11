<template>
  <div class="voucher-edit">
    <h2 class="page-title">{{ isEdit ? '编辑凭证' : '新增凭证' }}</h2>
    <el-card>
      <el-form :model="form" ref="formRef" label-width="100px" inline>
        <el-form-item label="凭证号"><el-input v-model="form.voucherNo" style="width:180px" /></el-form-item>
        <el-form-item label="日期"><el-date-picker v-model="form.date" type="date" style="width:180px" /></el-form-item>
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
        <el-table-column label="科目" width="200">
          <template #default="{ row }"><el-input v-model="row.accountId" placeholder="科目ID" /></template>
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
      <div style="margin-top:12px; font-size:13px">借方合计: {{ debitTotal }} | 贷方合计: {{ creditTotal }}</div>
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

const form = ref({ voucherNo: '', date: new Date().toISOString().split('T')[0], period: '', type: '收', summary: '', entries: [] as any[] });

const debitTotal = computed(() => form.value.entries.reduce((s: number, e: any) => s + Number(e.debitAmount), 0));
const creditTotal = computed(() => form.value.entries.reduce((s: number, e: any) => s + Number(e.creditAmount), 0));

function addEntry() {
  form.value.entries.push({ accountId: '', summary: '', debitAmount: 0, creditAmount: 0 });
}

async function handleSubmit() {
  try {
    if (isEdit.value) { await request.put('/vouchers/' + route.params.id, form.value); ElMessage.success('更新成功'); }
    else { await request.post('/vouchers', form.value); ElMessage.success('创建成功'); }
    router.push('/finance/vouchers');
  } catch {}
}

onMounted(async () => {
  if (isEdit.value) {
    try { const res = await request.get('/vouchers/' + route.params.id); form.value = res.data; } catch {}
  }
});
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
</style>
