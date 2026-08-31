<template>
  <div class="login-page">
    <!-- 左侧品牌区（Stripe 风格） -->
    <div class="login-brand">
      <div class="brand-inner">
        <div class="brand-logo"><el-icon :size="28"><OfficeBuilding /></el-icon></div>
        <h2 class="brand-h2">专业的物业租赁<br>经营管理平台</h2>
        <p class="brand-p">房源、租客、收租、合同、财务、消防一站式管理，让每一次收租清晰可查。</p>
        <div class="brand-feature">
          <div class="bf"><span class="bf-dot"><el-icon :size="12"><Select /></el-icon></span> 实时收租看板</div>
          <div class="bf"><span class="bf-dot"><el-icon :size="12"><Select /></el-icon></span> 智能逾期催缴</div>
          <div class="bf"><span class="bf-dot"><el-icon :size="12"><Select /></el-icon></span> 财务合规审计</div>
        </div>
      </div>
    </div>

    <div class="login-card">
      <h1 class="login-title">物业租赁综合管理系统</h1>
      <p class="login-subtitle">Property Rental Comprehensive Management System</p>

      <!-- 上次登录角色提示 -->
      <div class="login-role-hint" v-if="lastLoginRole">
        <el-tag size="small" effect="plain" type="info">
          上次登录角色：{{ lastLoginRole }}
        </el-tag>
      </div>

      <!-- 后端状态指示（Electron 环境自动检测） -->
      <div v-if="showBackendStatus" class="backend-status" :class="backendReady && seedDataReady ? 'ready' : 'waiting'">
        <el-icon :size="16">
          <Loading v-if="!backendReady || !seedDataReady" class="is-loading" />
          <CircleCheck v-else />
        </el-icon>
        <span>{{ !backendReady ? '服务启动中，请稍候...' : !seedDataReady ? '正在初始化演示数据，请稍候...' : '服务已就绪' }}</span>
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
            :disabled="(!backendReady || !seedDataReady) && showBackendStatus"
            class="login-btn"
            @click="handleLogin"
          >
            {{ loading ? '登录中...' : (!backendReady && showBackendStatus ? '等待服务启动...' : !seedDataReady && showBackendStatus ? '等待数据初始化...' : '登 录') }}
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
import { User, Lock, OfficeBuilding, Loading, CircleCheck, Select } from '@element-plus/icons-vue';
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
const appVersion = ref(__APP_VERSION__);

// 后端状态检测（Electron 环境）
const showBackendStatus = ref(false);
const backendReady = ref(false);
const seedDataReady = ref(false);
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
    const status = await window.electronAPI.getBackendStatus();
    backendReady.value = status.ok;
    seedDataReady.value = status.seedReady;
    if (status.ok && status.seedReady && statusPollTimer) {
      clearInterval(statusPollTimer);
      statusPollTimer = null;
    }
  } catch {
    backendReady.value = false;
    seedDataReady.value = false;
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
    if (!backendReady.value || !seedDataReady.value) {
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
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
  background: linear-gradient(135deg, #e3ecfb, #dbe6f8 45%, #e0edf7);
}
/* 左侧品牌区 */
.login-brand {
  background: linear-gradient(160deg, #1a3a6b, #2456b8 55%, #3b72d8);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px;
}
.brand-inner { max-width: 420px; }
.brand-logo {
  width: 52px; height: 52px; border-radius: 14px;
  background: #4f7cf7; display: flex; align-items: center; justify-content: center;
  margin-bottom: 28px; box-shadow: 0 10px 30px rgba(79,124,247,.4);
}
.brand-h2 {
  font-size: 36px; font-weight: 700; letter-spacing: -0.02em;
  line-height: 1.15; margin-bottom: 16px;
}
.brand-p { opacity: .75; font-size: 15px; max-width: 40ch; line-height: 1.6; }
.brand-feature { display: flex; flex-direction: column; gap: 14px; margin-top: 40px; }
.bf { display: flex; gap: 10px; align-items: center; font-size: 14px; opacity: .9; }
.bf-dot {
  width: 20px; height: 20px; border-radius: 6px; background: rgba(255,255,255,.15);
  display: inline-flex; align-items: center; justify-content: center; font-size: 12px;
}
/* 右侧登录卡 */
.login-card {
  width: 100%;
  max-width: 420px;
  padding: 48px 40px;
  background: rgba(255,255,255,.62);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(255,255,255,.72);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(31,41,55,.14), inset 0 1px 0 rgba(255,255,255,.55);
  align-self: center;
  justify-self: center;
}
.login-title {
  font-size: 22px;
  text-align: center;
  color: #1a1f36;
  font-weight: 700;
  margin-bottom: 8px;
}
.login-subtitle {
  text-align: center;
  color: #687385;
  font-size: 12px;
  margin-bottom: 24px;
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
