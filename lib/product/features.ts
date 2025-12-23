/**
 * Feature Registry
 * 
 * Single source of truth for all product features.
 * Each feature maps to a route and belongs to a layer.
 * 
 * This is a pure data structure - no logic here.
 */

import { ProductLayer } from './layers';
import {
  TrendingUp,
  Users,
  MessageSquare,
  FileText,
  Map,
  Settings,
  UserCircle,
  FileCheck,
  Brain,
  Package,
  BarChart,
  Calendar,
  List,
  GitBranch,
  Building2,
  Box,
  Layers,
  Receipt,
  PlayCircle,
  Rocket,
  Network,
  LucideIcon,
} from 'lucide-react';

export type FeatureKey =
  | 'dashboard'
  | 'crm'
  | 'contacts'
  | 'people'
  | 'personas'
  | 'products'
  | 'content'
  | 'bd-intelligence'
  | 'ecosystem'
  | 'pipelines'
  | 'companies'
  | 'events'
  | 'ads'
  | 'outreach'
  | 'client-operations'
  | 'settings';

export interface FeatureDefinition {
  key: FeatureKey;
  label: string;
  route: string;
  layer: ProductLayer;
  icon: LucideIcon;
  group?: string; // Optional grouping for sidebar organization
}

export const FEATURE_REGISTRY: FeatureDefinition[] = [
  // Core Layer - Foundation features
  {
    key: 'dashboard',
    label: 'Growth Dashboard',
    route: '/growth-dashboard',
    layer: 'core',
    icon: TrendingUp,
  },
  {
    key: 'crm',
    label: 'CRM Dashboard',
    route: '/crmdashboard',
    layer: 'core',
    icon: Users,
  },
  {
    key: 'people',
    label: 'People',
    route: '/people',
    layer: 'core',
    icon: Users,
    group: 'Engage',
  },
  {
    key: 'contacts',
    label: 'Contacts',
    route: '/contacts',
    layer: 'core',
    icon: Users,
  },
  {
    key: 'personas',
    label: 'Personas',
    route: '/personas',
    layer: 'core',
    icon: UserCircle,
    group: 'Growth Ops',
  },
  {
    key: 'products',
    label: 'Products',
    route: '/products',
    layer: 'core',
    icon: Package,
    group: 'Growth Ops',
  },
  {
    key: 'content',
    label: 'Content',
    route: '/content',
    layer: 'core',
    icon: FileText,
    group: 'Attract',
  },
  {
    key: 'bd-intelligence',
    label: 'BD Intelligence',
    route: '/bd-intelligence',
    layer: 'core',
    icon: Brain,
    group: 'Growth Ops',
  },
  {
    key: 'ecosystem',
    label: 'Ecosystem Intelligence',
    route: '/ecosystem/associations',
    layer: 'core',
    icon: Network,
    group: 'Growth Ops',
  },
  {
    key: 'pipelines',
    label: 'Pipeline',
    route: '/pipelines',
    layer: 'core',
    icon: GitBranch,
    group: 'Engage',
  },
  {
    key: 'companies',
    label: 'Company Hub',
    route: '/companies',
    layer: 'core',
    icon: Building2,
    group: 'Engage',
  },
  {
    key: 'settings',
    label: 'Settings',
    route: '/settings',
    layer: 'core',
    icon: Settings,
  },

  // Attract Layer - Signal generation
  {
    key: 'events',
    label: 'Events',
    route: '/events',
    layer: 'attract',
    icon: Calendar,
    group: 'Attract',
  },
  {
    key: 'ads',
    label: 'Ads & SEO',
    route: '/ads',
    layer: 'attract',
    icon: BarChart,
    group: 'Attract',
  },

  // Activate Layer - Execution/scale (future)
  {
    key: 'outreach',
    label: 'Outreach',
    route: '/outreach',
    layer: 'activate',
    icon: MessageSquare,
    group: 'Engage',
  },
  {
    key: 'client-operations',
    label: 'Client Operations',
    route: '/client-operations',
    layer: 'activate',
    icon: Rocket,
  },
];

