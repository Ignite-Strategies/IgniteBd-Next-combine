'use client';

/**
 * People routes are just pages under /people — no separate context or data layer.
 * Contact data and context live under the contacts layout (/contacts/*).
 */
export default function PeopleLayout({ children }) {
  return <>{children}</>;
}
