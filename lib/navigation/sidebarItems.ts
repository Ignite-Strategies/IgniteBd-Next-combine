/**
 * Sidebar Navigation Items Registry
 * 
 * Defines sidebar items with minimum tier requirements.
 * Sidebar existence is still pathname-driven (AppShell).
 * Sidebar contents are tier-driven (this file).
 */

import {
  TrendingUp,
  Users,
  UserCircle,
  Package,
  FileText,
  GitBranch,
  Building2,
  Brain,
  Settings,
  Calendar,
  BarChart,
  MessageSquare,
  Rocket,
  LucideIcon,
} from 'lucide-react';

export type ProductTier = 'foundation' | 'growth' | 'scale';

export type SidebarItem = {
  key: string;
  label: string;
  href: string;
  minTier: ProductTier;
  icon: LucideIcon;
  group?: string; // Optional grouping for sidebar organization
};

export const SIDEBAR_ITEMS: SidebarItem[] = [
  // Foundation tier - Core features
  { key: 'dashboard', label: 'Growth Dashboard', href: '/growth-dashboard', minTier: 'foundation', icon: TrendingUp },
  { key: 'crm', label: 'CRM Dashboard', href: '/crmdashboard', minTier: 'foundation', icon: Users },
  { key: 'contacts', label: 'Contacts', href: '/contacts', minTier: 'foundation', icon: Users, group: 'Engage' },
  { key: 'people', label: 'People', href: '/people', minTier: 'foundation', icon: Users, group: 'Engage' },
  { key: 'personas', label: 'Personas', href: '/personas', minTier: 'foundation', icon: UserCircle, group: 'Growth Ops' },
  { key: 'products', label: 'Products', href: '/products', minTier: 'foundation', icon: Package, group: 'Growth Ops' },
  { key: 'content', label: 'Content', href: '/content', minTier: 'foundation', icon: FileText, group: 'Attract' },
  { key: 'pipelines', label: 'Pipeline', href: '/pipelines', minTier: 'foundation', icon: GitBranch, group: 'Engage' },
  { key: 'companies', label: 'Company Hub', href: '/companies', minTier: 'foundation', icon: Building2, group: 'Engage' },
  { key: 'bd-intelligence', label: 'BD Intelligence', href: '/bd-intelligence', minTier: 'foundation', icon: Brain, group: 'Growth Ops' },
  { key: 'settings', label: 'Settings', href: '/settings', minTier: 'foundation', icon: Settings },

  // Growth tier - Attract layer
  { key: 'events', label: 'Events', href: '/events', minTier: 'growth', icon: Calendar, group: 'Attract' },
  { key: 'ads', label: 'Ads & SEO', href: '/ads', minTier: 'growth', icon: BarChart, group: 'Attract' },

  // Scale tier - Activate layer
  { key: 'outreach', label: 'Outreach', href: '/outreach', minTier: 'scale', icon: MessageSquare, group: 'Engage' },
  { key: 'client-ops', label: 'Client Operations', href: '/client-operations', minTier: 'scale', icon: Rocket, group: 'Client Operations' },
];

