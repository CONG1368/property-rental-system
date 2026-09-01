/**
 * 角色头像配置 — ANTI-EMOJI：统一使用 Element Plus 线性图标，禁用 emoji
 * icon 字段为图标键名（见 avatarIcons），渲染时用 resolveAvatarIcon() 取组件
 */
import type { Component } from 'vue';
import {
  Avatar, Trophy, OfficeBuilding, Money, Tickets, DataAnalysis, Histogram,
  Coin, Document, Stamp, House, Key, Notebook, Paperclip, Star, Suitcase,
  Aim, Bell, Location, Medal, Lock, Wallet,
} from '@element-plus/icons-vue';

/** 图标键名 → Element Plus 图标组件 */
export const avatarIcons: Record<string, Component> = {
  user: Avatar, crown: Trophy, building: OfficeBuilding, money: Money,
  chart: DataAnalysis, contract: Document, law: Stamp, calc: Histogram,
  cash: Coin, house: House, key: Key, list: Tickets, clip: Paperclip,
  star: Star, briefcase: Suitcase, target: Aim, bell: Bell, pin: Location,
  shield: Lock, trophy: Medal, note: Notebook, wallet: Wallet,
};

/** 历史数据兼容：DB 中已存的 emoji → 新图标键名 */
const legacyEmojiMap: Record<string, string> = {
  '👤': 'user', '👑': 'crown', '🏢': 'building', '💰': 'money', '📊': 'chart',
  '📝': 'contract', '⚖️': 'law', '⚖': 'law', '🧮': 'calc', '💵': 'cash',
  '🏠': 'house', '🔑': 'key', '📋': 'list', '📎': 'clip', '🌟': 'star',
  '💼': 'briefcase', '🎯': 'target', '🔔': 'bell', '📌': 'pin',
  '🛡️': 'shield', '🛡': 'shield', '🏆': 'trophy',
};

/** 角色默认头像配置（湛蓝主题：同色系深浅 + 中性灰，最多 1 强调色） */
export const roleAvatars: Record<string, { icon: string; color: string; bg: string }> = {
  '管理员':   { icon: 'crown',    color: '#fff', bg: 'linear-gradient(135deg, #4f7cf7, #3b66e0)' },
  '总经理':   { icon: 'building', color: '#fff', bg: 'linear-gradient(135deg, #1f2430, #3a4354)' },
  '收租主管': { icon: 'money',    color: '#fff', bg: 'linear-gradient(135deg, #5b8bf8, #3b66e0)' },
  '收租员':   { icon: 'list',     color: '#fff', bg: 'linear-gradient(135deg, #7ba0f9, #4f7cf7)' },
  '财务主管': { icon: 'chart',    color: '#fff', bg: 'linear-gradient(135deg, #3b66e0, #2b4fbf)' },
  '会计':     { icon: 'calc',     color: '#fff', bg: 'linear-gradient(135deg, #5b6472, #3a4354)' },
  '出纳':     { icon: 'cash',     color: '#fff', bg: 'linear-gradient(135deg, #10b981, #059669)' },
  '合同主管': { icon: 'contract', color: '#fff', bg: 'linear-gradient(135deg, #4f7cf7, #2b4fbf)' },
  '法务':     { icon: 'law',      color: '#fff', bg: 'linear-gradient(135deg, #3a4354, #1f2430)' },
};

/** 用户可选的自定义头像列表 */
export const presetAvatars = [
  { icon: 'user', label: '默认' }, { icon: 'crown', label: '皇冠' }, { icon: 'building', label: '大楼' },
  { icon: 'money', label: '财富' }, { icon: 'chart', label: '图表' }, { icon: 'contract', label: '合同' },
  { icon: 'law', label: '法务' }, { icon: 'calc', label: '计算' }, { icon: 'cash', label: '现金' },
  { icon: 'house', label: '房屋' }, { icon: 'key', label: '钥匙' }, { icon: 'list', label: '清单' },
  { icon: 'clip', label: '回形针' }, { icon: 'star', label: '星标' }, { icon: 'briefcase', label: '公文包' },
  { icon: 'target', label: '目标' }, { icon: 'bell', label: '通知' }, { icon: 'pin', label: '图钉' },
  { icon: 'shield', label: '安全' }, { icon: 'trophy', label: '奖章' },
];

/** 根据角色获取头像配置 */
export function getRoleAvatar(role: string) {
  return roleAvatars[role] || { icon: 'user', color: '#fff', bg: 'linear-gradient(135deg, #5f6675, #5b6472)' };
}

/** 图标键名（或历史 emoji）→ 图标组件，未知回退默认头像图标 */
export function resolveAvatarIcon(key?: string): Component {
  if (!key) return avatarIcons.user;
  const normalized = legacyEmojiMap[key] || key;
  return avatarIcons[normalized] || avatarIcons.user;
}
