<template>
  <el-breadcrumb separator="/" class="breadcrumb">
    <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
    <el-breadcrumb-item v-if="currentTitle">{{ currentTitle }}</el-breadcrumb-item>
  </el-breadcrumb>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const currentTitle = computed(() => route.meta?.title as string || '');
</script>

<style lang="scss" scoped>
.breadcrumb {
  padding: 8px 0;
}
</style>
