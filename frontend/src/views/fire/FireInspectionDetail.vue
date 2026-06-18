<template>
  <div>
    <el-page-header @back="$router.back()" title="检查记录详情" />
    <el-card style="margin-top:16px" v-if="data">
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="房源">{{ data.property?.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="检查日期">{{ data.inspectionDate }}</el-descriptions-item>
        <el-descriptions-item label="检查类型">{{ data.type }}</el-descriptions-item>
        <el-descriptions-item label="检查结果"><el-tag :type="data.result==='合格'?'success':data.result==='限期整改'?'warning':'danger'">{{ data.result }}</el-tag></el-descriptions-item>
        <el-descriptions-item label="综合评分">{{ data.overallScore }} 分</el-descriptions-item>
        <el-descriptions-item label="下次检查">{{ data.nextInspectionDate || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-divider content-position="left">检查项目</el-divider>
      <el-row :gutter="16">
        <el-col :span="8"><el-tag :type="data.fireExtinguisherOk ? 'success' : 'danger'">{{ data.fireExtinguisherOk ? '√' : '×' }} 灭火器</el-tag></el-col>
        <el-col :span="8"><el-tag :type="data.smokeAlarmOk ? 'success' : 'danger'">{{ data.smokeAlarmOk ? '√' : '×' }} 烟感报警器</el-tag></el-col>
        <el-col :span="8"><el-tag :type="data.emergencyLightOk ? 'success' : 'danger'">{{ data.emergencyLightOk ? '√' : '×' }} 应急照明</el-tag></el-col>
        <el-col :span="8" style="margin-top:8px"><el-tag :type="data.escapeRouteOk ? 'success' : 'danger'">{{ data.escapeRouteOk ? '√' : '×' }} 疏散通道</el-tag></el-col>
        <el-col :span="8" style="margin-top:8px"><el-tag :type="data.electricalOk ? 'success' : 'danger'">{{ data.electricalOk ? '√' : '×' }} 电气线路</el-tag></el-col>
        <el-col :span="8" style="margin-top:8px"><el-tag :type="data.flammableOk ? 'success' : 'danger'">{{ data.flammableOk ? '√' : '×' }} 易燃易爆管理</el-tag></el-col>
      </el-row>

      <div style="margin-top:16px" v-if="data.notes"><p style="font-weight:bold;margin:0 0 4px">备注：</p><p style="margin:0;color:#606266;white-space:pre-wrap">{{ data.notes }}</p></div>

      <el-divider content-position="left" v-if="data.violations?.length">关联违规记录</el-divider>
      <el-table :data="data.violations" size="small" v-if="data.violations?.length">
        <el-table-column prop="category" label="类别" width="100" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="severity" label="严重程度" width="100"><template #default="{row}"><el-tag :type="row.severity==='紧急'?'danger':'warning'" size="small">{{ row.severity }}</el-tag></template></el-table-column>
        <el-table-column prop="status" label="状态" width="100"><template #default="{row}"><el-tag :type="row.status==='已整改'?'success':row.status==='逾期未改'?'danger':'warning'" size="small">{{ row.status }}</el-tag></template></el-table-column>
      </el-table>
    </el-card>
    <el-empty v-if="!data" description="加载中..." />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import request from '@/api/request'

const route = useRoute()
const data = ref<any>(null)

onMounted(async () => {
  try { const res = await request.get('/fire-safety/inspections/' + route.params.id); data.value = res.data } catch {}
})
</script>
