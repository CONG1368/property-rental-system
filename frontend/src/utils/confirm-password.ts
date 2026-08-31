import { ElMessageBox } from 'element-plus';

// 不可逆操作二次确认：弹出密码输入框，要求操作者输入本人登录密码
// 返回密码字符串；用户取消则返回 null
export async function confirmWithPassword(message: string, title = '二次确认'): Promise<string | null> {
  try {
    const { value } = await ElMessageBox.prompt(message, title, {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      inputType: 'password',
      inputPlaceholder: '请输入当前登录密码',
      inputValidator: (val: string) => (val && val.trim() ? true : '请输入密码'),
      type: 'warning',
    });
    return value || null;
  } catch {
    return null;
  }
}
