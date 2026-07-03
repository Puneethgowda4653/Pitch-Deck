import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const authWrap: React.CSSProperties = {
  minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
  padding: 24, position: "relative", overflow: "hidden",
  background: "var(--surface-page)",
};
const haloStyle: React.CSSProperties = {
  position: "absolute", inset: 0, background: "var(--grad-hero)", pointerEvents: "none",
};
const cardStyle: React.CSSProperties = {
  position: "relative", width: "100%", maxWidth: 400,
  background: "var(--surface-card)", border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-lg)", padding: "38px 36px",
};

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await register(name, email, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Registration failed");
    }
  };

  return (
    <div style={authWrap}>
      <div style={haloStyle} />
      <div style={cardStyle}>
        <img src="/ipreneur-logo.webp" alt="iPreneur" style={{ width: 140, margin: "0 auto 26px", display: "block" }} />
        <h1 style={{ font: "800 26px var(--font-display)", letterSpacing: "-0.03em", color: "var(--text-strong)", textAlign: "center" }}>
          Create your account
        </h1>
        <p style={{ marginTop: 7, marginBottom: 26, font: "400 14px var(--font-body)", color: "var(--text-muted)", textAlign: "center" }}>
          Start generating pitch decks with AI
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <p style={{ fontSize: "var(--text-xs)", color: "var(--danger)", background: "var(--danger-surface)", border: "1px solid rgba(220,38,38,.2)", borderRadius: "var(--radius-md)", padding: "8px 12px", textAlign: "center" }}>
              {error}
            </p>
          )}
          <Input
            label="Full name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Smith"
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            iconRight={<ArrowRight size={16} />}
          >
            Create account
          </Button>
        </form>

        <p style={{ marginTop: 22, textAlign: "center", font: "400 13px var(--font-body)", color: "var(--text-muted)" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--text-link)", fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
