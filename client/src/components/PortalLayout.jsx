import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, Moon, Sun, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";

export default function PortalLayout({ navItems, title }) {
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="flex min-h-screen">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/90">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Menu size={20} strokeWidth={2} />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
            N
          </div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">NFC MediCard</p>
        </div>
        <div className="w-9" />
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Below md: full-width slide-in drawer. md–lg: 64px icon rail — narrow
          enough to still leave real content width on a tablet or a laptop
          window that isn't maximized, without losing navigation entirely
          the way a fully-hidden sidebar would. lg+: full 256px sidebar. */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-shrink-0 -translate-x-full flex-col border-r border-slate-200 bg-white/95 backdrop-blur-md transition-transform duration-200 md:sticky md:top-0 md:h-screen md:w-16 md:translate-x-0 lg:w-64 dark:border-slate-800 dark:bg-slate-900/95 ${
          mobileOpen ? "translate-x-0" : ""
        }`}
      >
        <div className="flex items-center gap-2.5 border-b border-slate-200 bg-brand-700 px-5 py-5 md:justify-center md:px-0 lg:justify-start lg:px-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 font-bold text-white ring-1 ring-white/15">
            N
          </div>
          <div className="md:hidden lg:block">
            <p className="text-sm font-semibold leading-tight text-white">NFC MediCard</p>
            <p className="text-xs text-brand-200">{title}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition md:justify-center lg:justify-between ${
                  isActive
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-800 dark:text-brand-100"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              <span className="flex items-center gap-2.5">
                <item.icon size={17} strokeWidth={2} className="flex-shrink-0" />
                <span className="md:hidden lg:inline">{item.label}</span>
              </span>
              {item.badge > 0 && (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white md:hidden lg:flex">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="mb-1 flex items-center justify-between px-1 md:justify-center lg:justify-between">
            <p className="truncate text-xs text-slate-500 md:hidden lg:block dark:text-slate-400">{profile?.email}</p>
            <button
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 md:justify-center lg:justify-start dark:text-red-400 dark:hover:bg-red-950/50"
          >
            <LogOut size={16} className="hidden md:inline lg:hidden" />
            <span className="md:hidden lg:inline">Log out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 pt-20 md:p-6 md:pt-6">
        <div className="mx-auto max-w-6xl animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
