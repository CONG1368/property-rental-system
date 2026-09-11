<template>
  <el-dialog :title="tenant ? '编辑租客' : '新增租客'" :model-value="modelValue" width="600px"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)" @closed="reset">
    <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
      <el-form-item label="姓名" prop="name"><el-input v-model="form.name" /></el-form-item>
      <el-form-item label="证件类型" prop="idType">
        <el-select v-model="form.idType" style="width:100%"><el-option v-for="t in ID_TYPES" :key="t" :label="t" :value="t" /></el-select>
      </el-form-item>
      <el-form-item label=" ">
        <IdCardReadButton mode="fill" @success="onIdCardRead" />
        <el-upload :show-file-list="false" :auto-upload="false" :on-change="onOcr" accept="image/*" style="margin-left:8px">
          <el-button size="small" type="primary">AI识别身份证</el-button>
        </el-upload>
      </el-form-item>
      <el-form-item label="证件号" prop="idNumber"><el-input v-model="form.idNumber" /></el-form-item>
      <el-form-item label="手机号" prop="phone"><el-input v-model="form.phone" /></el-form-item>
      <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
      <el-form-item label="联系人"><el-input v-model="form.contactPerson" /></el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="form.status" style="width:100%"><el-option v-for="s in STATUS_OPTIONS" :key="s" :label="s" :value="s" /></el-select>
      </el-form-item>
      <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="submit">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
// 租客新增/编辑弹窗：表单 + 身份证读卡回填 + AI(OCR) 识别回填 + 提交。
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import request, { apiBaseURL } from '@/api/request';
import IdCardReadButton from '@/components/IdCardReadButton.vue';
import type { IdCardData } from '@/composables/useIdCardReader';

const props = defineProps<{ modelValue: boolean; tenant?: any | null }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'saved'): void }>();

const ID_TYPES = ['身份证', '营业执照', '护照'];
const STATUS_OPTIONS = ['待入住', '在租中', '已退租'];
const formRef = ref();
const emptyForm = () => ({ name: '', idType: '身份证', idNumber: '', phone: '', email: '', contactPerson: '', status: '待入住', gender: '', birthDate: '', idAddress: '', notes: '' });
const form = ref<any>(emptyForm());
const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  idType: [{ required: true, message: '请选择证件类型', trigger: 'change' }],
  idNumber: [{ required: true, message: '请输入证件号', trigger: 'blur' }],
  phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
};

watch(() => props.modelValue, (open) => { if (open) form.value = props.tenant ? { ...emptyForm(), ...props.tenant } : emptyForm(); });
function reset() { form.value = emptyForm(); }

async function submit() {
  await formRef.value?.validate();
  try {
    if (props.tenant?.id) { await request.put('/tenants/' + props.tenant.id, form.value); ElMessage.success('更新成功'); }
    else { await request.post('/tenants', form.value); ElMessage.success('创建成功'); }
    emit('update:modelValue', false); emit('saved');
  } catch (err: any) { ElMessage.error(err?.response?.data?.message || '操作失败'); }
}
function onIdCardRead(data: IdCardData) { form.value.name = data.name; form.value.idType = '身份证'; form.value.idNumber = data.idNumber; }
async function onOcr(file: any) {
  try {
    const fd = new FormData(); fd.append('image', file?.raw || file); fd.append('docType', 'id-card');
    const token = localStorage.getItem('accessToken') || '';
    const resp = await fetch(apiBaseURL + '/ocr/recognize', { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body: fd });
    const data = await resp.json();
    if (data.code !== 200) return ElMessage.error(data.message || '识别失败');
    const f = data.data?.fields || {};
    if (f.name) form.value.name = f.name;
    if (f.idNumber) form.value.idNumber = f.idNumber;
    if (f.gender) form.value.gender = f.gender;
    if (f.birthDate) form.value.birthDate = f.birthDate;
    if (f.address) form.value.idAddress = f.address;
    ElMessage.success('AI 识别完成，请核对证件号');
  } catch { ElMessage.error('识别失败'); }
}
</script>
