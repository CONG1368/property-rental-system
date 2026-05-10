<template>
  <div class="top-nav-inner">
    <div class="nav-left">
      <span class="logo">🏠 物业租赁综合管理系统</span>
    </div>
    <div class="nav-right">
      <el-input
        v-model="searchText"
        placeholder="全局搜索..."
        :prefix-icon="Search"
        class="global-search"
        size="small"
        clearable
      />
      <el-badge :value="unreadCount" :hidden="unreadCount === 0" class="notification-badge">
        <el-icon :size="20" color="#fff"><Bell /></el-icon>
      </el-badge>
      <el-dropdown trigger="click">
        <span class="user-info">
          <el-avatar :size="32" icon="UserFilled" />
          <span class="username">{{ username }}</span>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>个人设置</el-dropdown-item>
            <el-dropdown-item divided @click="handleLogout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Search, Bell } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const searchText = ref('');
const unreadCount = ref(0);
const username = computed(() => authStore.user?.displayName || '管理员');
const handleLogout = () => authStore.logout();
</script>

<style lang="scss" scoped>
.top-nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.logo {
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
}
.nav-right {
  display: flex;
  align-items: center;
  gap: 20px;
}
.global-search {
  width: 240px;
}
.notification-badge {
  cursor: pointer;
}
.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #fff;
}
.username {
  font-size: 13px;
}
</style>
