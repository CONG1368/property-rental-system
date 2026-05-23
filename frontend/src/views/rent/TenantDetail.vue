<template>
  <div class="tenant-detail">
    <el-page-header @back="$router.back()" :title="tenant?.name || '租客详情'">
      <template #content>
        <el-dropdown @command="handlePrint" v-if="tenant" style="margin-left:16px">
          <el-button type="primary" plain size="small">
            <el-icon><Printer /></el-icon> 打印 <el-icon><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="native"><el-icon><Printer /></el-icon> 直接打印</el-dropdown-item>
              <el-dropdown-item command="pdf"><el-icon><Download /></el-icon> 导出PDF</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
    </el-page-header>
    <el-card class="info-card" style="margin-top:16px">
      <template #header>
        <span>基本信息</span>
        <el-tag :type="tenant?.creditGrade === 'A' ? 'success' : tenant?.creditGrade === 'B' ? '' : tenant?.creditGrade === 'C' ? 'warning' : 'danger'" style="margin-left:12px">{{ tenant?.creditGrade }}级</el-tag>
        <el-tag :type="tenant?.status === '在租中' ? 'success' : tenant?.status === '待入住' ? 'warning' : 'info'" style="margin-left:8px">{{ tenant?.status }}</el-tag>
      </template>
      <el-descriptions :column="3" v-if="tenant">
        <el-descriptions-item label="姓名">{{ tenant.name }}</el-descriptions-item>
        <el-descriptions-item label="证件类型">{{ tenant.idType }}</el-descriptions-item>
        <el-descriptions-item label="证件号码">{{ tenant.idNumber }}</el-descriptions-item>
        <el-descriptions-item label="电话">{{ tenant.phone }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ tenant.email }}</el-descriptions-item>
        <el-descriptions-item label="微信">{{ tenant.wechat }}</el-descriptions-item>
        <el-descriptions-item label="信用评分">{{ tenant.creditScore }}分 ({{ tenant.creditGrade }}级)</el-descriptions-item>
        <el-descriptions-item label="联系人">{{ tenant.contactPerson }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ tenant.notes }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card style="margin-top:16px" v-if="tenant?.contracts">
      <template #header>关联合同</template>
      <el-table :data="tenant.contracts" stripe>
        <el-table-column prop="contractNo" label="合同编号" width="150" />
        <el-table-column prop="rentAmount" label="月租金" width="120" />
        <el-table-column prop="startDate" label="开始日期" width="120" />
        <el-table-column prop="endDate" label="结束日期" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }"><el-tag size="small">{{ row.status }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button size="small" @click="$router.push('/contract/detail/' + row.id)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!tenant.contracts?.length" description="暂无合同" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Printer, ArrowDown, Download } from '@element-plus/icons-vue';
import { getTenant } from '@/api/tenants';
import request from '@/api/request';
import { printDocument, formatDate } from '@/utils/print-service';
import { buildTenantInfoHTML } from '@/components/print/TenantInfoPrint';

const route = useRoute();
const tenant = ref<any>(null);

onMounted(async () => {
  try {
    const res = await getTenant(Number(route.params.id));
    tenant.value = res.data;
  } catch {}
});

async function handlePrint(mode: string) {
  if (!tenant.value) return;
  let companyName = '物业租赁管理公司'; let companyLogo = '';
  try {
    const res = await request.get('/system-configs/keys', { params: { keys: 'company_name_for_print,company_logo' } });
    const map: Record<string, string> = {};
    (res.data || []).forEach((c: any) => { map[c.configKey] = c.configValue; });
    if (map['company_name_for_print']) companyName = map['company_name_for_print'];
    if (map['company_logo']) companyLogo = map['company_logo'];
  } catch { /* use defaults */ }
  const html = buildTenantInfoHTML({
    name: tenant.value.name, idType: tenant.value.idType, idNumber: tenant.value.idNumber,
    phone: tenant.value.phone, email: tenant.value.email || '', wechat: tenant.value.wechat || '',
    contactPerson: tenant.value.contactPerson || '',
    creditScore: tenant.value.creditScore, creditGrade: tenant.value.creditGrade || '',
    status: tenant.value.status || '', notes: tenant.value.notes || '',
    contracts: (tenant.value.contracts || []).map((c: any) => ({
      contractNo: c.contractNo, rentAmount: Number(c.rentAmount || 0),
      startDate: c.startDate, endDate: c.endDate, status: c.status,
    })),
    companyName, companyLogo,
  });
  try {
    await printDocument({ title: `租客信息_${tenant.value.name}`, paperSize: 'A4', htmlContent: html, mode: mode as any });
    ElMessage.success(mode === 'native' ? '已发送到打印机' : 'PDF导出成功');
  } catch (e: any) { ElMessage.error(e.message || '打印失败'); }
}
</script>
