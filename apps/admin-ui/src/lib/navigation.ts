export interface AdminNavItem {
  href: string;
  label: string;
  subtitle: string;
}

export interface AdminNavGroup {
  group: string;
  items: AdminNavItem[];
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    group: '总览',
    items: [
      { href: '/overview', label: '系统总览', subtitle: 'Overview' },
      { href: '/activity', label: '活动记录', subtitle: 'Activity' }
    ]
  },
  {
    group: '运行控制',
    items: [{ href: '/services', label: '服务控制', subtitle: 'Services' }]
  },
  {
    group: '模型管理',
    items: [
      { href: '/models/providers', label: 'Provider 管理', subtitle: 'Providers' },
      { href: '/models/bindings', label: '模型绑定', subtitle: 'Bindings' }
    ]
  },
  {
    group: 'Agent 管理',
    items: [
      { href: '/agents', label: 'Agent 列表', subtitle: 'Agents' },
      { href: '/agents/discovery', label: '自动扫描', subtitle: 'Discovery' },
      { href: '/agents/create', label: '批量创建', subtitle: 'Batch Create' }
    ]
  },
  {
    group: '告警与通知',
    items: [{ href: '/alerts/feishu', label: '飞书告警', subtitle: 'Feishu Alerts' }]
  },
  {
    group: '系统',
    items: [
      { href: '/capabilities', label: '宿主机能力', subtitle: 'Host Capabilities' },
      { href: '/settings', label: '系统设置', subtitle: 'Settings' }
    ]
  }
];

export function findNavItem(currentPath: string) {
  for (const group of adminNavGroups) {
    for (const item of group.items) {
      if (currentPath === item.href || currentPath.startsWith(`${item.href}/`)) {
        return item;
      }
    }
  }

  return undefined;
}
