import { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import LogoBadge from "./ui/LogoBadge";
import ThemeToggleButton from "./ui/ThemeToggleButton";
import { useAuthStore } from "../store/authStore";
import {
  APP_BRAND_SHORT,
  APP_BRAND_TAGLINE,
  loadTheme,
  toggleTheme,
} from "../theme/theme";

export const Layout = () => {
  const location = useLocation();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const user = useAuthStore((state) => state.user);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [themeName, setThemeName] = useState(loadTheme());

  const navLinks = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Sales", path: "/sales" },
    { name: "Suppliers", path: "/suppliers" },
    ...(user?.role === "admin"
      ? [
          { name: "Users", path: "/users" },
        ]
      : []),
  ];

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    clearAuth();
  };

  const handleThemeToggle = () => {
    const nextTheme = toggleTheme();
    setThemeName(nextTheme);
  };

  const logoSrc =
    themeName === "roseLight"
      ? "/logo-light-rose-notext-clean.png"
      : "/logo-dark.png";

  return (
    <div className="flex h-screen overflow-hidden text-sm w-full">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`w-72 flex-shrink-0 border-r border-white/5 bg-dark-950 flex flex-col premium-shadow z-50 transition-transform duration-300 fixed inset-y-0 left-0 -translate-x-full lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : ""}`}
      >
        <div className="h-24 flex items-center px-8 gap-4 border-b border-white/5">
          <LogoBadge
            src={logoSrc}
            alt="Logo"
            wrapperClassName="w-14 h-14 rounded-full bg-[var(--jsm-panel-bg)] border border-gold-600/10 shadow-[0_0_0_1px_rgba(229,180,99,0.05)]"
            className="rounded-full"
          />
          <div className="flex flex-col">
            <div className="font-display font-bold text-lg gold-gradient-text tracking-widest uppercase">
              {APP_BRAND_SHORT}
            </div>
            <div className="text-[10px] text-faint tracking-[0.2em] font-bold">
              {APP_BRAND_TAGLINE}
            </div>
          </div>
        </div>

        <div className="p-6 flex-1 flex flex-col gap-3">
          <div className="text-[10px] uppercase tracking-widest text-faint font-bold mb-1 ml-2">
            Main Navigation
          </div>
          {navLinks.map((link) => {
            const isActive = location.pathname.startsWith(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setSidebarOpen(false)}
                className={`px-5 py-4 rounded-2xl transition-all duration-300 flex items-center gap-4 group ${
                  isActive
                    ? "bg-gradient-to-r from-gold-600/10 to-transparent border border-gold-600/20 text-gold-500 font-bold ring-1 ring-gold-600/5"
                    : "text-muted hover:text-primary hover:bg-white/5"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${isActive ? "bg-gold-500 shadow-[0_0_8px_rgba(229,180,99,0.5)]" : "bg-transparent group-hover:bg-white/20"}`}
                />
                {link.name}
              </Link>
            );
          })}
        </div>

        <div className="p-6 border-t border-white/5 bg-dark-900/40">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-dark-800 to-dark-950 border border-white/10 flex items-center justify-center font-bold text-heading uppercase">
              {user?.name?.[0] || "A"}
            </div>
            <div>
              <div className="font-bold text-primary leading-tight">
                {user?.name || "Admin"}
              </div>
              <div className="text-[10px] text-heading uppercase tracking-widest font-bold">
                Authorized {user?.role || "user"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            aria-label="Open logout confirmation"
            className="w-full text-center px-4 py-3 text-red-500 font-bold hover:text-red-300 hover:bg-red-500/5 border border-red-500/10 rounded-2xl transition-all active:scale-[0.98]"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 lg:hidden relative z-20">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
            className="w-11 h-11 rounded-full border panel-border surface-panel text-heading flex items-center justify-center shadow-none"
          >
            <span className="sr-only">Open navigation</span>
            <span className="flex flex-col gap-1.5">
              <span className="block w-5 h-0.5 rounded-full bg-current" />
              <span className="block w-5 h-0.5 rounded-full bg-current" />
              <span className="block w-5 h-0.5 rounded-full bg-current" />
            </span>
          </button>
          <ThemeToggleButton
            themeName={themeName}
            onClick={handleThemeToggle}
            ariaLabel="Toggle theme"
          />
        </div>

        <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-gold-600/5 rounded-full blur-[160px] pointer-events-none -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gold-700/5 rounded-full blur-[120px] pointer-events-none translate-y-1/2 -translate-x-1/4" />

        <ThemeToggleButton
          themeName={themeName}
          onClick={handleThemeToggle}
          ariaLabel="Toggle theme"
          position="floating"
        />

        <div className="flex-1 overflow-auto p-4 lg:p-12 relative z-10">
          <Outlet />
        </div>
      </main>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[rgba(38,28,24,0.48)] backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm p-8 premium-shadow animate-[zoom-in_120ms_ease-out] will-change-transform transform-gpu">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-6 mx-auto">
              <span className="text-red-500 text-2xl font-bold">!</span>
            </div>
            <h3 className="text-xl font-bold text-center mb-2 text-heading">
              Logout?
            </h3>
            <p className="text-muted text-center mb-8 text-sm">
              Are you sure you want to log out of the jewellery management
              console?
            </p>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-3 bg-red-500 hover:bg-red-600 text-on-accent font-bold rounded-xl transition-all shadow-lg shadow-red-500/20"
                aria-label="Confirm logout"
              >
                Sign Out
              </button>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-primary font-bold rounded-xl transition-all border border-white/10"
                aria-label="Cancel logout"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
