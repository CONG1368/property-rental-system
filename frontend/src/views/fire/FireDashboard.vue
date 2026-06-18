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
          <el-table :data="stats.expiringList" size="small" empty-text="暂无即将过期器材" max-height="260">
            <el-table-column prop="name" label="器材" min-width="140" />
            <el-table-column prop="propertyName" label="房源" width="120" />
            <el-table-column prop="status" label="状态" width="90"><template #default="{row}"><el-tag :type="row.status==='已过期'?'danger':'warning'" size="small">{{ row.status }}</el-tag></template></el-table-column>
            <el-table-column prop="nextCheckDate" label="下次检查" width="110" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card><template #header><span>待整改违规</span><el-button link size="small" style="float:right" @click="$router.push('/fire/violations')">查看全部</el-button></template>
          <el-table :data="stats.pendingList" size="small" empty-text="暂无待整改违规" max-height="260">
            <el-table-column prop="description" label="描述" min-width="160" show-overflow-tooltip />
            <el-table-column prop="propertyName" label="房源" width="120" />
            <el-table-column prop="severity" label="严重程度" width="90"><template #default="{row}"><el-tag :type="row.severity==='紧急'?'danger':'warning'" size="small">{{ row.severity }}</el-tag></template></el-table-column>
            <el-table-column prop="deadline" label="期限" width="110" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="12" style="margin-top:16px">
      <el-col :span="6" v-for="link in quickLinks" :key="link.path">
        <div class="quick-btn" @click="$router.push(link.path)">
          <span style="font-size:20px;margin-right:6px">{{ link.icon }}</span><span>{{ link.label }}</span>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import request from '@/api/request'

const stats = ref<any>({})
const quickLinks = [
  { path: '/fire/inspections', label: '新增检查', icon: '🔍' },
  { path: '/fire/equipment', label: '器材管理', icon: '🧯' },
  { path: '/fire/violations', label: '违规记录', icon: '⚠️' },
  { path: '/fire/drills', label: '演练记录', icon: '🔔' },
]

onMounted(async () => {
  try {
    const res = await request.get('/fire-safety/dashboard')
    stats.value = res.data || {}
  } catch { /* ignore */ }
})
</script>

<style lang="scss" scoped>
.page-title { font-size: 18px; font-weight: 700; color: #0A3D62; margin-bottom: 16px; }
.kpi-row { .kpi-card { background: #fff; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  &.warn { border-left: 3px solid #e6a23c; } &.danger { border-left: 3px solid #f56c6c; }
  .kpi-value { font-size: 28px; font-weight: 700; color: #0A3D62; } .kpi-label { font-size: 13px; color: #909399; margin-top: 4px; }
}}
.quick-btn { background: #fff; border-radius: 8px; padding: 14px 16px; cursor: pointer; text-align: center; font-size: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.06); &:hover { background: #f0f5ff; } }
</style>
