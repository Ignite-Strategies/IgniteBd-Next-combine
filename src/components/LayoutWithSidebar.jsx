'use client';

import Sidebar from './Sidebar';

export default function LayoutWithSidebar({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}

