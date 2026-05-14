<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">物业租赁综合管理系统</h1>
      <p class="login-subtitle">Property Rental Comprehensive Management System</p>
      <el-form ref="formRef" :model="form" :rules="rules" size="large" class="login-form">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" :prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" :prefix-icon="Lock" show-password @keyup.enter="handleLogin" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" class="login-btn" @click="handleLogin">登 录</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { User, Lock } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import type { FormInstance, FormRules } from 'element-plus';

const router = useRouter();
const authStore = useAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({ username: '', password: '' });
const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function handleLogin() {
  const valid = await formRef.value?.validate();
  if (!valid) return;
  loading.value = true;
  try {
    await authStore.login(form.username, form.password);
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || '登录失败');
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
  margin-bottom: 32px;
}
.login-form {
  margin-top: 16px;
}
.login-btn {
  width: 100%;
}
</style>
