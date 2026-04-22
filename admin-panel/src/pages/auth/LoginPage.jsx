import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { login as loginRequest } from "../../api/auth.api";
import LogoBadge from "../../components/ui/LogoBadge";
import PasswordField from "../../components/ui/PasswordField";
import ThemeToggleButton from "../../components/ui/ThemeToggleButton";
import BrandDoodleBackground from "../../components/ui/BrandDoodleBackground";
import { useAuthStore } from "../../store/authStore";
import { APP_BRAND_NAME, loadTheme, toggleTheme } from "../../theme/theme";

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
      <ThemeToggleButton
        themeName={themeName}
        onClick={handleThemeToggle}
        className="absolute right-4 top-4 z-20 backdrop-blur-sm"
      />

      <BrandDoodleBackground />

      <section className="auth-shell relative z-10">
        <div className="auth-marketing">
          <div className="relative z-10">
            <span className="eyebrow text-heading">{APP_BRAND_NAME}</span>
            <h1 className="text-5xl font-display font-bold leading-[1.1] mb-8 text-heading">
              Streamlined Sales <br />& Inventory Suite.
            </h1>
            <p className="text-muted max-w-sm text-base leading-relaxed mb-12">
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
              <span className="eyebrow text-heading bg-gold-600/10">
                Admin Login
              </span>
              <h2 className="text-3xl font-display font-bold mt-2 text-heading">
                Sign In
              </h2>
              <p className="text-muted text-xs mt-2">
                Access your management dashboard below.
              </p>
            </div>
            <LogoBadge
              src={
                themeName === "roseLight"
                  ? "/logo-light-rose-notext-clean.png"
                  : "/logo-dark.png"
              }
              alt="Brand Mark"
              wrapperClassName="brand-mark border-0 border-gold-600/5 brand-mark--lg"
            />
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

            <PasswordField
              label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />

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
