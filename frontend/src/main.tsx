import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { myColor } from "./lib/constants.ts";
import {
  QueryClient,
  MutationCache,
  QueryClientProvider,
} from "@tanstack/react-query";

import { createTheme, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { error } from "./lib/utils.ts";
import { BrowserRouter } from "react-router";

const theme = createTheme({
  colors: {
    myColor,
  },
  primaryColor: "myColor",
  components: {
    Button: {
      defaultProps: {
        color: "myColor",
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
      error(err.response.data.message);
    },
  }),
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <MantineProvider theme={theme}>
          <Notifications position="top-right" autoClose={1000} />
          <App />
        </MantineProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
