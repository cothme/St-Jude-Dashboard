import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
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
  const { signIn, isAuthenticated, showToast } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const showDemoAccounts = import.meta.env.DEV;
  const [email, setEmail] = useState(showDemoAccounts ? "admin@stjude.local" : "");
  const [password, setPassword] = useState(showDemoAccounts ? "Password123!" : "");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const demoAccounts = [
    { label: "Super admin", email: "admin@stjude.local" },
    { label: "Staff", email: "staff@stjude.local" },
    { label: "Doctor", email: "doctor@stjude.local" },
  ];
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
      <section className="login-panel">
        <img className="login-logo" src={stJudeLogo} alt="St. Jude Psychiatric and Custodial Home logo" />
        <h1>St. Jude Administrator Dashboard</h1>
        <p>Secure access for patient care, payroll, staffing, and administrative records.</p>
        <form className="login-form" onSubmit={submit}>
          <FormInput label="Email" required type="email" value={email} disabled={isSubmitting} onChange={setEmail} autoComplete="email" />
          <FormInput label="Password" required type="password" value={password} disabled={isSubmitting} onChange={setPassword} autoComplete="current-password" />
          {error && <p className="form-error">{error}</p>}
          <button className="primary-btn" disabled={isSubmitting}>{isSubmitting ? "Signing in..." : "Sign In"}</button>
        </form>
        {showDemoAccounts && (
          <>
            <p className="login-demo-note">Demo password: <strong>Password123!</strong></p>
            <div className="role-grid">
              {demoAccounts.map((account) => (
                <button key={account.email} disabled={isSubmitting} onClick={() => { setEmail(account.email); setPassword("Password123!"); }} className="role-card">
                  <Shield size={22} />
                  <span>{account.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
