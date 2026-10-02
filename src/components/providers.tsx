import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            className: "bb-shadow !bg-elev !text-ink !border-line",
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
