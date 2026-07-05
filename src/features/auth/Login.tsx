import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Moon, Shield, Sun } from "lucide-react";
import stJudeLogo from "../../assets/stjude-logo.png";
import { useApp } from "../../app/AppProvider";
import { ApiError } from "../../services/apiClient";
import { FormInput } from "../../shared/ui";

function signInMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "network") return "Cannot reach the server. Check your connection and try again.";
    if (error.status === 401 || error.status === 403 || error.status === 400) return "The email or password you entered is incorrect.";
    if (error.code === "server") return "The server could not complete sign-in right now. Please try again shortly.";
  }
  return "We could not sign you in. Please check your details and try again.";
}

export function Login() {
  const { signIn, isAuthenticated, showToast, theme, toggleTheme } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const showDemoAccounts = import.meta.env.DEV;
  const [email, setEmail] = useState(showDemoAccounts ? "admin@stjude.local" : "");
  const [password, setPassword] = useState(showDemoAccounts ? "Password123!" : "");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const demoAccounts = showDemoAccounts
    ? [
        { label: "Super admin", email: "admin@stjude.local" },
        { label: "Staff", email: "staff@stjude.local" },
        { label: "Doctor", email: "doctor@stjude.local" },
      ]
    : [];
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      navigate((location.state as { from?: string } | null)?.from ?? "/");
    } catch (err) {
      const message = signInMessage(err);
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      navigate((location.state as { from?: string } | null)?.from ?? "/", { replace: true });
    }
  }, [isAuthenticated, location.state, navigate]);

  return (
    <main className="login-page">
      <button className="login-theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
        {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
      </button>
      <section className="login-auth-side">
        <div className="login-panel">
          <div className="login-heading">
            <h1>Sign In</h1>
            <p>Enter your email and password to sign in.</p>
          </div>
          {showDemoAccounts && (
            <>
              <div className="login-demo-actions" aria-label="Demo account shortcuts">
                {demoAccounts.slice(0, 2).map((account) => (
                  <button key={account.email} type="button" disabled={isSubmitting} onClick={() => { setEmail(account.email); setPassword("Password123!"); }} className="login-demo-btn">
                    <Shield size={18} />
                    <span>{account.label}</span>
                  </button>
                ))}
              </div>
              <div className="login-divider"><span>Or</span></div>
            </>
          )}
          <form className="login-form" onSubmit={submit}>
            <FormInput label="Email" required type="email" value={email} disabled={isSubmitting} onChange={setEmail} autoComplete="email" placeholder="info@gmail.com" />
            <FormInput label="Password" required type="password" revealable value={password} disabled={isSubmitting} onChange={setPassword} autoComplete="current-password" placeholder="Enter your password" />
            <div className="login-options">
              <label>
                <input type="checkbox" checked={rememberSession} onChange={(event) => setRememberSession(event.target.checked)} />
                <span>Keep me logged in</span>
              </label>
              <button type="button" onClick={() => showToast("Please ask a super admin to reset your password.", "info")}>Forgot password?</button>
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-btn" disabled={isSubmitting}>{isSubmitting ? "Signing in..." : "Sign In"}</button>
          </form>
          <p className="login-signup">Need access? <button type="button" onClick={() => showToast("Ask a super admin to create your account.", "info")}>Contact admin</button></p>
          {showDemoAccounts && <p className="login-demo-note">Demo password: <strong>Password123!</strong></p>}
        </div>
      </section>
      <section className="login-brand-side" aria-label="St. Jude's Psychiatric and Custodial Home administration dashboard">
        <div className="login-brand-content">
          <img className="login-brand-logo" src={stJudeLogo} alt="St. Jude Psychiatric and Custodial Home logo" />
          <h2>St. Jude's Psychiatric and Custodial Home</h2>
          <p>Administration dashboard.</p>
        </div>
      </section>
    </main>
  );
}
