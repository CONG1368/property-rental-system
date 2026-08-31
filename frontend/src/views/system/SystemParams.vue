<template>
  <div class="system-params">
    <div class="toolbar">
      <h2 class="page-title">系统参数中心</h2>
      <el-button type="primary" @click="openCreate">新增配置项</el-button>
      <el-button @click="fetchData" :loading="loading">刷新</el-button>
    </div>

    <el-row :gutter="16">
      <el-col :span="6">
        <el-card header="分组筛选">
          <div
            v-for="g in groups"
            :key="g"
            class="group-item"
            :class="{ active: groupFilter === g }"
            @click="groupFilter = g; fetchData()"
          >
            {{ g }} <el-tag size="small" type="info">{{ groupCount(g) }}</el-tag>
          </div>
          <div class="group-item" :class="{ active: groupFilter === '' }" @click="groupFilter = ''; fetchData()">全部</div>
        </el-card>
      </el-col>

      <el-col :span="18">
        <el-table :data="filteredList" stripe v-loading="loading">
          <el-table-column prop="configKey" label="键名" width="220" />
          <el-table-column label="键值" min-width="220">
            <template #default="{ row }">
              <span v-if="row.isSensitive && row.configValue" class="sensitive">••••••（敏感值）</span>
              <span v-else>{{ row.configValue }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="configGroup" label="分组" width="110" />
          <el-table-column prop="valueType" label="类型" width="90" />
          <el-table-column prop="description" label="描述" min-width="140" />
          <el-table-column label="内置" width="70">
            <template #default="{ row }">
              <el-tag :type="row.builtIn ? 'warning' : 'info'" size="small">{{ row.builtIn ? '是' : '否' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="openEdit(row)">编辑</el-button>
              <el-popconfirm title="确定删除该配置项？" @confirm="handleDelete(row)">
                <template #reference><el-button size="small" type="danger" :disabled="row.builtIn">删除</el-button></template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-model:current-page="page" :total="total" :page-size="pageSize"
          layout="total, prev, pager, next" style="margin-top:16px; justify-content:flex-end"
          @current-change="fetchData"
        />
      </el-col>
    </el-row>

    <!-- 新增/编辑配置项 -->
    <el-dialog :title="editing ? '编辑配置项' : '新增配置项'" v-model="dialogVisible" width="520px">
      <el-form label-width="100px">
        <el-form-item label="键名" required><el-input v-model="form.configKey" :disabled="!!editing" /></el-form-item>
        <el-form-item label="键值"><el-input v-model="form.configValue" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="分组">
          <el-select v-model="form.configGroup" style="width:100%">
            <el-option v-for="g in groups" :key="g" :label="g" :value="g" />
          </el-select>
        </el-form-item>
        <el-form-item label="值类型">
          <el-select v-model="form.valueType" style="width:100%">
            <el-option label="字符串" value="string" /><el-option label="数字" value="number" />
            <el-option label="布尔" value="boolean" /><el-option label="JSON" value="json" />
          </el-select>
        </el-form-item>
        <el-form-item label="敏感值"><el-switch v-model="form.isSensitive" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { confirmWithPassword } from '@/utils/confirm-password';
import request from '@/api/request';

const list = ref<any[]>([]);
const loading = ref(false);
const saving = ref(false);
const page = ref(1);
const pageSize = ref(200);
const total = ref(0);
const groupFilter = ref('');

const dialogVisible = ref(false);
const editing = ref(false);
const form = ref<any>({ configKey: '', configValue: '', configGroup: '其他', valueType: 'string', isSensitive: false, description: '' });

const filteredList = computed(() => {
  if (!groupFilter.value) return list.value;
  return list.value.filter((i) => (i.configGroup || '其他') === groupFilter.value);
});

const groups = computed(() => {
  const set = new Set<string>(list.value.map((i) => i.configGroup || '其他'));
  return Array.from(set);
});

function groupCount(g: string) {
  return list.value.filter((i) => (i.configGroup || '其他') === g).length;
}

async function fetchData() {
  loading.value = true;
  try {
    const res = await request.get('/system-configs', { params: { page: page.value, pageSize: pageSize.value } });
    list.value = res.data?.list || [];
    total.value = list.value.length;
  } catch { /* silent */ } finally { loading.value = false; }
}

function openCreate() {
  editing.value = false;
  form.value = { configKey: '', configValue: '', configGroup: groupFilter.value || '其他', valueType: 'string', isSensitive: false, description: '' };
  dialogVisible.value = true;
}

function openEdit(row: any) {
  editing.value = true;
  form.value = { ...row, isSensitive: !!row.isSensitive };
  dialogVisible.value = true;
}

async function handleSave() {
  if (!form.value.configKey) { ElMessage.error('键名不能为空'); return; }
  saving.value = true;
  try {
    const pwd = await confirmWithPassword(editing.value ? '保存系统配置需重新输入登录密码确认' : '新增系统配置需重新输入登录密码确认', '二次确认');
    if (!pwd) return;
    if (editing.value) {
      await request.put('/system-configs/' + form.value.configKey, { configValue: form.value.configValue, description: form.value.description, confirmPassword: pwd });
    } else {
      await request.post('/system-configs', { ...form.value, confirmPassword: pwd });
    }
    ElMessage.success('已保存');
    dialogVisible.value = false;
    fetchData();
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '保存失败');
  } finally { saving.value = false; }
}

async function handleDelete(row: any) {
  try {
    const pwd = await confirmWithPassword('删除配置项需重新输入登录密码确认', '二次确认');
    if (!pwd) return;
    await request.delete('/system-configs/' + row.configKey, { data: { confirmPassword: pwd } });
    ElMessage.success('已删除');
    fetchData();
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '删除失败');
  }
}

onMounted(fetchData);
</script>

<style lang="scss" scoped>
.toolbar { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
.page-title { font-size:18px; font-weight:700; color:#1f2430; margin:0; }
.group-item {
  padding:10px 12px; border-radius:6px; cursor:pointer; margin-bottom:6px;
  display:flex; justify-content:space-between; align-items:center;
  font-size:14px; color:#333; transition: all .15s;
  &:hover { background:#f2f6fc; }
  &.active { background:#4f7cf7; color:#fff; }
}
.sensitive { font-family: monospace; color:#909399; letter-spacing:2px; }
</style>
