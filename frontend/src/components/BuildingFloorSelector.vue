<template>
  <div class="building-floor-selector">
    <div class="selector-row">
      <span class="selector-label">楼栋：</span>
      <el-radio-group v-model="selectedBuilding" size="small" @change="onChange">
        <el-radio-button
          v-for="b in buildings"
          :key="b.buildingName"
          :value="b.buildingName"
        >{{ b.buildingName }}</el-radio-button>
      </el-radio-group>
    </div>
    <div class="selector-row">
      <span class="selector-label">楼层：</span>
      <el-radio-group v-model="selectedFloor" size="small" @change="onChange">
        <el-radio-button :value="null">全部</el-radio-button>
        <el-radio-button
          v-for="f in currentFloors"
          :key="f"
          :value="f"
        >{{ f }}F</el-radio-button>
      </el-radio-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{
  buildings: { buildingName: string; buildingOrder: number; floors: { floorOrder: number; label: string; rooms: any[] }[] }[];
}>();

const emit = defineEmits<{
  change: [building: string | null, floor: number | null];
}>();

const selectedBuilding = ref<string | null>(null);
const selectedFloor = ref<number | null>(null);

const currentFloors = computed(() => {
  if (!selectedBuilding.value) {
    const all = new Set<number>();
    props.buildings.forEach(b => b.floors.forEach(f => all.add(f.floorOrder)));
    return Array.from(all).sort((a, b) => a - b);
  }
  const bld = props.buildings.find(b => b.buildingName === selectedBuilding.value);
  return bld ? bld.floors.map(f => f.floorOrder).sort((a, b) => a - b) : [];
});

function onChange() {
  emit('change', selectedBuilding.value, selectedFloor.value);
}
</script>

<style scoped>
.building-floor-selector { margin-bottom: 12px; }
.selector-row { display: flex; align-items: center; margin-bottom: 8px; gap: 8px; }
.selector-label { font-size: 13px; color: #606266; white-space: nowrap; font-weight: 500; }
</style>
