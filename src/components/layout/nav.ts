import { BarChart3, LayoutDashboard, Package, Receipt, Settings, ShoppingCart, Store, Users, Wallet } from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Show in the mobile bottom bar (max 4 + "More") */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, primary: true },
  { to: "/pos", label: "Sell", icon: ShoppingCart, primary: true },
  { to: "/inventory", label: "Stock", icon: Package, primary: true },
  { to: "/sales", label: "Sales", icon: Receipt, primary: true },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export const MORE_ITEMS: NavItem[] = [
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/settings", label: "Settings", icon: Settings },
];

export const BRAND_ICON = Store;
