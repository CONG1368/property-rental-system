<template>
  <router-view />
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { onMounted } from 'vue';

const router = useRouter();

onMounted(() => {
  if (window.electronAPI?.onMenuNavigate) {
    window.electronAPI.onMenuNavigate((path: string) => {
      router.push(path);
    });
  }
});
</script>

<style lang="scss">
#app {
  height: 100vh;
  overflow: hidden;
}
</style>
