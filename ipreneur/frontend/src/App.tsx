import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "react-hot-toast";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageLoader } from "@/components/shared/PageLoader";
import { useAuthStore } from "@/stores/authStore";

// ── Lazy-loaded pages (code splitting per route) ──────────────────────────────
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage"));
const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage"));
const NewProjectPage = lazy(() => import("@/pages/workspace/NewProjectPage"));
const WorkspacePage = lazy(() => import("@/pages/workspace/WorkspacePage"));
const EditorPage = lazy(() => import("@/pages/editor/EditorPage"));
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage"));
const BillingPage = lazy(() => import("@/pages/billing/BillingPage"));

// ── React Query client ────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 401) return false;
        if (error?.response?.status === 404) return false;
        return failureCount < 2;
      },
    },
  },
});

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected — wrapped in AuthGuard + DashboardLayout */}
            <Route element={<AuthGuard />}>
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/projects/new" element={<NewProjectPage />} />
                <Route path="/projects/:projectId" element={<WorkspacePage />} />
                <Route path="/projects/:projectId/editor" element={<EditorPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/billing" element={<BillingPage />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>

      {/* Global toast notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#1A1130",
            color: "#F5F3FF",
            border: "1px solid #2A1F45",
            borderRadius: "12px",
            fontSize: "14px",
          },
          success: {
            iconTheme: { primary: "#22C55E", secondary: "#0A0716" },
          },
          error: {
            iconTheme: { primary: "#EF4444", secondary: "#0A0716" },
          },
        }}
      />

      {import.meta.env.DEV && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
}
