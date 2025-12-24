/**
 * MVP1 SIDEBAR
 * Lowest Common Denominator navigation.
 * Intentional omission of Growth / Advanced features.
 * Do not extend without a product decision.
 */

import {
  TrendingUp,
  Users,
  FileText,
  LucideIcon,
} from 'lucide-react';

export type SidebarItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

export const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: '/growth-dashboard',
    icon: TrendingUp,
  },
  {
    key: 'crm',
    label: 'CRM',
    href: '/crmdashboard',
    icon: Users,
  },
  {
    key: 'contacts',
    label: 'Contacts',
    href: '/contacts',
    icon: Users,
  },
  {
    key: 'content',
    label: 'Content',
    href: '/content',
    icon: FileText,
  },
];
