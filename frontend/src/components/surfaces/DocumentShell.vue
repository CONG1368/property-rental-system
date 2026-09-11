<template>
  <div class="shell" data-surface="document">
    <slot name="header" />
    <div class="shell-body"><slot /></div>
  </div>
</template>

<script setup lang="ts">
// D 文档打印 界面外壳：不含业务，只负责板式。
// 差异全部来自 global.scss 的 [data-surface="document"] 密度变量。
</script>

<style scoped>
.shell { padding: var(--pad-page, 20px); }
.shell-body { display: flex; flex-direction: column; gap: var(--gap-card, 12px); }
</style>
