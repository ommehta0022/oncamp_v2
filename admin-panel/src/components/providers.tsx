"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "sonner";
import { useState } from "react";
import { PlatformSettingsProvider } from "@/contexts/PlatformSettingsContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache data for 30 seconds before considering it stale
            staleTime: 30 * 1000,
            // Keep unused data in cache for 5 minutes
            gcTime: 5 * 60 * 1000,
            // Retry failed requests 1 time
            retry: 1,
            // Don't refetch on window focus (can be annoying)
            refetchOnWindowFocus: false,
            // Don't refetch on reconnect automatically
            refetchOnReconnect: false,
            // Refetch stale data in background
            refetchOnMount: true,
          },
          mutations: {
            // Retry mutations once on failure
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PlatformSettingsProvider>
        {children}
        <Toaster position="top-right" richColors />
        {/* React Query Devtools - only in development */}
        {process.env.NODE_ENV === "development" && (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
        )}
      </PlatformSettingsProvider>
    </QueryClientProvider>
  );
}

