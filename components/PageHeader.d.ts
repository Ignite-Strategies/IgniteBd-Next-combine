import { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string | null;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode | null;
}

declare const PageHeader: (props: PageHeaderProps) => JSX.Element;

export default PageHeader;

