<template>
  <div class="top-nav-inner">
    <!-- 左侧占位 -->
    <div class="nav-left"></div>
    <!-- 中间：系统名称（居中） -->
    <div class="nav-center">
      <img v-if="sysLogo" :src="sysLogo" class="sys-logo" alt="logo" />
      <span v-else class="sys-logo-emoji" @click="triggerLogoUpload">🏠</span>
      <span class="logo-text">物业租赁综合管理系统</span>
    </div>
    <div class="nav-right">
      <!-- 全局搜索 — 回车触发 -->
      <div class="search-wrap">
        <el-input
          v-model="searchText" placeholder="全局搜索房源/租客/合同..."
          :prefix-icon="Search" class="global-search" size="small" clearable
          @keyup.enter="doSearch"
          @clear="clearSearch"
          @blur="scheduleClear"
        />
        <!-- 搜索结果下拉 -->
        <div class="search-dropdown" v-if="hasResults || searched" @mouseleave="clearSearch">
          <div v-if="!hasResults && searched" class="search-empty">未找到匹配 "{{ searchedTerm }}" 的结果</div>
          <div class="search-group" v-if="propsResults.length > 0">
            <div class="search-group-title">房源 ({{ propsResults.length }})</div>
            <div class="search-item" v-for="r in propsResults" :key="'p'+r.id" @click="goResult('/rent/properties/' + r.id)">
              <span>🏠</span> <span class="s-name">{{ r.name }}</span> <span class="s-sub">{{ r.address }}</span>
            </div>
          </div>
          <div class="search-group" v-if="tenantResults.length > 0">
            <div class="search-group-title">租客 ({{ tenantResults.length }})</div>
            <div class="search-item" v-for="r in tenantResults" :key="'t'+r.id" @click="goResult('/rent/tenants/' + r.id)">
              <span>👤</span> <span class="s-name">{{ r.name }}</span> <span class="s-sub">{{ r.phone }}</span>
            </div>
          </div>
          <div class="search-group" v-if="contractResults.length > 0">
            <div class="search-group-title">合同 ({{ contractResults.length }})</div>
            <div class="search-item" v-for="r in contractResults" :key="'c'+r.id" @click="goResult('/contract/detail/' + r.id)">
              <span>📝</span> <span class="s-name">{{ r.contractNo }}</span> <span class="s-sub">{{ r['tenant.name'] || r['property.name'] || '' }}</span>
            </div>
          </div>
        </div>
      </div>
      <el-popover placement="bottom-end" :width="360" trigger="click" @show="fetchNotifications">
        <template #reference>
          <el-badge :value="unreadCount" :hidden="unreadCount === 0" class="notification-badge">
            <el-icon :size="20" color="#fff"><Bell /></el-icon>
          </el-badge>
        </template>
        <div class="notify-panel">
          <div class="notify-header">
            <span class="notify-title">消息通知</span>
            <el-button v-if="unreadCount > 0" type="primary" link size="small" @click="readAll">全部已读</el-button>
          </div>
          <div class="notify-list" v-if="notifications.length > 0">
            <div
              class="notify-item"
              :class="{ unread: !n.isRead }"
              v-for="n in notifications"
              :key="n.id"
              @click="readOne(n)"
            >
              <div class="notify-dot" v-if="!n.isRead"></div>
              <div class="notify-body">
                <div class="notify-item-title">{{ n.title }}</div>
                <div class="notify-item-content">{{ n.content }}</div>
                <div class="notify-item-time">{{ n.createdAt?.slice(0, 16)?.replace('T', ' ') }}</div>
              </div>
            </div>
          </div>
          <div v-else class="notify-empty">暂无消息</div>
        </div>
      </el-popover>
      <el-dropdown trigger="click">
        <span class="user-info">
          <img v-if="avatarUrl" :src="avatarUrl" class="avatar-img" />
          <span v-else class="avatar-icon" :style="{ background: avatarBg }">{{ avatarIcon }}</span>
          <span class="username">{{ username }}</span>
          <el-tag size="small" type="danger" v-if="userRole === '管理员'" style="margin-left:6px">管理员</el-tag>
          <el-tag size="small" type="warning" v-else-if="userRole" style="margin-left:6px">{{ userRole }}</el-tag>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="profileVisible = true">个人设置</el-dropdown-item>
            <el-dropdown-item divided @click="handleLogout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- 个人设置弹窗 -->
    <el-dialog title="个人设置" v-model="profileVisible" width="500px">
      <el-form :model="profileForm" label-width="80px">
        <el-form-item label="用户名"><el-input v-model="profileForm.username" disabled /></el-form-item>
        <el-form-item label="显示名称"><el-input v-model="profileForm.displayName" /></el-form-item>
        <el-form-item label="角色">
          <span class="avatar-icon" :style="{ background: avatarBg }" style="display:inline-flex;vertical-align:middle;margin-right:8px">{{ profileForm.avatar || avatarIcon }}</span>
          <el-tag>{{ authStore.user?.role || '-' }}</el-tag>
        </el-form-item>
        <el-form-item label="自定义头像">
          <div class="avatar-picker">
            <span v-for="(a, i) in presetAvatars" :key="i" class="avatar-option" :class="{ selected: profileForm.avatar === a.icon }" @click="selectAvatar(a.icon)" :title="a.label">{{ a.icon }}</span>
          </div>
          <el-divider style="margin:10px 0">或上传图片</el-divider>
          <div style="display:flex;align-items:center;gap:10px">
            <el-upload
              :action="apiBaseURL + '/users/' + authStore.user?.id + '/avatar'"
              :headers="uploadHeaders"
              :show-file-list="false"
              :on-success="onAvatarUploaded"
              :on-error="onAvatarError"
              accept=".jpg,.jpeg,.png,.gif,.webp"
            >
              <el-button size="small">选择图片</el-button>
            </el-upload>
            <img v-if="profileForm.avatarUrl" :src="profileForm.avatarUrl" class="avatar-preview" />
            <span v-if="profileForm.avatarUrl" class="avatar-icon" :style="{ background: avatarBg }" style="display:inline-flex">{{ profileForm.avatar || avatarIcon }}</span>
            <span style="font-size:11px;color:#909399">JPG/PNG/GIF ≤2MB</span>
          </div>
        </el-form-item>
        <el-form-item label="新密码"><el-input v-model="profileForm.password" type="password" placeholder="留空则不修改" /></el-form-item>
        <el-form-item label="确认密码"><el-input v-model="profileForm.confirmPwd" type="password" placeholder="留空则不修改" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="profileVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveProfile" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- Logo 上传隐藏 input -->
    <input ref="logoInput" type="file" accept=".jpg,.jpeg,.png,.gif,.webp" style="display:none" @change="onLogoSelected" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { Search, Bell } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { getRoleAvatar, presetAvatars } from '@/utils/avatars';
import request, { apiBaseURL } from '@/api/request';
import { useWebSocket } from '@/composables/useWebSocket';

const router = useRouter();
function goPage(path: string) { if (path) router.push(path); }
function goResult(path: string) {
  // 跳转前彻底清除搜索状态
  searchText.value = '';
  propsResults.value = [];
  tenantResults.value = [];
  contractResults.value = [];
  router.push(path);
}

const authStore = useAuthStore();
const searchText = ref('');
const unreadCount = ref(0);
const notifications = ref<any[]>([]);

async function fetchNotifications() {
  try {
    const [listRes, countRes] = await Promise.all([
      request.get('/notifications', { params: { pageSize: 20 } }),
      request.get('/notifications/unread-count'),
    ]);
    notifications.value = listRes.data?.list || [];
    unreadCount.value = countRes.data?.count || 0;
  } catch {}
}

async function readOne(n: any) {
  if (!n.isRead) {
    try { await request.put('/notifications/' + n.id + '/read'); n.isRead = true; unreadCount.value = Math.max(0, unreadCount.value - 1); } catch {}
  }
  // 根据 linkType/linkId 自动跳转
  if (n.linkType && n.linkId) {
    const routeMap: Record<string, string> = {
      tenant: '/rent/tenants/',
      contract: '/contract/detail/',
      property: '/rent/properties/',
      bill: '/rent/bills',
    };
    const base = routeMap[n.linkType];
    if (base) {
      router.push(base + n.linkId);
      // 关闭 popover（通过移除焦点）
      setTimeout(() => (document.activeElement as HTMLElement)?.blur?.(), 100);
    }
  }
}

async function readAll() {
  try { await request.put('/notifications/read-all'); unreadCount.value = 0; notifications.value.forEach(n => n.isRead = true); } catch {}
}
const saving = ref(false);
const username = computed(() => authStore.user?.displayName || '管理员');
const userRole = computed(() => authStore.user?.role || '');
const avatarInfo = computed(() => getRoleAvatar(userRole.value));
const avatarIcon = computed(() => authStore.user?.permissions?.avatar || avatarInfo.value.icon);
const avatarUrl = computed(() => authStore.user?.permissions?.avatarUrl || '');
const avatarBg = computed(() => avatarInfo.value.bg);
const handleLogout = () => authStore.logout();

// ---- 系统 Logo ----
const logoInput = ref<HTMLInputElement>();
const sysLogo = ref(localStorage.getItem('sysLogo') || '');
function triggerLogoUpload() { logoInput.value?.click(); }
function onLogoSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > 500 * 1024) { ElMessage.error('Logo 图片不能超过 500KB'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    sysLogo.value = reader.result as string;
    localStorage.setItem('sysLogo', sysLogo.value);
    ElMessage.success('系统 Logo 已更新');
  };
  reader.readAsDataURL(file);
}

// ---- 全局搜索 ----
const propsResults = ref<any[]>([]);
const tenantResults = ref<any[]>([]);
const contractResults = ref<any[]>([]);
const hasResults = computed(() => propsResults.value.length + tenantResults.value.length + contractResults.value.length > 0);

function clearSearch() {
  propsResults.value = [];
  tenantResults.value = [];
  contractResults.value = [];
  searched.value = false;
  searchedTerm.value = '';
}

let clearTimer: any;
function scheduleClear() {
  // 延迟关闭，让点击事件先触发
  clearTimeout(clearTimer);
  clearTimer = setTimeout(clearSearch, 200);
}

const searched = ref(false);
const searchedTerm = ref('');

async function doSearch() {
  const q = searchText.value.trim();
  if (!q) { clearSearch(); searched.value = false; return; }
  searchedTerm.value = q;
  searched.value = true;
  try {
    const [pRes, tRes, cRes] = await Promise.all([
      request.get('/properties', { params: { keyword: q, pageSize: 5 } }),
      request.get('/tenants', { params: { keyword: q, pageSize: 5 } }),
      request.get('/contracts', { params: { pageSize: 5 } }),
    ]);
    propsResults.value = (pRes.data?.list || []).filter((r: any) => r.name?.includes(q) || r.address?.includes(q));
    tenantResults.value = (tRes.data?.list || []).filter((r: any) => r.name?.includes(q) || r.phone?.includes(q));
    // 合同按编号模糊匹配
    const cList = cRes.data?.list || [];
    contractResults.value = q ? cList.filter((r: any) => r.contractNo?.includes(q)) : [];
  } catch {
    ElMessage.error('搜索失败，请重试');
  }
}

// ---- 个人设置 ----
const profileVisible = ref(false);
const uploadHeaders = computed(() => ({ Authorization: 'Bearer ' + localStorage.getItem('accessToken') }));
const profileForm = reactive({
  username: authStore.user?.username || '',
  displayName: authStore.user?.displayName || '',
  avatar: authStore.user?.permissions?.avatar || '',
  avatarUrl: authStore.user?.permissions?.avatarUrl || '',
  password: '',
  confirmPwd: '',
});

function selectAvatar(icon: string) {
  profileForm.avatar = icon;
  profileForm.avatarUrl = ''; // 选择emoji时清除图片头像
}

function onAvatarUploaded(res: any) {
  if (res.code === 200) {
    profileForm.avatarUrl = res.data.avatarUrl;
    profileForm.avatar = ''; // 上传图片时清除emoji
    ElMessage.success('头像上传成功');
  }
}
function onAvatarError() { ElMessage.error('头像上传失败，请检查格式和大小'); }

async function handleSaveProfile() {
  if (profileForm.password && profileForm.password !== profileForm.confirmPwd) { ElMessage.error('两次密码不一致'); return; }
  saving.value = true;
  try {
    const body: any = { displayName: profileForm.displayName };
    if (profileForm.password) body.password = profileForm.password;
    body.permissions = { ...(authStore.user?.permissions || {}), avatar: profileForm.avatar || '', avatarUrl: profileForm.avatarUrl || '' };
    await request.put('/users/' + authStore.user!.id, body);
    if (authStore.user) { authStore.user.displayName = profileForm.displayName; authStore.user.permissions = body.permissions; }
    ElMessage.success('个人信息已更新');
    profileVisible.value = false;
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '保存失败'); }
  finally { saving.value = false; }
}

const { on: wsOn, off: wsOff } = useWebSocket();

// WebSocket: 监听新通知，实时更新消息中心
let cleanupWsNotif: (() => void) | null = null;

onMounted(async () => {
  try { const res = await request.get('/notifications/unread-count'); unreadCount.value = res.data?.count || 0; } catch {}

  // 实时监听催缴通知
  cleanupWsNotif = wsOn('notification:new', () => {
    // 增加未读计数
    unreadCount.value = unreadCount.value + 1;
    // 如果 popover 正打开，刷新列表
    if (notifications.value.length > 0) {
      fetchNotifications();
    }
  });
});

onUnmounted(() => {
  if (cleanupWsNotif) cleanupWsNotif();
});
</script>

<style lang="scss" scoped>
.top-nav-inner { display: flex; align-items: center; width: 100%; }
.nav-left { width: 200px; flex-shrink: 0; }
.nav-center { display: flex; align-items: center; justify-content: center; gap: 8px; flex: 1; }
.nav-right { display: flex; align-items: center; gap: 20px; flex-shrink: 0; }
.logo-text { color: #fff; font-size: 17px; font-weight: 700; letter-spacing: 1px; white-space: nowrap; }
.sys-logo { width: 28px; height: 28px; object-fit: contain; flex-shrink: 0; }
.sys-logo-emoji { font-size: 22px; cursor: pointer; flex-shrink: 0; transition: transform 0.2s; user-select: none; }
.sys-logo-emoji:hover { transform: scale(1.2); }
.search-wrap { position: relative; }
.global-search { width: 260px; }

.search-dropdown {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 2000;
  background: #fff; border-radius: 6px; box-shadow: 0 8px 30px rgba(0,0,0,0.18);
  max-height: 380px; overflow-y: auto; margin-top: 4px;
}
.search-group { padding: 8px 0; }
.search-group + .search-group { border-top: 1px solid #f0f0f0; }
.search-group-title { font-size: 11px; color: #909399; padding: 4px 14px; font-weight: 500; }
.search-item {
  display: flex; align-items: center; gap: 6px; padding: 7px 14px; cursor: pointer; font-size: 13px;
  transition: background 0.15s;
  &:hover { background: #f0f5ff; }
}
.s-name { color: #303133; font-weight: 500; text-align: center; flex: 1; }
.s-sub { color: #909399; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; text-align: right; }

.notification-badge { cursor: pointer; }
.notify-panel { max-height: 400px; display: flex; flex-direction: column; }
.notify-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0; margin-bottom: 8px; }
.notify-title { font-size: 14px; font-weight: 600; color: #303133; }
.notify-list { overflow-y: auto; flex: 1; }
.notify-item { display: flex; align-items: flex-start; gap: 8px; padding: 10px 8px; border-radius: 6px; cursor: pointer; transition: background 0.15s; }
.notify-item:hover { background: #f5f7fa; }
.notify-item.unread { background: #f0f5ff; }
.notify-dot { width: 6px; height: 6px; border-radius: 50%; background: #409eff; margin-top: 6px; flex-shrink: 0; }
.notify-body { flex: 1; min-width: 0; }
.notify-item-title { font-size: 13px; color: #303133; font-weight: 500; margin-bottom: 2px; }
.notify-item-content { font-size: 12px; color: #909399; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.notify-item-time { font-size: 11px; color: #c0c4cc; margin-top: 4px; }
.notify-empty { text-align: center; color: #c0c4cc; font-size: 13px; padding: 24px 0; }
.user-info { display: flex; align-items: center; gap: 8px; cursor: pointer; color: #fff; }
.username { font-size: 13px; }
.avatar-icon { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #fff; flex-shrink: 0; }
.avatar-picker { display: flex; flex-wrap: wrap; gap: 6px; }
.avatar-option { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; cursor: pointer; border: 2px solid transparent; background: #f5f7fa; transition: all 0.2s; }
.avatar-option:hover { background: #e6f0ff; border-color: #409eff; }
.avatar-option.selected { background: #ecf5ff; border-color: #409eff; box-shadow: 0 0 0 2px rgba(64,158,255,0.2); }
.avatar-img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.avatar-preview { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #e0e0e0; }
</style>
