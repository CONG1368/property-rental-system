/** 角色默认头像配置 */
export const roleAvatars: Record<string, { icon: string; color: string; bg: string }> = {
  '管理员':   { icon: '👑', color: '#fff', bg: 'linear-gradient(135deg, #e74c3c, #c0392b)' },
  '总经理':   { icon: '🏢', color: '#fff', bg: 'linear-gradient(135deg, #2c3e50, #34495e)' },
  '收租主管': { icon: '💰', color: '#fff', bg: 'linear-gradient(135deg, #e67e22, #d35400)' },
  '收租员':   { icon: '📋', color: '#fff', bg: 'linear-gradient(135deg, #f39c12, #e67e22)' },
  '财务主管': { icon: '📊', color: '#fff', bg: 'linear-gradient(135deg, #2980b9, #2471a3)' },
  '会计':     { icon: '🧮', color: '#fff', bg: 'linear-gradient(135deg, #16a085, #1abc9c)' },
  '出纳':     { icon: '💵', color: '#fff', bg: 'linear-gradient(135deg, #27ae60, #2ecc71)' },
  '合同主管': { icon: '📝', color: '#fff', bg: 'linear-gradient(135deg, #8e44ad, #7d3c98)' },
  '法务':     { icon: '⚖️', color: '#fff', bg: 'linear-gradient(135deg, #6c5ce7, #5b2c6f)' },
};

/** 用户可选的自定义头像列表 */
export const presetAvatars = [
  { icon: '👤', label: '默认' }, { icon: '👑', label: '皇冠' }, { icon: '🏢', label: '大楼' },
  { icon: '💰', label: '财富' }, { icon: '📊', label: '图表' }, { icon: '📝', label: '合同' },
  { icon: '⚖️', label: '法务' }, { icon: '🧮', label: '计算' }, { icon: '💵', label: '现金' },
  { icon: '🏠', label: '房屋' }, { icon: '🔑', label: '钥匙' }, { icon: '📋', label: '清单' },
  { icon: '📎', label: '回形针' }, { icon: '🌟', label: '星星' }, { icon: '💼', label: '公文包' },
  { icon: '🎯', label: '目标' }, { icon: '🔔', label: '通知' }, { icon: '📌', label: '图钉' },
  { icon: '🛡️', label: '盾牌' }, { icon: '🏆', label: '奖杯' },
];

/** 根据角色获取头像配置 */
export function getRoleAvatar(role: string) {
  return roleAvatars[role] || { icon: '👤', color: '#fff', bg: '#95a5a6' };
}
