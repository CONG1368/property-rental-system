<template>
  <div class="tenant-detail">
    <el-page-header @back="$router.back()" :title="tenant?.name || '租客详情'" />
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
import { getTenant } from '@/api/tenants';

const route = useRoute();
const tenant = ref<any>(null);

onMounted(async () => {
  try {
    const res = await getTenant(Number(route.params.id));
    tenant.value = res.data;
  } catch {}
});
</script>
