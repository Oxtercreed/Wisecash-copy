import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ToastProvider } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { AppShell } from "@/components/layout/AppShell";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import { syncManager } from "@/lib/syncManager";
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
const SuppliersPage = lazy(() => import("@/pages/SuppliersPage"));
const PurchasesPage = lazy(() => import("@/pages/PurchasesPage"));
const OrdersPage = lazy(() => import("@/pages/OrdersPage"));
const HrmPage = lazy(() => import("@/pages/HrmPage"));
const ProductionPage = lazy(() => import("@/pages/ProductionPage"));
const AssetsPage = lazy(() => import("@/pages/AssetsPage"));
const TodosPage = lazy(() => import("@/pages/TodosPage"));
const AppointmentsPage = lazy(() => import("@/pages/AppointmentsPage"));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));
const UsersPage = lazy(() => import("@/pages/UsersPage"));
const RecycleBinPage = lazy(() => import("@/pages/RecycleBinPage"));
const BillingPage = lazy(() => import("@/pages/BillingPage"));
const PlatformAdminPage = lazy(() => import("@/pages/PlatformAdminPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function DisabledScreen() {
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <p className="text-4xl">🚫</p>
      <h1 className="text-lg font-extrabold">Account deactivated</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        The shop owner has disabled this account. Contact them if you think this is a mistake.
      </p>
      <Button variant="outline" onClick={() => void signOut()}>Back to sign in</Button>
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { session, profile, loading, profileLoaded } = useAuth();
  if (loading) return <Spinner className="min-h-screen" />;
  if (!session) return <Navigate to="/login" replace />;
  if (profileLoaded && !profile) return <DisabledScreen />;
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
    void supabase.rpc("cleanup_expired_bin").then(() => undefined, () => undefined);
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
          <LanguageProvider>
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
                    <Route path="/orders" element={<OrdersPage />} />
                    <Route path="/purchases" element={<PurchasesPage />} />
                    <Route path="/suppliers" element={<SuppliersPage />} />
                    <Route path="/production" element={<ProductionPage />} />
                    <Route path="/customers" element={<CustomersPage />} />
                    <Route path="/expenses" element={<ExpensesPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/team" element={<HrmPage />} />
                    <Route path="/assets" element={<AssetsPage />} />
                    <Route path="/appointments" element={<AppointmentsPage />} />
                    <Route path="/todos" element={<TodosPage />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/recycle-bin" element={<RecycleBinPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/billing" element={<BillingPage />} />
                    <Route path="/platform" element={<PlatformAdminPage />} />
                  </Route>

                  <Route path="/sales/new" element={<Navigate to="/pos" replace />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </LanguageProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
