import { QueryClient, MutationCache, QueryClientProvider } from "@tanstack/react-query";
import { error } from "@/shared/lib";
import React from "react";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
  mutationCache: new MutationCache({
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      const msg =
        errorObj?.response?.data?.message ||
        errorObj?.message ||
        "An unexpected error occurred";
      error(msg);
    },
  }),

});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
