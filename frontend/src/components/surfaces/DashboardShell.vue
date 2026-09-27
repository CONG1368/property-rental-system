<template>
  <div class="shell" data-surface="dashboard">
    <slot name="header" />
    <div class="shell-body"><slot /></div>
  </div>
</template>

<script setup lang="ts">
// B 看板仪表 界面外壳：不含业务，只负责板式。
// 差异全部来自 global.scss 的 [data-surface="dashboard"] 密度变量。
</script>

<style scoped>
.shell { padding: var(--pad-page, 20px); }
.shell-body { display: flex; flex-direction: column; gap: var(--gap-card, 12px); }
</style>
