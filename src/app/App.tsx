import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ToastProvider } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/misc";
import { AppShell } from "@/components/layout/AppShell";
import { hasSupabaseEnv } from "@/lib/supabase";
import { syncManager } from "@/lib/syncManager";
import { useEffect } from "react";
import SetupRequired from "@/pages/SetupRequired";

const LandingPage = lazy(() => import("@/pages/LandingPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const SignupPage = lazy(() => import("@/pages/SignupPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const PosPage = lazy(() => import("@/pages/PosPage"));
const InventoryPage = lazy(() => import("@/pages/InventoryPage"));
const SalesHistoryPage = lazy(() => import("@/pages/SalesHistoryPage"));
const CustomersPage = lazy(() => import("@/pages/CustomersPage"));
const ExpensesPage = lazy(() => import("@/pages/ExpensesPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Protected({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <Spinner className="min-h-screen" />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <Spinner className="min-h-screen" />;
  if (session) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function SyncBootstrap() {
  useEffect(() => {
    syncManager.start(queryClient);
    return () => syncManager.stop();
  }, []);
  return null;
}

export default function App() {
  if (!hasSupabaseEnv) return <SetupRequired />;

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <SyncBootstrap />
          <BrowserRouter>
            <Suspense fallback={<Spinner className="min-h-screen" />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
                <Route path="/signup" element={<PublicOnly><SignupPage /></PublicOnly>} />

                <Route element={<Protected><AppShell /></Protected>}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/pos" element={<PosPage />} />
                  <Route path="/inventory" element={<InventoryPage />} />
                  <Route path="/sales" element={<SalesHistoryPage />} />
                  <Route path="/customers" element={<CustomersPage />} />
                  <Route path="/expenses" element={<ExpensesPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>

                <Route path="/sales/new" element={<Navigate to="/pos" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
