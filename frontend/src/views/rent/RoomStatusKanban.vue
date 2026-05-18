<template>
  <div class="room-kanban">
    <!-- 顶部操作栏 -->
    <div class="kanban-toolbar">
      <div class="toolbar-left">
        <el-button @click="$router.push('/rent/properties')" :icon="ArrowLeft">返回房源列表</el-button>
        <el-button type="success" @click="$router.push('/rent/room-kanban/dashboard')" :icon="DataAnalysis">数据大屏</el-button>
        <el-tag v-if="!wsConnected" type="danger" size="small">
          <el-icon style="vertical-align:middle"><WarningFilled /></el-icon> 实时连接已断开
        </el-tag>
        <el-tag v-else type="success" size="small">
          <el-icon style="vertical-align:middle"><CircleCheckFilled /></el-icon> 实时
        </el-tag>
      </div>
      <div class="toolbar-right">
        <el-select v-model="propertyTypeFilter" placeholder="房源类型" style="width:120px" clearable @change="fetchKanbanData">
          <el-option label="公寓" value="公寓" />
          <el-option label="厂房" value="厂房" />
          <el-option label="商铺" value="商铺" />
        </el-select>
        <el-button @click="fetchKanbanData" :icon="Refresh" :loading="loading">刷新</el-button>
        <el-button @click="handleExportPDF" :icon="Printer">PDF</el-button>
        <el-button @click="handleExportExcel" :icon="Download">Excel</el-button>
      </div>
    </div>

    <!-- 统计面板 -->
    <RoomStatsPanel :stats="stats" />

    <!-- 楼栋+楼层选择器 -->
    <BuildingFloorSelector
      :buildings="buildings"
      @change="onFilterChange"
    />

    <!-- 网格视图 -->
    <div v-if="filteredFloors.length === 0" class="empty-hint">暂无房间数据，请先<a @click="$router.push('/rent/room-kanban/batch-gen')" style="color:#409EFF;cursor:pointer">批量生成房间</a></div>
    <div v-for="floor in filteredFloors" :key="`${floor.buildingName || ''}-${floor.floorOrder}`" class="floor-group">
      <div class="floor-header">
        <span class="floor-label">{{ (floor as any).buildingName || '' }} {{ (floor as any).label || (floor as any).floorOrder + 'F' }}</span>
        <span class="floor-count">{{ floor.rooms.length }}间</span>
      </div>
      <RoomGrid
        :rooms="floor.rooms"
        :selected-ids="selectedIds"
        @room-click="onRoomClick"
        @lock-click="onLockClick"
      />
    </div>

    <!-- 批量操作栏 -->
    <div class="batch-bar" v-if="selectedIds.length > 0">
      <span>已选 {{ selectedIds.length }} 间</span>
      <el-button size="small" type="primary" @click="batchDialogVisible = true">批量改状态</el-button>
      <el-button size="small" @click="clearSelection">取消选择</el-button>
    </div>

    <!-- 快捷操作抽屉 -->
    <RoomQuickActionDrawer
      v-model:visible="drawerVisible"
      :room="selectedRoom"
      :valid-transitions="validTransitions"
      :door-lock="selectedDoorLock"
      @status-changed="fetchKanbanData"
    />

    <!-- 批量状态对话框 -->
    <BatchStatusDialog
      v-model:visible="batchDialogVisible"
      :ids="selectedIds"
      @done="fetchKanbanData(); clearSelection();"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { getRoomKanban, getRoomStats, exportRoomReport, exportRoomReportPDF } from '@/api/properties';
import { useWebSocket } from '@/composables/useWebSocket';
import { printDocument } from '@/utils/print-service';
import { ElMessage } from 'element-plus';
import { ArrowLeft, Printer, Download, DataAnalysis, Refresh, WarningFilled, CircleCheckFilled } from '@element-plus/icons-vue';
import RoomCard from '@/components/RoomCard.vue';
import RoomGrid from '@/components/RoomGrid.vue';
import RoomStatsPanel from '@/components/RoomStatsPanel.vue';
import BuildingFloorSelector from '@/components/BuildingFloorSelector.vue';
import RoomQuickActionDrawer from '@/components/RoomQuickActionDrawer.vue';
import BatchStatusDialog from '@/components/BatchStatusDialog.vue';

const buildings = ref<any[]>([]);           // 完整楼栋列表（供选择器使用，不受过滤影响）
const allFloors = ref<any[]>([]);
const stats = ref<Record<string, number>>({});
const selectedIds = ref<number[]>([]);
const filteredFloors = ref<any[]>([]);
const selectedBuilding = ref<string | null>(null);
const selectedFloor = ref<number | null>(null);
const wsConnected = ref(true);
const loading = ref(false);
const propertyTypeFilter = ref<string | undefined>(undefined);

// 快捷操作
const drawerVisible = ref(false);
const selectedRoom = ref<any>(null);
const validTransitions = ref<string[]>([]);
const selectedDoorLock = ref<any>(null);

// 批量状态
const batchDialogVisible = ref(false);

async function fetchKanbanData() {
  loading.value = true;
  try {
    // 始终拉取全部房源数据，楼栋/楼层筛选在前端完成（保证选择器始终有完整楼栋列表）
    const res = await getRoomKanban({
      type: propertyTypeFilter.value || undefined,
    });
    const data = (res as any).data;
    buildings.value = data.buildings || [];
    allFloors.value = data.allFloors || [];
    stats.value = data.stats || {};
    applyFilters();
  } catch (e: any) {
    ElMessage.error('加载房态数据失败: ' + (e.message || ''));
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  let floors = allFloors.value;
  if (selectedBuilding.value) {
    floors = floors.filter((f: any) => f.buildingName === selectedBuilding.value);
  }
  if (selectedFloor.value != null) {
    floors = floors.filter((f: any) => f.floorOrder === selectedFloor.value);
  }
  filteredFloors.value = floors;
}

function onFilterChange(building: string | null, floor: number | null) {
  selectedBuilding.value = building;
  selectedFloor.value = floor;
  applyFilters();
}

function onRoomClick(room: any) {
  selectedRoom.value = room;
  // 通过详情API获取validTransitions
  import('@/api/properties').then(api => {
    api.getProperty(room.id).then(res => {
      validTransitions.value = (res as any).data?.validTransitions || [];
    }).catch(() => { validTransitions.value = []; });
  });
  selectedDoorLock.value = room.doorLocks?.[0] || null;
  drawerVisible.value = true;
}

function onLockClick(room: any) {
  selectedRoom.value = room;
  selectedDoorLock.value = room.doorLocks?.[0] || null;
  drawerVisible.value = true;
}

function clearSelection() {
  selectedIds.value = [];
}

async function handleExportExcel() {
  try {
    const res = await exportRoomReport({ format: 'xlsx' });
    if ((res as any) instanceof Blob) {
      const url = URL.createObjectURL(res as any);
      const a = document.createElement('a');
      a.href = url; a.download = `房态报表_${new Date().toISOString().slice(0,10)}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      ElMessage.success('Excel 导出成功');
    } else {
      ElMessage.info('Excel 导出功能需要安装后端 exceljs 依赖');
    }
  } catch { ElMessage.error('导出失败'); }
}

function buildRoomReportHTML(data: any): string {
  const { rows, buildingSummary, total, exportTime } = data;
  const now = new Date(exportTime || Date.now()).toLocaleString('zh-CN');

  const summaryRows = (buildingSummary || []).map((s: any) =>
    `<tr><td>${s.buildingName}</td><td>${s.total}</td><td>${s.occupied}</td><td>${s.occupancyRate}%</td></tr>`
  ).join('');

  const detailRows = (rows || []).map((r: any) =>
    `<tr><td>${r.buildingName}</td><td>${r.roomNumber}</td><td>${r.floor}</td><td>${r.status}</td><td>${r.area}</td><td>${r.tenantName}</td><td>${r.contractEndDate}</td><td>${r.rentAmount}</td><td>${r.lockStatus}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>房态报表</title>
<style>
  body { font-family: "Microsoft YaHei","SimHei","PingFang SC",sans-serif; font-size: 12px; color: #333; padding: 16px; }
  h1 { text-align: center; font-size: 20px; margin-bottom: 4px; }
  .subtitle { text-align: center; font-size: 11px; color: #909399; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #dcdfe6; padding: 6px 8px; text-align: center; }
  th { background: #4472C4; color: #fff; font-weight: bold; }
  .section-title { font-size: 14px; font-weight: bold; margin: 12px 0 8px; padding: 6px 0; border-bottom: 2px solid #4472C4; }
</style></head><body>
<h1>房态报表</h1>
<p class="subtitle">导出时间：${now}　共 ${total || 0} 间</p>
<div class="section-title">楼栋汇总</div>
<table><thead><tr><th>楼栋</th><th>总间数</th><th>已出租</th><th>出租率</th></tr></thead><tbody>${summaryRows}</tbody></table>
<div class="section-title">房间明细</div>
<table><thead><tr><th>楼栋</th><th>房号</th><th>楼层</th><th>状态</th><th>面积(㎡)</th><th>租客</th><th>合同到期</th><th>月租金</th><th>门锁</th></tr></thead><tbody>${detailRows}</tbody></table>
</body></html>`;
}

async function handleExportPDF() {
  try {
    const res = await exportRoomReportPDF();
    const reportData = (res as any).data;
    const html = buildRoomReportHTML(reportData);
    await printDocument({
      title: '房态报表',
      paperSize: 'A4-landscape',
      htmlContent: html,
      mode: 'pdf',
    });
    ElMessage.success('PDF 导出成功');
  } catch { ElMessage.error('导出失败'); }
}

// WebSocket 实时监听房态变更
const { on: wsOn, isConnected } = useWebSocket();

watch(isConnected, (v) => { wsConnected.value = v; }, { immediate: true });

let unsubStatusChanged: (() => void) | null = null;
let unsubBatchStatusChanged: (() => void) | null = null;

onMounted(() => {
  fetchKanbanData();
  unsubStatusChanged = wsOn('room:status-changed', () => { fetchKanbanData(); });
  unsubBatchStatusChanged = wsOn('room:batch-status-changed', () => { fetchKanbanData(); });
});

onUnmounted(() => {
  unsubStatusChanged?.();
  unsubBatchStatusChanged?.();
});
</script>

<style scoped>
.room-kanban { padding: 4px; }
.kanban-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px; flex-wrap: wrap; gap: 8px;
}
.toolbar-left, .toolbar-right { display: flex; gap: 8px; align-items: center; }

.floor-group { margin-bottom: 20px; }
.floor-header {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #ebeef5;
}
.floor-label { font-size: 16px; font-weight: 600; color: #303133; }
.floor-count { font-size: 12px; color: #909399; }

.batch-bar {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: #fff; border-top: 2px solid #409EFF;
  padding: 12px 24px; display: flex; align-items: center; gap: 12px;
  z-index: 100; box-shadow: 0 -2px 12px rgba(0,0,0,0.1);
}
.empty-hint { text-align: center; padding: 80px 0; color: #909399; font-size: 14px; }
</style>
