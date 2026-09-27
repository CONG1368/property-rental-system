<template>
  <div class="fire-dashboard">
    <h2 class="page-title">消防综合看板</h2>

    <el-row :gutter="16" class="kpi-row">
      <el-col :span="6"><div class="kpi-card" @click="$router.push('/fire/equipment')"><div class="kpi-value">{{ stats.totalEquipment }}</div><div class="kpi-label">器材总数</div></div></el-col>
      <el-col :span="6"><div class="kpi-card warn" @click="$router.push('/fire/equipment')"><div class="kpi-value">{{ stats.expiringEquipment }}</div><div class="kpi-label">即将过期/已过期</div></div></el-col>
      <el-col :span="6"><div class="kpi-card danger" @click="$router.push('/fire/violations')"><div class="kpi-value">{{ stats.pendingViolations }}</div><div class="kpi-label">待整改违规</div></div></el-col>
      <el-col :span="6"><div class="kpi-card"><div class="kpi-value">{{ stats.monthInspections }}</div><div class="kpi-label">本月检查次数</div></div></el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="8">
        <el-card><template #header>器材状态分布</template>
          <div v-if="stats.equipmentByStatus?.length" style="padding:8px">
            <div v-for="s in stats.equipmentByStatus" :key="s.status" style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
              <span>{{ s.status }}</span><span style="font-weight:bold">{{ s.count }}</span>
            </div>
          </div>
          <el-empty v-else description="暂无数据" :image-size="40" />
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card><template #header>检查结果统计</template>
          <div v-if="stats.inspectionByResult?.length" style="padding:8px">
            <div v-for="s in stats.inspectionByResult" :key="s.result" style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
              <span>{{ s.result }}</span><el-tag :type="s.result==='合格'?'success':s.result==='限期整改'?'warning':'danger'" size="small">{{ s.count }}</el-tag>
            </div>
          </div>
          <el-empty v-else description="暂无数据" :image-size="40" />
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card><template #header>违规严重程度</template>
          <div v-if="stats.violationBySeverity?.length" style="padding:8px">
            <div v-for="s in stats.violationBySeverity" :key="s.severity" style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
              <span>{{ s.severity }}</span><el-tag :type="s.severity==='紧急'?'danger':s.severity==='重大隐患'?'warning':'info'" size="small">{{ s.count }}</el-tag>
            </div>
          </div>
          <el-empty v-else description="暂无数据" :image-size="40" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="12">
        <el-card><template #header><span>即将过期器材</span><el-button link size="small" style="float:right" @click="$router.push('/fire/equipment')">查看全部</el-button></template>
          <DataTable :data="stats.expiringList" :columns="COLUMNS" row-key="id" empty-title="暂无数据" empty-description="调整筛选条件或新增记录后，数据会显示在这里">
            <template #c3="{ row }"><el-tag :type="row.status==='已过期'?'danger':'warning'" size="small">{{ row.status }}</el-tag></template>
          </DataTable>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card><template #header><span>待整改违规</span><el-button link size="small" style="float:right" @click="$router.push('/fire/violations')">查看全部</el-button></template>
          <DataTable :data="stats.pendingList" :columns="COLUMNS_2" row-key="id">
            <template #c3="{ row }"><el-tag :type="row.severity==='紧急'?'danger':'warning'" size="small">{{ row.severity }}</el-tag></template>
          </DataTable>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="12" style="margin-top:16px">
      <el-col :span="6" v-for="link in quickLinks" :key="link.path">
        <div class="quick-btn" @click="$router.push(link.path)">
          <el-icon :size="20" style="margin-right:6px;vertical-align:-4px"><component :is="link.icon" /></el-icon><span>{{ link.label }}</span>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import DataTable from '@/components/base/DataTable.vue';
import type { TableColumn } from '@/components/base/types';

const COLUMNS_2: TableColumn[] = [
  { prop: 'description', label: '描述', minWidth: 160, tooltip: true },
  { prop: 'propertyName', label: '房源', width: 120 },
  { prop: 'severity', label: '严重程度', width: 90, slot: 'c3' },
  { prop: 'deadline', label: '期限', width: 110 },
];

const COLUMNS: TableColumn[] = [
  { prop: 'name', label: '器材', minWidth: 140 },
  { prop: 'propertyName', label: '房源', width: 120 },
  { prop: 'status', label: '状态', width: 90, slot: 'c3' },
  { prop: 'nextCheckDate', label: '下次检查', width: 110 },
];

import { ref, onMounted } from 'vue'
import { Search, Box, Warning, Bell } from '@element-plus/icons-vue'
import request from '@/api/request'

const stats = ref<any>({})
const quickLinks = [
  { path: '/fire/inspections', label: '新增检查', icon: Search },
  { path: '/fire/equipment', label: '器材管理', icon: Box },
  { path: '/fire/violations', label: '违规记录', icon: Warning },
  { path: '/fire/drills', label: '演练记录', icon: Bell },
]

onMounted(async () => {
  try {
    const res = await request.get('/fire-safety/dashboard')
    stats.value = res.data || {}
  } catch { /* ignore */ }
})
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: $n-900; margin-bottom: 16px; }
.kpi-row { .kpi-card { background: $n-0; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; box-shadow: 0 2px 8px $n-100;
  &.warn { border-left: 3px solid $warn-600; } &.danger { border-left: 3px solid $bad-600; }
  .kpi-value { font-size: 28px; font-weight: 700; color: $n-900; } .kpi-label { font-size: 13px; color: $n-600; margin-top: 4px; }
}}
.quick-btn { background: $n-0; border-radius: 8px; padding: 14px 16px; cursor: pointer; text-align: center; font-size: 14px; box-shadow: 0 2px 6px $n-100; &:hover { background: $brand-100; } }
</style>
