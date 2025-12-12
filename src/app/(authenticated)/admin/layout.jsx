/**
 * Admin Layout
 * 
 * All routes under /admin require SuperAdmin status
 * Protection is handled client-side in each page component
 * and server-side in API routes
 */
export default function AdminLayout({ children }) {
  return <>{children}</>;
}

