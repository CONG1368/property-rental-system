<template>
  <el-dialog :title="tenant ? '编辑租客' : '新增租客'" :model-value="modelValue" width="600px"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)" @closed="reset">
    <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
      <el-form-item label="姓名" prop="name"><el-input v-model="form.name" /></el-form-item>
      <el-form-item label="证件类型" prop="idType">
        <el-select v-model="form.idType" style="width:100%" clearable placeholder="选填，不填则不采集">
          <el-option v-for="t in ID_TYPES" :key="t" :label="t" :value="t" />
        </el-select>
      </el-form-item>
      <el-form-item label=" ">
        <IdCardReadButton mode="fill" @success="onIdCardRead" />
        <el-upload :show-file-list="false" :auto-upload="false" :on-change="onOcr" accept="image/*" style="margin-left:8px">
          <el-button size="small" type="primary">AI识别身份证</el-button>
        </el-upload>
      </el-form-item>
      <el-form-item label="证件号" prop="idNumber"><el-input v-model="form.idNumber" placeholder="选填，可留空" /></el-form-item>
      <el-form-item label="手机号" prop="phone"><el-input v-model="form.phone" placeholder="选填，可留空" /></el-form-item>
      <el-form-item label=" ">
        <span style="font-size:12px;color:var(--n-600);line-height:1.6">
          证件信息与联系方式均为选填，留空不影响保存。不填手机号时该租客无法使用租客自助门户；
          合同里是否写入这两项，由合同起草页的「乙方证件信息」开关单独决定。
        </span>
      </el-form-item>
      <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
      <el-form-item label="联系人"><el-input v-model="form.contactPerson" /></el-form-item>
      <el-form-item label="签约代表人"><el-input v-model="form.legalPerson" placeholder="合同底部乙方「法定代表人（授权代表）」（选填）" /></el-form-item>
      <el-form-item label="签约地址"><el-input v-model="form.signAddress" placeholder="合同底部乙方地址（选填，与证件地址互不影响）" /></el-form-item>
      <el-form-item label="邮编"><el-input v-model="form.postcode" placeholder="合同底部乙方邮编（选填）" /></el-form-item>
      <el-form-item label="开户银行"><el-input v-model="form.bankName" placeholder="合同底部乙方开户银行（选填）" /></el-form-item>
      <el-form-item label="银行账号"><el-input v-model="form.bankAccount" placeholder="合同底部乙方帐号（选填）" /></el-form-item>
      <el-form-item label=" ">
        <span style="font-size:12px;color:var(--n-600);line-height:1.6">
          以上五项（签约代表人 / 签约地址 / 邮编 / 开户银行 / 银行账号）全部选填、由你自己填写，只用于合同底部的乙方签约信息栏；
          不填则该栏留空，签约时手写即可。系统不会拿其他字段去顶替它们。
        </span>
      </el-form-item>
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
// 证件类型/证件号/手机号为选填（用户 2026-10-10 要求）：不登记也能建档，读卡/OCR 只是便捷回填。
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
// 证件类型默认留空（用户 2026-10-10 要求）：只有真正选择后才记录，合同里也不会凭空出现「证件类型：身份证」
const emptyForm = () => ({ name: '', idType: '', idNumber: '', phone: '', email: '', contactPerson: '', legalPerson: '', signAddress: '', postcode: '', bankName: '', bankAccount: '', status: '待入住', gender: '', birthDate: '', idAddress: '', notes: '' });
const form = ref<any>(emptyForm());
// 仅姓名必填；证件类型/证件号/手机号均为选填（用户 2026-10-10 要求，可自行决定是否添加）
const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
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
