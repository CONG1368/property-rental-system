<template>
  <div class="bill-calendar">
    <h2 class="page-title">收租日历</h2>
    <el-calendar v-model="currentDate">
      <template #date-cell="{ data }">
        <div class="calendar-cell" @click="showDayBills(data.day)">
          <div class="day-text">{{ data.day.split('-').pop() }}</div>
          <div v-if="dayStats[data.day]?.count" class="day-stats">
            <el-tag :type="dayStats[data.day].unpaid > 0 ? 'danger' : 'success'" size="small">
              {{ dayStats[data.day].count }}笔
            </el-tag>
          </div>
        </div>
      </template>
    </el-calendar>

    <el-drawer title="当日账单" v-model="drawerVisible" size="700px">
      <DataTable :data="dayBills" :columns="COLUMNS" row-key="id" empty-title="暂无数据" empty-description="调整筛选条件或新增记录后，数据会显示在这里">
        <template #c1="{ row }"><el-link type="primary" size="small" @click="goTenant(row.tenantId)">{{ row.tenantName }}</el-link></template>
        <template #c2="{ row }">¥{{ (row.rentAmount || 0).toFixed(0) }}</template>
        <template #c3="{ row }">¥{{ (row.propertyFee || 0).toFixed(0) }}</template>
        <template #c4="{ row }">¥{{ (row.waterFee || 0).toFixed(0) }}</template>
        <template #c5="{ row }">¥{{ (row.electricFee || 0).toFixed(0) }}</template>
        <template #c6="{ row }"><b>¥{{ (row.totalAmount || 0).toFixed(2) }}</b></template>
        <template #c7="{ row }"><el-tag :type="row.status === '已缴' ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag></template>
      </DataTable>
      <el-empty v-if="!dayBills.length" description="当日无账单" />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';

const COLUMNS: TableColumn[] = [
  { label: '租户', width: 100, slot: 'c1' },
  { label: '租金', width: 75, align: 'right', slot: 'c2' },
  { label: '物业费', width: 75, align: 'right', slot: 'c3' },
  { label: '水费', width: 65, align: 'right', slot: 'c4' },
  { label: '电费', width: 65, align: 'right', slot: 'c5' },
  { label: '合计', width: 85, align: 'right', slot: 'c6' },
  { label: '状态', width: 70, slot: 'c7' },
];

import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getBillCalendar } from '@/api/bills';

const router = useRouter();
const currentDate = ref(new Date());
const drawerVisible = ref(false);
const dayBills = ref<any[]>([]);
const dayStats = ref<Record<string, { count: number; unpaid: number }>>({});
const allBills = ref<any[]>([]);
let lastLoaded = '';

async function loadCalendar() {
  const y = currentDate.value.getFullYear();
  const m = currentDate.value.getMonth() + 1;
  const key = `${y}-${String(m).padStart(2, '0')}`;
  if (key === lastLoaded) return;
  lastLoaded = key;
  try {
    const res = await getBillCalendar({ year: y, month: m });
    allBills.value = res.data.bills || [];
    const stats: Record<string, any> = {};
    allBills.value.forEach((b: any) => {
      const d = b.dueDate;
      if (!stats[d]) stats[d] = { count: 0, unpaid: 0 };
      stats[d].count++;
      if (b.status !== '已缴') stats[d].unpaid++;
    });
    dayStats.value = stats;
  } catch {}
}

function showDayBills(day: string) {
  dayBills.value = allBills.value.filter((b: any) => b.dueDate === day);
  drawerVisible.value = true;
}

function goTenant(id: number | null) {
  if (id) router.push(`/rent/tenants/${id}`);
}

// 月份切换时重新加载
watch(currentDate, () => loadCalendar());
onMounted(() => loadCalendar());
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: $n-900; margin-bottom: 16px; }
.calendar-cell { cursor: pointer; text-align: center; padding: 4px; }
.day-text { font-size: 14px; }
.day-stats { margin-top: 2px; }
</style>
