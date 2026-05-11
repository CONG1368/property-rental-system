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

    <el-drawer title="当日账单" v-model="drawerVisible" size="500px">
      <el-table :data="dayBills" stripe>
        <el-table-column prop="billNo" label="账单编号" width="140" />
        <el-table-column prop="totalAmount" label="金额" width="100" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === '已缴' ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!dayBills.length" description="当日无账单" />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getBillCalendar } from '@/api/bills';

const currentDate = ref(new Date());
const drawerVisible = ref(false);
const dayBills = ref<any[]>([]);
const dayStats = ref<Record<string, { count: number; unpaid: number }>>({});

async function loadCalendar() {
  const y = currentDate.value.getFullYear();
  const m = currentDate.value.getMonth() + 1;
  try {
    const res = await getBillCalendar({ year: y, month: m });
    const stats: Record<string, any> = {};
    (res.data.bills || []).forEach((b: any) => {
      const d = b.dueDate;
      if (!stats[d]) stats[d] = { count: 0, unpaid: 0 };
      stats[d].count++;
      if (b.status !== '已缴') stats[d].unpaid++;
    });
    dayStats.value = stats;
  } catch {}
}

function showDayBills(day: string) {
  dayBills.value = [];
  drawerVisible.value = true;
}

onMounted(() => loadCalendar());
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.calendar-cell { cursor: pointer; text-align: center; padding: 4px; }
.day-text { font-size: 14px; }
.day-stats { margin-top: 2px; }
</style>
