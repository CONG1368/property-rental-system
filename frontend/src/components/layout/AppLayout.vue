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
  background: #0A3D62;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.sidebar {
  background: #fff;
  border-right: 1px solid #e8e8e8;
  overflow-y: auto;
  height: 100%;
}
.main-content {
  background: #f5f7fa;
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
