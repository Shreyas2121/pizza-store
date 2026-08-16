import { createRoot } from "react-dom/client";
import "./index.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { App, AppProviders } from "@/app/index";


createRoot(document.getElementById("root")!).render(
  <AppProviders>
    <App />
  </AppProviders>
);
