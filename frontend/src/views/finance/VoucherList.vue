<template>
  <div class="voucher-list">
    <h2 class="page-title">凭证管理</h2>
    <div class="toolbar">
      <div class="search-group">
        <el-select v-model="filterStatus" placeholder="状态" clearable style="width:120px" @change="fetchData">
          <el-option label="草稿" value="草稿" /><el-option label="待复核" value="待复核" />
          <el-option label="待审核" value="待审核" /><el-option label="已过账" value="已过账" />
        </el-select>
        <el-select v-model="filterType" placeholder="类型" clearable style="width:100px" @change="fetchData">
          <el-option label="收" value="收" /><el-option label="付" value="付" /><el-option label="转" value="转" />
        </el-select>
        <el-input v-model="filterPeriod" placeholder="期间(YYYY-MM)" clearable style="width:150px" @keyup.enter="fetchData" />
        <el-button type="primary" @click="fetchData">查询</el-button>
      </div>
      <el-button type="primary" @click="$router.push('/finance/vouchers/edit')">新增凭证</el-button>
      <el-button type="warning" @click="autoVisible = true">自动生成凭证</el-button>
    </div>

    <TableSkeleton v-if="loading && !tableData.length" :rows="8" :columns="6" />
    <el-table v-show="!(loading && !tableData.length)" :data="tableData" stripe v-loading="loading">
      <el-table-column prop="voucherNo" label="凭证号" width="150" />
      <el-table-column prop="date" label="日期" width="110" />
      <el-table-column prop="period" label="期间" width="90" />
      <el-table-column label="类型" width="60"><template #default="{ row }"><el-tag size="small">{{ row.type }}</el-tag></template></el-table-column>
      <el-table-column prop="summary" label="摘要" min-width="200" show-overflow-tooltip />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === '已过账' ? 'success' : row.status === '已作废' ? 'danger' : 'info'" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button size="small" @click="$router.push('/finance/vouchers/edit/' + row.id)">编辑</el-button>
          <el-button size="small" type="success" @click="changeStatus(row, '已过账')" v-if="row.status === '待审核'">过账</el-button>
        </template>
      </el-table-column>
          <template #empty>
        <EmptyState title="暂无凭证" description="业务单据审核通过后自动生成凭证，也可手工录入" />
      </template>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" @current-change="fetchData" layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end" />

    <el-dialog title="自动生成凭证" v-model="autoVisible" width="500px">
      <el-form label-width="120px">
        <el-form-item label="按账期收租">
          <div class="auto-row">
            <el-input v-model="billPeriod" placeholder="期间(YYYY-MM)" style="width:160px" />
            <el-button type="primary" :loading="genBills" @click="genBillsRun">生成收租凭证</el-button>
          </div>
        </el-form-item>
        <el-form-item label="费用凭证">
          <el-button type="primary" :loading="genExps" @click="genExpsRun">生成已批准费用凭证</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';
import { confirmWithPassword } from '@/utils/confirm-password';

const autoVisible = ref(false); const billPeriod = ref(''); const genBills = ref(false); const genExps = ref(false);
async function genBillsRun() {
  if (!billPeriod.value) return ElMessage.warning('请输入账期');
  genBills.value = true;
  try { const res = await request.post('/vouchers/generate-from-bills', { period: billPeriod.value }); ElMessage.success('生成完成'); fetchData(); }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '生成失败'); } finally { genBills.value = false; }
}
async function genExpsRun() {
  genExps.value = true;
  try { const res = await request.post('/vouchers/generate-from-expenses', {}); ElMessage.success('生成完成'); fetchData(); }
  catch (err: any) { ElMessage.error(err?.response?.data?.message || '生成失败'); } finally { genExps.value = false; }
}

const tableData = ref<any[]>([]); const total = ref(0); const page = ref(1); const pageSize = ref(20);
const loading = ref(false); const filterStatus = ref(''); const filterType = ref(''); const filterPeriod = ref('');

async function fetchData() {
  loading.value = true;
  try {
    const res = await request.get('/vouchers', {
      params: { page: page.value, pageSize: pageSize.value, status: filterStatus.value || undefined, type: filterType.value || undefined, period: filterPeriod.value || undefined },
    });
    tableData.value = res.data.list; total.value = res.data.total;
  } catch {} finally { loading.value = false; }
}

async function changeStatus(row: any, status: string) {
  // 作废等不可逆状态需二次确认密码
  let pwd: string | null = null;
  if (status === '已作废') {
    pwd = await confirmWithPassword('确定将凭证置为「已作废」? 此操作不可恢复，请输入登录密码。', '作废二次确认');
    if (!pwd) return;
  }
  try { await request.put('/vouchers/' + row.id + '/status', { status, ...(pwd ? { confirmPassword: pwd } : {}) }); ElMessage.success('状态已更新'); fetchData(); } catch {}
}

onMounted(() => fetchData());
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #1f2430; margin-bottom: 16px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.search-group { display: flex; gap: 10px; align-items: center; }
</style>
