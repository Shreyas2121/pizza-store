import { StrictMode } from "react";
import { BrowserRouter } from "react-router";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { theme } from "@/shared/config";
import { queryClient, QueryProvider } from "./query-provider";
import { setAuthTokenGetter, setForbiddenHandler, setUnauthorizedHandler } from "@/shared/api";
import { useUser } from "@/features/auth";
import { accessKeys } from "@/features/access";

setAuthTokenGetter(() => useUser.getState().token);
setUnauthorizedHandler(() => useUser.getState().logout());
setForbiddenHandler(() => queryClient.invalidateQueries({ queryKey: accessKeys.all }));

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
