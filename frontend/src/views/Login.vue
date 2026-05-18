<template>
  <div class="login-page">
    <div class="login-card">
      <!-- 系统图标 -->
      <div class="login-logo">
        <el-icon :size="64" color="#0A3D62"><OfficeBuilding /></el-icon>
      </div>
      <h1 class="login-title">物业租赁综合管理系统</h1>
      <p class="login-subtitle">Property Rental Comprehensive Management System</p>

      <!-- 上次登录角色提示 -->
      <div class="login-role-hint" v-if="lastLoginRole">
        <el-tag size="small" effect="plain" type="info">
          上次登录角色：{{ lastLoginRole }}
        </el-tag>
      </div>

      <!-- 后端状态指示（Electron 环境自动检测） -->
      <div v-if="showBackendStatus" class="backend-status" :class="backendReady ? 'ready' : 'waiting'">
        <el-icon :size="16">
          <Loading v-if="!backendReady" class="is-loading" />
          <CircleCheck v-else />
        </el-icon>
        <span>{{ backendReady ? '服务已就绪' : '服务启动中，请稍候...' }}</span>
      </div>

      <!-- 错误提示 -->
      <el-alert
        v-if="errorMessage"
        :title="errorMessage"
        type="error"
        show-icon
        :closable="true"
        class="login-alert"
        @close="errorMessage = ''"
      />

      <el-form ref="formRef" :model="form" :rules="rules" size="large" class="login-form" @submit.prevent="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" :prefix-icon="User" clearable />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" :prefix-icon="Lock" show-password clearable @keyup.enter="handleLogin" />
        </el-form-item>

        <!-- 记住密码 -->
        <el-form-item class="login-options">
          <el-checkbox v-model="rememberPassword">记住密码</el-checkbox>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :loading="loading"
            :disabled="!backendReady && showBackendStatus"
            class="login-btn"
            @click="handleLogin"
          >
            {{ loading ? '登录中...' : (!backendReady && showBackendStatus ? '等待服务启动...' : '登 录') }}
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 版本信息 -->
      <p class="login-version">v{{ appVersion }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { User, Lock, OfficeBuilding, Loading, CircleCheck } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { saveCredentials, loadCredentials, clearCredentials } from '@/utils/credentialStorage';
import type { FormInstance, FormRules } from 'element-plus';

const router = useRouter();
const authStore = useAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);
const errorMessage = ref('');
const rememberPassword = ref(false);
const lastLoginRole = ref(localStorage.getItem('userRole') || '');
const appVersion = ref('1.0.2');

// 后端状态检测（Electron 环境）
const showBackendStatus = ref(false);
const backendReady = ref(false);
let statusPollTimer: ReturnType<typeof setInterval> | null = null;

const form = reactive({ username: '', password: '' });
const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

// 按角色跳转到最相关页面
function redirectByRole() {
  const role = authStore.user?.role || '';
  const rolePageMap: Record<string, string> = {
    '管理员': '/dashboard',
    '总经理': '/dashboard',
    '收租主管': '/rent/bills',
    '收租员': '/rent/bills',
    '财务主管': '/finance/dashboard',
    '会计': '/finance/vouchers',
    '出纳': '/finance/vouchers',
    '合同主管': '/contract/list',
    '法务': '/contract/approval',
  };
  const target = rolePageMap[role] || '/dashboard';
  router.push(target);
}

// 轮询后端健康状态（Electron 环境）
async function checkBackendStatus() {
  if (!window.electronAPI) return;
  try {
    const ok = await window.electronAPI.getBackendStatus();
    backendReady.value = ok;
    if (ok && statusPollTimer) {
      clearInterval(statusPollTimer);
      statusPollTimer = null;
    }
  } catch {
    backendReady.value = false;
  }
}

// 启动时预填已保存的密码（不自动提交）
onMounted(() => {
  const creds = loadCredentials();
  if (creds) {
    form.username = creds.username;
    form.password = creds.password;
    rememberPassword.value = true;
  }

  // Electron 环境：轮询后端状态
  if (window.electronAPI) {
    showBackendStatus.value = true;
    checkBackendStatus();
    if (!backendReady.value) {
      statusPollTimer = setInterval(checkBackendStatus, 2000);
    }
  }
});

onBeforeUnmount(() => {
  if (statusPollTimer) {
    clearInterval(statusPollTimer);
    statusPollTimer = null;
  }
});

async function handleLogin() {
  errorMessage.value = '';
  const valid = await formRef.value?.validate();
  if (!valid) return;

  loading.value = true;
  try {
    await authStore.login(form.username, form.password);

    // 记住密码：混淆存储凭证供下次预填
    if (rememberPassword.value) {
      saveCredentials(form.username, form.password);
    } else {
      clearCredentials();
    }

    ElMessage.success('登录成功');
    redirectByRole();
  } catch (err: any) {
    const status = err.response?.status;
    const code = err.response?.data?.code;
    if (!err.response) {
      // 无响应 — 后端不可达
      errorMessage.value = '无法连接到服务，请检查服务是否已启动';
    } else if (code === 403) {
      errorMessage.value = '账户已被禁用，请联系管理员';
    } else if (status === 401) {
      errorMessage.value = '用户名或密码错误';
    } else {
      errorMessage.value = err.response?.data?.message || '登录失败，请检查网络连接';
    }
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #0A3D62 0%, #1a5f8a 100%);
}
.login-card {
  width: 420px;
  padding: 48px 40px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.2);
}
.login-logo {
  text-align: center;
  margin-bottom: 16px;
}
.login-title {
  font-size: 22px;
  text-align: center;
  color: #0A3D62;
  margin-bottom: 8px;
}
.login-subtitle {
  text-align: center;
  color: #7F8C8D;
  font-size: 12px;
  margin-bottom: 16px;
}
.login-role-hint {
  text-align: center;
  margin-bottom: 16px;
}
.backend-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  margin-bottom: 16px;
  border-radius: 6px;
  font-size: 13px;
  &.waiting {
    background: #fdf6ec;
    color: #e6a23c;
  }
  &.ready {
    background: #f0f9eb;
    color: #67c23a;
  }
}
.login-alert {
  margin-bottom: 16px;
}
.login-form {
  margin-top: 8px;
}
.login-options {
  margin-bottom: 8px;
}
.login-btn {
  width: 100%;
}
.login-version {
  text-align: center;
  color: #B0BEC5;
  font-size: 11px;
  margin-top: 24px;
  margin-bottom: 0;
}
</style>
