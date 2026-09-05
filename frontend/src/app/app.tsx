import { Suspense } from "react";
import { Routes, useMatch } from "react-router";
import { AppRoutes } from "./router/routes";
import { ScrollManager } from "./router/scroll-manager";
import { ErrorBoundary, RouteSkeleton } from "@/shared/ui";
import { BusinessRuntime } from "./business-runtime";

export function App() {
  const isDocsRoute = useMatch("/docs/*") !== null;

  return (
    <ErrorBoundary>
      <ScrollManager />
      {!isDocsRoute && <BusinessRuntime />}
      <Suspense fallback={<RouteSkeleton />}>
        <Routes>{AppRoutes()}</Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
