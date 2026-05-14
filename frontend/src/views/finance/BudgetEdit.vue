<template>
  <div class="budget-edit">
    <el-page-header @back="$router.back()" :title="isEdit ? '编辑预算' : '新增预算'" />
    <el-card style="margin-top:16px">
      <el-form :model="form" ref="formRef" :rules="rules" label-width="100px" style="max-width:600px">
        <el-form-item label="所属账套" prop="bookId">
          <el-select v-model="form.bookId" placeholder="选择账套" style="width:100%">
            <el-option v-for="b in books" :key="b.id" :label="b.name" :value="b.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="会计科目" prop="accountId">
          <el-select v-model="form.accountId" placeholder="选择科目" filterable style="width:100%">
            <el-option v-for="a in accounts" :key="a.id" :label="`${a.code} ${a.name}`" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="预算年度" prop="year">
          <el-input-number v-model="form.year" :min="2020" :max="2099" style="width:100%" />
        </el-form-item>
        <el-form-item label="预算月份" prop="month">
          <el-select v-model="form.month" placeholder="选择月份（可空=全年）" clearable style="width:100%">
            <el-option v-for="m in 12" :key="m" :label="m + '月'" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="预算金额" prop="budgetAmount">
          <el-input-number v-model="form.budgetAmount" :min="0" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="备注" prop="notes">
          <el-input v-model="form.notes" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSubmit">保存预算</el-button>
          <el-button @click="$router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const route = useRoute(); const router = useRouter();
const isEdit = computed(() => !!route.params.id);

const books = ref<any[]>([]);
const accounts = ref<any[]>([]);
const formRef = ref();
const form = ref({
  bookId: null as number | null,
  accountId: null as number | null,
  year: new Date().getFullYear(),
  month: null as number | null,
  budgetAmount: 0,
  notes: '',
});

const rules = {
  bookId: [{ required: true, message: '请选择账套', trigger: 'change' }],
  accountId: [{ required: true, message: '请选择科目', trigger: 'change' }],
  year: [{ required: true, message: '请输入年度', trigger: 'blur' }],
  budgetAmount: [{ required: true, message: '请输入预算金额', trigger: 'blur' }],
};

onMounted(async () => {
  try {
    const [bookRes, accRes] = await Promise.all([
      request.get('/account-books'),
      request.get('/accounts'),
    ]);
    books.value = bookRes.data?.list || [];
    accounts.value = accRes.data?.list || [];
  } catch { /* ignore */ }

  if (isEdit.value) {
    try {
      const res = await request.get(`/budgets/${route.params.id}`);
      const d = res.data;
      form.value = { bookId: d.bookId, accountId: d.accountId, year: d.year, month: d.month || null, budgetAmount: d.budgetAmount, notes: d.notes || '' };
    } catch { ElMessage.error('加载预算数据失败'); }
  }
});

async function handleSubmit() {
  await formRef.value?.validate();
  try {
    if (isEdit.value) {
      await request.put(`/budgets/${route.params.id}`, form.value);
      ElMessage.success('更新成功');
    } else {
      await request.post('/budgets', form.value);
      ElMessage.success('创建成功');
    }
    router.back();
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '操作失败');
  }
}
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
</style>
