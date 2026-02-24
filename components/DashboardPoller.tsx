'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Client-side polling: revalidates the server component page periodically
 * so the dashboard stays fresh without manual refresh.
 */
export function DashboardPoller() {
  const router = useRouter();

  useEffect(() => {
    // Refresh the page data every 90 seconds
    const interval = setInterval(() => {
      router.refresh();
    }, 90_000);

    return () => clearInterval(interval);
  }, [router]);

  return null;
}
