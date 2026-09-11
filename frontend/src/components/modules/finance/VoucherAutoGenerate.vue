<template>
  <el-dialog title="自动生成凭证" :model-value="modelValue" width="500px" @update:model-value="(v: boolean) => emit('update:modelValue', v)">
    <el-form label-width="120px">
      <el-form-item label="按账期收租">
        <div style="display:flex;gap:10px;align-items:center">
          <el-input v-model="billPeriod" placeholder="期间(YYYY-MM)" style="width:160px" />
          <el-button type="primary" :loading="genBills" @click="runBills">生成收租凭证</el-button>
        </div>
      </el-form-item>
      <el-form-item label="费用凭证"><el-button type="primary" :loading="genExps" @click="runExpenses">生成已批准费用凭证</el-button></el-form-item>
    </el-form>
  </el-dialog>
</template>

<script setup lang="ts">
// 凭证自动生成：按账期从账单生成 / 从已批准费用生成。
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'done'): void }>();

const billPeriod = ref(''); const genBills = ref(false); const genExps = ref(false);

async function runBills() {
  if (!billPeriod.value) return ElMessage.warning('请输入账期');
  genBills.value = true;
  try { await request.post('/vouchers/generate-from-bills', { period: billPeriod.value }); ElMessage.success('生成完成'); emit('done'); }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '生成失败'); } finally { genBills.value = false; }
}
async function runExpenses() {
  genExps.value = true;
  try { await request.post('/vouchers/generate-from-expenses', {}); ElMessage.success('生成完成'); emit('done'); }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '生成失败'); } finally { genExps.value = false; }
}
</script>
