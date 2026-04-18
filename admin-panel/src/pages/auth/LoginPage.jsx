import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { login as loginRequest } from "../../api/auth.api";
import { useAuthStore } from "../../store/authStore";
import { loadTheme, toggleTheme } from "../../theme/theme";

const ThemeToggleIcon = ({ themeName }) => {
  const isLight = themeName === "roseLight";

  return isLight ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="6.75" stroke="currentColor" strokeWidth="1.6" opacity="0.35" />
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.8v2.4M12 18.8v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.4" opacity="0.35" />
      <path
        d="M15.8 12.6A6.6 6.6 0 1 1 11.4 4.2a5.2 5.2 0 0 0 4.4 8.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const LoginPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [themeName, setThemeName] = useState(() => loadTheme());

  const handleThemeToggle = () => {
    const nextTheme = toggleTheme();
    setThemeName(nextTheme);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      setErrorMessage("Please enter your email and password.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const session = await loginRequest(normalizedEmail, password);
      setAuth(session);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.error);
      } else {
        setErrorMessage(
          error?.message ||
            "Login failed. Please check your connection or credentials.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page w-full">
      <button
        type="button"
        onClick={handleThemeToggle}
        aria-label={themeName === "midnightRose" ? "Switch to light mode" : "Switch to dark mode"}
        className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-dark-900/85 text-primary shadow-lg shadow-black/20 backdrop-blur-sm"
      >
        <ThemeToggleIcon themeName={themeName} />
      </button>

      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[1000px] h-[1000px] bg-gold-600/5 rounded-full blur-[200px] pointer-events-none -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gold-700/5 rounded-full blur-[150px] pointer-events-none translate-y-1/2 -translate-x-1/4" />

      <section className="auth-shell relative z-10">
        <div className="auth-marketing">
          <div className="relative z-10">
            <span className="eyebrow">Jewellery Management</span>
            <h1 className="text-5xl font-display font-bold leading-[1.1] mb-8 text-primary">
              Streamlined Sales <br />& Inventory Suite.
            </h1>
            <p className="text-secondary max-w-sm text-base leading-relaxed mb-12">
              The professional console for your jewellery business. Manage
              suppliers, verify stock, and track sales performance in real-time.
            </p>

            <ul className="feature-list" aria-label="System Highlights">
              <li>
                <span className="feature-dot" />
                <span>Secure, authenticated admin access.</span>
              </li>
              <li>
                <span className="feature-dot" />
                <span>Intelligent QR processing & parsing.</span>
              </li>
              <li>
                <span className="feature-dot" />
                <span>Consolidated sales & stock reports.</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="auth-card">
          <div className="card-top">
            <div>
              <span className="eyebrow bg-gold-600/10 text-gold-500">
                Admin Login
              </span>
              <h2 className="text-3xl font-display font-bold mt-2">Sign In</h2>
              <p className="text-muted text-xs mt-2">
                Access your management dashboard below.
              </p>
            </div>
            <div className="brand-mark">
              <img
                src={themeName === "roseLight" ? "/logo-light-rose-notext-clean.png" : "/logo-dark.png"}
                alt="Brand Mark"
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <div className="field">
              <span className="field-label">Email Address</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@jewellery.com"
              />
            </div>

            <div className="field">
              <span className="field-label">Password</span>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••••••"
              />
            </div>

            {errorMessage && (
              <p className="error-banner" role="alert">
                {errorMessage}
              </p>
            )}

            <div className="pt-6">
              <button
                type="submit"
                className="primary-luxury-button w-full py-4 text-base tracking-widest uppercase shadow-2xl shadow-gold-600/20"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Authenticating..." : "Login to Dashboard"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;
