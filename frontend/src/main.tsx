import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { brandColor, basilColor, myColor } from "@/shared/config";
import {
  QueryClient,
  MutationCache,
  QueryClientProvider,
} from "@tanstack/react-query";

import { createTheme, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ModalsProvider } from "@mantine/modals";
import { error } from "@/shared/lib";
import { BrowserRouter } from "react-router";

const theme = createTheme({
  colors: {
    brand: brandColor,
    basil: basilColor,
    myColor,
  },
  primaryColor: "brand",
  fontFamily: "Inter, sans-serif",
  headings: {
    fontFamily: "Inter, sans-serif",
  },
  components: {
    Button: {
      defaultProps: {
        color: "brand",
        radius: "md",
      },
    },
    ActionIcon: {
      defaultProps: {
        color: "brand",
        radius: "md",
        size: "lg",
      },
    },
    Card: {
      defaultProps: {
        radius: "lg",
        withBorder: true,
      },
    },
    Paper: {
      defaultProps: {
        radius: "lg",
        withBorder: true,
      },
    },
    TextInput: {
      defaultProps: {
        radius: "md",
        size: "md",
      },
      styles: {
        label: { fontWeight: 500, color: "#201A17", marginBottom: "4px" },
        input: { backgroundColor: "#FFFDF8", borderColor: "#E5DACE", color: "#201A17", minHeight: "44px" },
      },
    },
    PasswordInput: {
      defaultProps: {
        radius: "md",
        size: "md",
      },
      styles: {
        label: { fontWeight: 500, color: "#201A17", marginBottom: "4px" },
        input: { backgroundColor: "#FFFDF8", borderColor: "#E5DACE", color: "#201A17", minHeight: "44px" },
        innerInput: { height: "42px" },
      },
    },
    NumberInput: {
      defaultProps: {
        radius: "md",
        size: "md",
      },
      styles: {
        label: { fontWeight: 500, color: "#201A17", marginBottom: "4px" },
        input: { backgroundColor: "#FFFDF8", borderColor: "#E5DACE", color: "#201A17", minHeight: "44px" },
      },
    },
    Textarea: {
      defaultProps: {
        radius: "md",
      },
      styles: {
        label: { fontWeight: 500, color: "#201A17", marginBottom: "4px" },
        input: { backgroundColor: "#FFFDF8", borderColor: "#E5DACE", color: "#201A17" },
      },
    },
    Select: {
      defaultProps: {
        radius: "md",
        size: "md",
      },
      styles: {
        label: { fontWeight: 500, color: "#201A17", marginBottom: "4px" },
        input: { backgroundColor: "#FFFDF8", borderColor: "#E5DACE", color: "#201A17", minHeight: "44px" },
      },
    },
    MultiSelect: {
      defaultProps: {
        radius: "md",
        size: "md",
      },
      styles: {
        label: { fontWeight: 500, color: "#201A17", marginBottom: "4px" },
        input: { backgroundColor: "#FFFDF8", borderColor: "#E5DACE", color: "#201A17", minHeight: "44px" },
      },
    },
    Badge: {
      defaultProps: {
        radius: "xl",
      },
    },
    Modal: {
      defaultProps: {
        radius: "lg",
        centered: true,
      },
    },
    Drawer: {
      defaultProps: {
        radius: "lg",
      },
    },
    Table: {
      defaultProps: {
        highlightOnHover: true,
        verticalSpacing: "sm",
        horizontalSpacing: "md",
      },
    },
    Pagination: {
      defaultProps: {
        color: "brand",
        radius: "md",
      },
    },
    Tooltip: {
      defaultProps: {
        withArrow: true,
        radius: "md",
      },
    },
    Skeleton: {
      defaultProps: {
        radius: "md",
      },
    },
    Notification: {
      defaultProps: {
        radius: "md",
      },
    },
  },
});

export const client = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },

  mutationCache: new MutationCache({
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "An unexpected error occurred";
      error(msg);
    },
  }),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <MantineProvider theme={theme}>
          <ModalsProvider>
            <Notifications position="top-right" autoClose={4000} />
            <App />
          </ModalsProvider>
        </MantineProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
