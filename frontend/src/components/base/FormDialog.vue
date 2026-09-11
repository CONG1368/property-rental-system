<template>
  <el-dialog :title="title" :model-value="modelValue" :width="width" :close-on-click-modal="false"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)">
    <el-form ref="formRef" :model="model" :rules="mergedRules" :label-width="labelWidth">
      <slot name="prepend" />
      <el-form-item v-for="f in fields" :key="f.key" :label="f.label" :prop="f.key">
        <slot :name="f.key" :field="f" :model="model">
          <el-input v-if="!f.type || f.type === 'text'" v-model="model[f.key]" :placeholder="f.placeholder"
            :type="f.rows ? 'textarea' : 'text'" :rows="f.rows" clearable />
          <el-select v-else-if="f.type === 'select'" v-model="model[f.key]" :multiple="f.multiple"
            :placeholder="f.placeholder" clearable style="width:100%">
            <el-option v-for="o in (f.options || [])" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <el-input-number v-else-if="f.type === 'number'" v-model="model[f.key]" :min="f.min ?? 0"
            :precision="f.precision ?? 2" style="width:100%" />
          <el-date-picker v-else-if="f.type === 'date'" v-model="model[f.key]" type="date" value-format="YYYY-MM-DD" style="width:100%" />
          <el-date-picker v-else-if="f.type === 'month'" v-model="model[f.key]" type="month" value-format="YYYY-MM" style="width:100%" />
          <el-switch v-else-if="f.type === 'switch'" v-model="model[f.key]" />
        </slot>
      </el-form-item>
      <slot />
    </el-form>
    <template #footer>
      <slot name="footer">
        <el-button @click="emit('update:modelValue', false)">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmit">{{ submitText }}</el-button>
      </slot>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
// 新建/编辑弹窗统一壳：字段配置驱动 + 校验 + 提交态。
// 复杂字段用与 field.key 同名的插槽覆盖渲染。
import { computed, ref } from 'vue';
import type { FormField } from './types';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  title: string;
  /** 表单数据对象（就地修改） */
  model: Record<string, any>;
  fields?: FormField[];
  rules?: Record<string, any[]>;
  width?: string;
  labelWidth?: string;
  submitText?: string;
  submitting?: boolean;
}>(), { fields: () => [], rules: () => ({}), width: '560px', labelWidth: '100px', submitText: '确定', submitting: false });

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit'): void;
}>();

const formRef = ref();
// fields[].required 自动生成必填规则；显式 rules 优先级更高
const mergedRules = computed(() => {
  const out: Record<string, any[]> = { ...props.rules };
  for (const f of props.fields || []) {
    if (f.required && !out[f.key]) {
      out[f.key] = [{ required: true, message: '请' + (f.type === 'select' || f.type === 'date' || f.type === 'month' ? '选择' : '输入') + f.label, trigger: f.type === 'select' ? 'change' : 'blur' }];
    }
  }
  return out;
});
async function onSubmit() {
  const ok = await formRef.value?.validate().catch(() => false);
  if (ok === false) return;
  emit('submit');
}
defineExpose({ formRef });
</script>
