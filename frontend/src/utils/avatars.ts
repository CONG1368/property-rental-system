import { tokens } from '@/styles/tokens';
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
  '管理员':   { icon: 'crown',    color: tokens.n0, bg: 'linear-gradient(135deg, ' + tokens.brand600 + ', ' + tokens.brand700 + ')' },
  '总经理':   { icon: 'building', color: tokens.n0, bg: 'linear-gradient(135deg, ' + tokens.n900 + ', ' + tokens.n700 + ')' },
  '收租主管': { icon: 'money',    color: tokens.n0, bg: 'linear-gradient(135deg, ' + tokens.brand600 + ', ' + tokens.brand700 + ')' },
  '收租员':   { icon: 'list',     color: tokens.n0, bg: 'linear-gradient(135deg, ' + tokens.brand300 + ', ' + tokens.brand600 + ')' },
  '财务主管': { icon: 'chart',    color: tokens.n0, bg: 'linear-gradient(135deg, ' + tokens.brand700 + ', ' + tokens.brand700 + ')' },
  '会计':     { icon: 'calc',     color: tokens.n0, bg: 'linear-gradient(135deg, ' + tokens.n600 + ', ' + tokens.n700 + ')' },
  '出纳':     { icon: 'cash',     color: tokens.n0, bg: 'linear-gradient(135deg, ' + tokens.ok600 + ', ' + tokens.ok600 + ')' },
  '合同主管': { icon: 'contract', color: tokens.n0, bg: 'linear-gradient(135deg, ' + tokens.brand600 + ', ' + tokens.brand700 + ')' },
  '法务':     { icon: 'law',      color: tokens.n0, bg: 'linear-gradient(135deg, ' + tokens.n700 + ', ' + tokens.n900 + ')' },
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
  return roleAvatars[role] || { icon: 'user', color: tokens.n0, bg: 'linear-gradient(135deg, ' + tokens.n600 + ', ' + tokens.n600 + ')' };
}

/** 图标键名（或历史 emoji）→ 图标组件，未知回退默认头像图标 */
export function resolveAvatarIcon(key?: string): Component {
  if (!key) return avatarIcons.user;
  const normalized = legacyEmojiMap[key] || key;
  return avatarIcons[normalized] || avatarIcons.user;
}
