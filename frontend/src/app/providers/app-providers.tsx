import { StrictMode } from "react";
import { BrowserRouter } from "react-router";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { theme } from "@/shared/config";
import { QueryProvider } from "./query-provider";
import { setAuthTokenGetter } from "@/shared/api";
import { useUser } from "@/features/auth";


setAuthTokenGetter(() => useUser.getState().token);

export function AppProviders({ children }: { children: React.ReactNode }) {

  return (
    <StrictMode>
      <QueryProvider>
        <BrowserRouter>
          <MantineProvider theme={theme}>
            <ModalsProvider>
              <Notifications
                position="bottom-right"
                autoClose={4000}
                zIndex={9999}
                limit={5}
                containerWidth={400}
              />
              {children}
            </ModalsProvider>
          </MantineProvider>
        </BrowserRouter>
      </QueryProvider>
    </StrictMode>
  );
}
