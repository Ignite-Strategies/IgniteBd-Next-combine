import { Suspense } from 'react';
import Navigation from '@/components/Navigation';
import Sidebar from '@/components/Sidebar';
import { CompanyHQContextHeader } from '@/components/CompanyHQContextHeader';

export default function AuthenticatedLayout({ children }) {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Top nav bar */}
      <Navigation />

      {/* Company context bar — sits cleanly below nav, above sidebar+content */}
      <CompanyHQContextHeader />

      {/* Sidebar + page content side by side, filling remaining height */}
      <div className="flex flex-1 overflow-hidden">
        <Suspense fallback={<div className="w-64 flex-shrink-0 bg-white border-r border-gray-200" />}>
          <Sidebar />
        </Suspense>

        <main className="flex-1 overflow-y-auto min-h-0 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
