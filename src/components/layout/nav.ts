import {
  BarChart3, CalendarClock, CheckSquare, ClipboardList,
  Factory, LayoutDashboard, Package, PackagePlus, Receipt, Settings, ShoppingCart,
  ShieldCheck, Store, Trash, Truck, UserCog, Users, Vault, Wallet,
} from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
  to: string;
  labelKey: string;
  fallback: string;
  icon: ComponentType<{ className?: string }>;
  /** Show in the mobile bottom bar (max 4 + "More") */
  primary?: boolean;
}

export interface NavSection {
  labelKey: string;
  fallback: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    labelKey: "nav.section.main",
    fallback: "Main",
    items: [
      { to: "/dashboard", labelKey: "nav.dashboard", fallback: "Dashboard", icon: LayoutDashboard, primary: true },
      { to: "/pos", labelKey: "nav.pos", fallback: "Sell", icon: ShoppingCart, primary: true },
      { to: "/sales", labelKey: "nav.sales", fallback: "Sales", icon: Receipt, primary: true },
      { to: "/orders", labelKey: "nav.orders", fallback: "Orders", icon: ClipboardList },
    ],
  },
  {
    labelKey: "nav.section.stock",
    fallback: "Stock",
    items: [
      { to: "/inventory", labelKey: "nav.inventory", fallback: "Stock", icon: Package, primary: true },
      { to: "/purchases", labelKey: "nav.purchases", fallback: "Purchases", icon: PackagePlus },
      { to: "/suppliers", labelKey: "nav.suppliers", fallback: "Suppliers", icon: Truck },
      { to: "/production", labelKey: "nav.production", fallback: "Production", icon: Factory },
    ],
  },
  {
    labelKey: "nav.section.people",
    fallback: "People",
    items: [
      { to: "/customers", labelKey: "nav.customers", fallback: "Customers", icon: Users },
      { to: "/appointments", labelKey: "nav.appointments", fallback: "Appointments", icon: CalendarClock },
      { to: "/team", labelKey: "nav.hrm", fallback: "Team", icon: UserCog },
      { to: "/todos", labelKey: "nav.todos", fallback: "To-Do", icon: CheckSquare },
    ],
  },
  {
    labelKey: "nav.section.money",
    fallback: "Money",
    items: [
      { to: "/expenses", labelKey: "nav.expenses", fallback: "Money", icon: Wallet },
      { to: "/reports", labelKey: "nav.reports", fallback: "Reports", icon: BarChart3 },
      { to: "/assets", labelKey: "nav.assets", fallback: "Assets", icon: Vault },
    ],
  },
  {
    labelKey: "nav.section.admin",
    fallback: "Admin",
    items: [
      { to: "/users", labelKey: "nav.users", fallback: "Users", icon: ShieldCheck },
      { to: "/recycle-bin", labelKey: "nav.bin", fallback: "Recycle Bin", icon: Trash },
      { to: "/settings", labelKey: "nav.settings", fallback: "Settings", icon: Settings },
    ],
  },
];

export const BRAND_ICON = Store;
