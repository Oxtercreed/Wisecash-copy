import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "en" | "sw";

const dictionaries: Record<Language, Record<string, string>> = {
  en: {
    "nav.dashboard": "Dashboard",
    "nav.pos": "Sell",
    "nav.inventory": "Stock",
    "nav.sales": "Sales",
    "nav.orders": "Orders",
    "nav.purchases": "Purchases",
    "nav.suppliers": "Suppliers",
    "nav.production": "Production",
    "nav.customers": "Customers",
    "nav.expenses": "Money",
    "nav.hrm": "Team",
    "nav.assets": "Assets",
    "nav.appointments": "Appointments",
    "nav.todos": "To-Do",
    "nav.reports": "Reports",
    "nav.users": "Users",
    "nav.bin": "Recycle Bin",
    "nav.settings": "Settings",
    "nav.more": "More",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.total": "Total",
    "common.today": "Today",
    "dash.title": "Today at a glance",
    "dash.salesToday": "Sales today",
    "dash.cashIn": "Cash + M-Pesa in",
    "dash.netProfit": "Net profit today",
    "dash.creditToday": "Credit given today",
    "pos.complete": "Complete sale",
    "pos.cart": "Cart",
    "pos.discount": "Discount",
  },
  sw: {
    "nav.dashboard": "Dashibodi",
    "nav.pos": "Uza",
    "nav.inventory": "Bidhaa",
    "nav.sales": "Mauzo",
    "nav.orders": "Oda",
    "nav.purchases": "Manunuzi",
    "nav.suppliers": "Wasambazaji",
    "nav.production": "Uzalishaji",
    "nav.customers": "Wateja",
    "nav.expenses": "Fedha",
    "nav.hrm": "Wafanyakazi",
    "nav.assets": "Mali",
    "nav.appointments": "Miadi",
    "nav.todos": "Majukumu",
    "nav.reports": "Ripoti",
    "nav.users": "Watumiaji",
    "nav.bin": "Kipetushe",
    "nav.settings": "Mipangilio",
    "nav.more": "Zaidi",
    "common.save": "Hifadhi",
    "common.cancel": "Ghairi",
    "common.delete": "Futa",
    "common.edit": "Badilisha",
    "common.total": "Jumla",
    "common.today": "Leo",
    "dash.title": "Muhtasari wa leo",
    "dash.salesToday": "Mauzo ya leo",
    "dash.cashIn": "Pesa zilizopoingia",
    "dash.netProfit": "Faida ya leo",
    "dash.creditToday": "Deni la leo",
    "pos.complete": "Kamilisha mauzo",
    "pos.cart": "Kikapu",
    "pos.discount": "Punguzo",
  },
};

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("sd_language") : null;
    return saved === "sw" ? "sw" : "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("sd_language", lang);
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string) => dictionaries[language][key] ?? dictionaries.en[key] ?? key;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
