<template>
  <div class="print-settings">
    <h2 class="page-title">打印设置</h2>

    <el-row :gutter="20">
      <el-col :span="14">
        <el-card header="公司信息">
          <el-form :model="form" label-width="120px" @submit.prevent>
            <el-form-item label="公司全称">
              <el-input v-model="form.companyName" placeholder="合同和收据上显示的公司全称" />
            </el-form-item>

            <el-form-item label="公司 Logo">
              <div style="display:flex;align-items:center;gap:12px">
                <el-upload
                  :auto-upload="false"
                  :limit="1"
                  accept="image/png,image/jpeg"
                  :show-file-list="false"
                  :on-change="onLogoChange"
                >
                  <el-button>选择图片</el-button>
                </el-upload>
                <span style="font-size:12px;color:#909399">建议 200×80px，PNG/JPG</span>
              </div>
              <div v-if="form.companyLogo" style="margin-top:8px;position:relative;display:inline-block">
                <img :src="form.companyLogo" style="max-width:300px;max-height:80px;border:1px solid #eee;border-radius:4px" />
                <el-button size="small" type="danger" circle style="position:absolute;top:-8px;right:-8px" @click="form.companyLogo = ''">×</el-button>
              </div>
            </el-form-item>

            <el-form-item label="电子签章">
              <div style="display:flex;align-items:center;gap:12px">
                <el-upload
                  :auto-upload="false"
                  :limit="1"
                  accept="image/png"
                  :show-file-list="false"
                  :on-change="onSealChange"
                >
                  <el-button>选择图片</el-button>
                </el-upload>
                <span style="font-size:12px;color:#909399">建议 200×200px，透明PNG</span>
              </div>
              <div v-if="form.companySeal" style="margin-top:8px;position:relative;display:inline-block">
                <img :src="form.companySeal" style="max-width:200px;max-height:200px;border:1px solid #eee;border-radius:4px;background:#f5f5f5" />
                <el-button size="small" type="danger" circle style="position:absolute;top:-8px;right:-8px" @click="form.companySeal = ''">×</el-button>
              </div>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="handleSave" :loading="saving">保存设置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card header="打印预览">
          <div class="preview-section">
            <h4 style="margin:0 0 8px;color:#606266">合同抬头预览</h4>
            <div class="preview-box contract-preview">
              <div v-if="form.companyLogo" style="margin-bottom:4px">
                <img :src="form.companyLogo" style="max-width:160px;max-height:48px" />
              </div>
              <div style="font-size:16px;font-weight:bold;color:#0A3D62;letter-spacing:3px">物业租赁合同</div>
              <div style="font-size:11px;color:#999;margin-top:2px">合同编号：CT-2024-001</div>
              <div style="font-size:12px;color:#333;margin-top:8px">
                <p style="margin:2px 0">出租方（甲方）：{{ form.companyName || '物业租赁管理公司' }}</p>
                <p style="margin:2px 0">承租方（乙方）：张伟</p>
              </div>
            </div>
          </div>

          <div class="preview-section" style="margin-top:16px">
            <h4 style="margin:0 0 8px;color:#606266">签章预览</h4>
            <div class="preview-box seal-preview" style="display:flex;justify-content:space-around;text-align:center">
              <div>
                <p style="font-size:12px;color:#666;margin:0 0 8px">甲方（出租方）</p>
                <div v-if="form.companySeal" style="width:100px;height:100px;display:flex;align-items:center;justify-content:center;margin:0 auto">
                  <img :src="form.companySeal" style="max-width:100px;max-height:100px" />
                </div>
                <p v-else style="font-size:12px;color:#999">_______________</p>
                <p style="font-size:11px;color:#999">日期：____年____月____日</p>
              </div>
              <div>
                <p style="font-size:12px;color:#666;margin:0 0 8px">乙方（承租方）</p>
                <p style="font-size:12px;color:#999;margin-top:20px">_______________</p>
                <p style="font-size:11px;color:#999">日期：____年____月____日</p>
              </div>
            </div>
          </div>

          <div class="preview-section" style="margin-top:16px">
            <h4 style="margin:0 0 8px;color:#606266">收据预览</h4>
            <div class="preview-box receipt-preview" style="width:220px;margin:0 auto;font-size:10px;line-height:1.6;border:1px dashed #ccc;padding:12px">
              <div style="text-align:center">
                <div style="font-size:13px;font-weight:bold">{{ form.companyName || '物业租赁管理公司' }}</div>
                <div style="font-size:11px;color:#0A3D62">收款凭证</div>
              </div>
              <div style="margin:8px 0;padding:4px 0;border-top:1px dashed #999;border-bottom:1px dashed #999;font-size:9px">
                <div>收据号：REC-001</div><div>日期：2026-05-16</div>
              </div>
              <div style="text-align:center;margin:8px 0">
                <div style="font-size:9px;color:#999">收款金额</div>
                <div style="font-size:18px;font-weight:bold;color:#E6A23C">¥2,500.00</div>
              </div>
              <div style="text-align:center;margin-top:12px">
                <div v-if="form.companySeal" style="width:50px;height:50px;margin:0 auto">
                  <img :src="form.companySeal" style="max-width:50px;max-height:50px" />
                </div>
                <div v-else style="font-size:9px;color:#999">收款人：_______</div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import request from '@/api/request';

const saving = ref(false);

const form = reactive({
  companyName: '物业租赁管理公司',
  companyLogo: '',
  companySeal: '',
});

onMounted(async () => {
  try {
    const res = await request.get('/system-configs/keys', {
      params: { keys: 'company_name_for_print,company_logo,company_seal' },
    });
    const map: Record<string, string> = {};
    (res.data || []).forEach((c: any) => { map[c.configKey] = c.configValue; });
    if (map['company_name_for_print']) form.companyName = map['company_name_for_print'];
    if (map['company_logo']) form.companyLogo = map['company_logo'];
    if (map['company_seal']) form.companySeal = map['company_seal'];
  } catch { /* use defaults */ }
});

function onLogoChange(file: any) {
  const reader = new FileReader();
  reader.onload = (e) => { form.companyLogo = e.target?.result as string; };
  reader.readAsDataURL(file.raw);
}

function onSealChange(file: any) {
  const reader = new FileReader();
  reader.onload = (e) => { form.companySeal = e.target?.result as string; };
  reader.readAsDataURL(file.raw);
}

async function handleSave() {
  saving.value = true;
  try {
    await request.put('/system-configs/company_name_for_print', { configValue: form.companyName });
    await request.put('/system-configs/company_logo', { configValue: form.companyLogo });
    await request.put('/system-configs/company_seal', { configValue: form.companySeal });
    ElMessage.success('打印设置已保存');
  } catch { /* ignore */ }
  finally { saving.value = false; }
}
</script>

<style lang="scss" scoped>
.print-settings {
  .preview-section {
    h4 { font-size: 13px; }
  }
  .preview-box {
    background: #fff; border: 1px solid #e8e8e8; border-radius: 6px;
    padding: 16px;
  }
  .receipt-preview { box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
}
</style>
