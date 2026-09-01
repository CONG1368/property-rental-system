<template>
  <el-container class="app-layout">
    <el-header class="top-nav" height="56px">
      <TopNav />
    </el-header>
    <el-container>
      <el-aside class="sidebar" width="220px">
        <Sidebar />
      </el-aside>
      <el-main class="main-content">
        <Breadcrumb />
        <div class="content-area">
          <router-view />
        </div>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import TopNav from './TopNav.vue';
import Sidebar from './Sidebar.vue';
import Breadcrumb from './Breadcrumb.vue';
</script>

<style lang="scss" scoped>
.app-layout {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.top-nav {
  background: rgba(26,43,68,.82);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.sidebar {
  background: rgba(255,255,255,.55);
  border-right: 1px solid rgba(255,255,255,.7);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  overflow-y: auto;
  height: 100%;
}
.main-content {
  background: transparent;
  padding: 16px;
  overflow-y: auto;
  height: 100%;
}
.app-layout > .el-container {
  flex: 1;
  overflow: hidden;
}
.content-area {
  margin-top: 12px;
  min-height: calc(100vh - 140px);
}
</style>
