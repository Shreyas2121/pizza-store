import { StrictMode } from "react";
import { BrowserRouter } from "react-router";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { theme } from "@/shared/config";
import { QueryProvider } from "./query-provider";
import React from "react";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <StrictMode>
      <QueryProvider>
        <BrowserRouter>
          <MantineProvider theme={theme}>
            <ModalsProvider>
              <Notifications position="top-right" autoClose={4000} />
              {children}
            </ModalsProvider>
          </MantineProvider>
        </BrowserRouter>
      </QueryProvider>
    </StrictMode>
  );
}
