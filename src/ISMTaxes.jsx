import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "https://ismcategorizacion-production.up.railway.app";

const INDUSTRIES = [
  "Agriculture", "Construction", "Manufacturing", "Wholesale Trade",
  "Retail Trade", "Transportation & Warehousing", "Information Technology",
  "Finance & Insurance", "Real Estate", "Professional Services",
  "Healthcare", "Food Service & Restaurants", "Education",
  "Entertainment & Recreation", "Personal Services", "Other",
];
const YEARS = ["2019","2020","2021","2022","2023","2024","2025","2026"];
const ENTITIES = [
  "Sole Proprietor (Schedule C)", "S-Corp", "C-Corp", "Partnership", "LLC",
];

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  bg: "#0A0A0F",
  surface: "rgba(255,255,255,0.04)",
  surfaceHover: "rgba(255,255,255,0.07)",
  border: "rgba(255,255,255,0.08)",
  borderGreen: "rgba(16,185,129,0.35)",
  green: "#10B981",
  greenDim: "rgba(16,185,129,0.12)",
  greenGlow: "0 0 24px rgba(16,185,129,0.18)",
  red: "#F87171",
  redDim: "rgba(248,113,113,0.12)",
  text: "#E2E8F0",
  textMuted: "#64748B",
  textSub: "#94A3B8",
  input: "rgba(255,255,255,0.05)",
};

const glass = {
  background: C.surface,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: `1px solid ${C.border}`,
  borderRadius: 16,
};

const inputStyle = {
  width: "100%",
  background: C.input,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  color: C.text,
  fontSize: 16,
  padding: "12px 14px",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
};

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  color: C.textSub,
  marginBottom: 6,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
};

function fmt(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
}

function downloadB64(b64, filename) {
  const bytes = atob(b64);
  const ab = new ArrayBuffer(bytes.length);
  const view = new Uint8Array(ab);
  for (let i = 0; i < bytes.length; i++) view[i] = bytes.charCodeAt(i);
  const blob = new Blob([ab], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Components ─────────────────────────────────────────────────────────────
function MetricCard({ label, value, color, sub }) {
  const isPositive = value >= 0;
  const cardColor = color || (isPositive ? C.green : C.red);
  const dimColor = color ? C.greenDim : isPositive ? C.greenDim : C.redDim;

  return (
    <div style={{
      ...glass,
      padding: "24px 28px",
      flex: 1,
      minWidth: 180,
      background: dimColor,
      border: `1px solid ${color || (isPositive ? C.borderGreen : "rgba(248,113,113,0.3)")}`,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 13, color: C.textSub, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: cardColor, letterSpacing: "-0.02em" }}>
        {fmt(value)}
      </div>
      {sub && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = "primary", style: extraStyle = {} }) {
  const base = {
    border: "none",
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 16,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s",
    padding: "13px 28px",
    opacity: disabled ? 0.5 : 1,
  };
  const variants = {
    primary: { background: C.green, color: "#000", boxShadow: C.greenGlow },
    ghost:   { background: "transparent", color: C.green, border: `1px solid ${C.borderGreen}` },
    danger:  { background: "transparent", color: C.red, border: `1px solid rgba(248,113,113,0.3)` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...extraStyle }}>
      {children}
    </button>
  );
}

// ── Login ──────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || "Invalid credentials");
      }
      const data = await res.json();
      localStorage.setItem("ism_token", data.access_token);
      localStorage.setItem("ism_user", JSON.stringify({ email: data.email, role: data.role }));
      onLogin({ email: data.email, role: data.role }, data.access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{ position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: 600, height: 300, background: "rgba(16,185,129,0.06)",
        borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none" }} />

      <div style={{ ...glass, padding: "48px 40px", width: "100%", maxWidth: 420, position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>⚖️</div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: C.text, letterSpacing: "-0.03em" }}>
            ISM <span style={{ color: C.green }}>Taxes</span>
          </h1>
          <p style={{ margin: "8px 0 0", color: C.textMuted, fontSize: 15 }}>
            Tax Categorization Platform
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com" required autoComplete="username" />
          </div>
          <div style={{ marginBottom: 28 }}>
            <label style={labelStyle}>Password</label>
            <input style={inputStyle} type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" required autoComplete="current-password" />
          </div>

          {error && (
            <div style={{
              background: C.redDim, border: `1px solid rgba(248,113,113,0.3)`,
              borderRadius: 10, padding: "10px 14px", marginBottom: 20,
              color: C.red, fontSize: 14,
            }}>{error}</div>
          )}

          <Btn style={{ width: "100%" }} disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </Btn>
        </form>
      </div>
    </div>
  );
}

// ── Admin Panel ────────────────────────────────────────────────────────────
function AdminPanel({ token, onClose }) {
  const [users, setUsers]       = useState(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPwd, setNewPwd]     = useState("");
  const [msg, setMsg]           = useState("");
  const [err, setErr]           = useState("");
  const [loading, setLoading]   = useState(false);

  const loadUsers = async () => {
    const res = await fetch(`${API_URL}/auth/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setUsers(await res.json());
  };

  if (users === null) loadUsers();

  const createUser = async (e) => {
    e.preventDefault();
    setMsg(""); setErr(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newEmail, password: newPwd }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || "Error creating user");
      setMsg(`User ${newEmail} created`);
      setNewEmail(""); setNewPwd("");
      loadUsers();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 24,
    }}>
      <div style={{ ...glass, padding: 36, width: "100%", maxWidth: 500, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <h2 style={{ margin: 0, fontSize: 22, color: C.text }}>Admin Panel</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 24, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 15, color: C.green, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Create New User
          </h3>
          <form onSubmit={createUser}>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Password</label>
              <input style={inputStyle} type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required />
            </div>
            {msg && <div style={{ color: C.green, fontSize: 14, marginBottom: 10 }}>{msg}</div>}
            {err && <div style={{ color: C.red, fontSize: 14, marginBottom: 10 }}>{err}</div>}
            <Btn disabled={loading}>{loading ? "Creating…" : "Create User"}</Btn>
          </form>
        </div>

        <div>
          <h3 style={{ fontSize: 15, color: C.green, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Users
          </h3>
          {users === null ? (
            <div style={{ color: C.textMuted }}>Loading…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {users.map((u) => (
                <div key={u.email} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: C.input, borderRadius: 8, padding: "10px 14px",
                }}>
                  <span style={{ color: C.text, fontSize: 15 }}>{u.email}</span>
                  <span style={{
                    fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                    color: u.role === "admin" ? C.green : C.textMuted,
                    background: u.role === "admin" ? C.greenDim : "transparent",
                    padding: "3px 8px", borderRadius: 6,
                  }}>{u.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Results ────────────────────────────────────────────────────────────────
function Results({ summary, fileB64, filename, companyName, year, onReset }) {
  const { total_income, total_expenses, net, categories, transaction_count } = summary;

  return (
    <div>
      <div style={{ marginBottom: 28, textAlign: "center" }}>
        <div style={{ fontSize: 13, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          {companyName} · Fiscal Year {year}
        </div>
        <h2 style={{ margin: 0, fontSize: 26, color: C.text, fontWeight: 700 }}>
          Profit &amp; Loss Summary
        </h2>
        <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
          {transaction_count} transactions processed
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <MetricCard label="Total Income" value={total_income} color={total_income > 0 ? C.green : undefined} />
        <MetricCard label="Total Expenses" value={-total_expenses} color={C.red} />
        <MetricCard label="Net" value={net} sub={net >= 0 ? "Surplus" : "Deficit"} />
      </div>

      <div style={{ ...glass, overflow: "hidden", marginBottom: 24 }}>
        <div style={{
          padding: "16px 24px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Expense Breakdown by Category</span>
          <span style={{ fontSize: 13, color: C.textMuted }}>{categories.length} categories</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 12, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${C.border}` }}>Category</th>
                <th style={{ padding: "12px 24px", textAlign: "right", fontSize: 12, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${C.border}` }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, i) => (
                <tr key={cat.category} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                  <td style={{ padding: "13px 24px", fontSize: 15, color: C.text }}>{cat.category}</td>
                  <td style={{ padding: "13px 24px", fontSize: 15, fontWeight: 500, color: C.text, textAlign: "right" }}>{fmt(cat.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "rgba(16,185,129,0.07)", borderTop: `2px solid ${C.borderGreen}` }}>
                <td style={{ padding: "14px 24px", fontSize: 15, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: "0.04em" }}>Total Expenses</td>
                <td style={{ padding: "14px 24px", fontSize: 16, fontWeight: 700, color: C.green, textAlign: "right" }}>{fmt(total_expenses)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Btn onClick={() => downloadB64(fileB64, filename)}>↓ Download Excel Report</Btn>
        <Btn variant="ghost" onClick={onReset}>← Process Another File</Btn>
      </div>
    </div>
  );
}

// ── Classify Form ──────────────────────────────────────────────────────────
function ClassifyForm({ token, onResult }) {
  const [companyName, setCompanyName] = useState("");
  const [year, setYear]               = useState("2025");
  const [industry, setIndustry]       = useState("Other");
  const [entity, setEntity]           = useState("Sole Proprietor (Schedule C)");
  const [file, setFile]               = useState(null);
  const [dragging, setDragging]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setError("Please select a file."); return; }
    setError(""); setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("company_name", companyName);
      fd.append("year", year);
      fd.append("industry", industry);
      fd.append("entity", entity);
      const res = await fetch(`${API_URL}/classify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (res.status === 401) throw new Error("Session expired. Please log in again.");
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Processing error"); }
      const data = await res.json();
      onResult(data, companyName, year);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectStyle = { ...inputStyle, appearance: "none", cursor: "pointer" };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Company Name</label>
        <input style={inputStyle} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Corp LLC" required />
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={labelStyle}>Fiscal Year</label>
          <select style={selectStyle} value={year} onChange={(e) => setYear(e.target.value)}>
            {YEARS.map((y) => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ flex: 3, minWidth: 200 }}>
          <label style={labelStyle}>Industry</label>
          <select style={selectStyle} value={industry} onChange={(e) => setIndustry(e.target.value)}>
            {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Entity Type</label>
        <select style={selectStyle} value={entity} onChange={(e) => setEntity(e.target.value)}>
          {ENTITIES.map((en) => <option key={en}>{en}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 28 }}>
        <label style={labelStyle}>Bank Statement</label>
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 10, padding: "32px 20px", cursor: "pointer",
            border: `2px dashed ${dragging ? C.green : file ? C.borderGreen : C.border}`,
            borderRadius: 12,
            background: dragging ? C.greenDim : file ? "rgba(16,185,129,0.05)" : C.input,
            transition: "all 0.2s",
          }}
        >
          <input type="file" accept=".xlsx,.xls,.csv,.pdf" style={{ display: "none" }} onChange={(e) => setFile(e.target.files[0])} />
          <span style={{ fontSize: 28 }}>{file ? "📄" : "⬆️"}</span>
          <span style={{ color: file ? C.green : C.textSub, fontSize: 15, fontWeight: 500 }}>
            {file ? file.name : "Drop file here or click to browse"}
          </span>
          <span style={{ fontSize: 13, color: C.textMuted }}>
            {file ? `${(file.size / 1024).toFixed(1)} KB` : ".xlsx · .xls · .csv · .pdf"}
          </span>
        </label>
      </div>

      {error && (
        <div style={{
          background: C.redDim, border: `1px solid rgba(248,113,113,0.3)`,
          borderRadius: 10, padding: "10px 14px", marginBottom: 20,
          color: C.red, fontSize: 14,
        }}>{error}</div>
      )}

      <Btn style={{ width: "100%" }} disabled={loading}>
        {loading ? (
          <span>
            <span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: 8 }}>⟳</span>
            Processing…
          </span>
        ) : "Categorize Transactions"}
      </Btn>
    </form>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function ISMTaxes() {
  const savedToken = localStorage.getItem("ism_token");
  const savedUser  = (() => { try { return JSON.parse(localStorage.getItem("ism_user")); } catch { return null; } })();

  const [token, setToken]         = useState(savedToken || null);
  const [user, setUser]           = useState(savedUser || null);
  const [result, setResult]       = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);

  const handleLogin  = (u, t) => { setToken(t); setUser(u); };
  const handleLogout = () => {
    localStorage.removeItem("ism_token");
    localStorage.removeItem("ism_user");
    setToken(null); setUser(null); setResult(null);
  };

  if (!token || !user) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter','Segoe UI',sans-serif", fontSize: 16 }}>
      <div style={{
        position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)",
        width: 800, height: 400, background: "rgba(16,185,129,0.04)",
        borderRadius: "50%", filter: "blur(100px)", pointerEvents: "none", zIndex: 0,
      }} />

      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        borderBottom: `1px solid ${C.border}`,
        background: "rgba(10,10,15,0.85)", backdropFilter: "blur(20px)",
        padding: "0 32px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚖️</span>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }}>
            ISM <span style={{ color: C.green }}>Taxes</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {user.role === "admin" && (
            <button onClick={() => setShowAdmin(true)} style={{
              background: C.greenDim, border: `1px solid ${C.borderGreen}`,
              color: C.green, borderRadius: 8, padding: "6px 14px",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>Admin</button>
          )}
          <span style={{ fontSize: 13, color: C.textMuted }}>{user.email}</span>
          <Btn variant="ghost" onClick={handleLogout} style={{ padding: "7px 16px", fontSize: 13 }}>Sign Out</Btn>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", position: "relative", zIndex: 1 }}>
        {result ? (
          <Results
            summary={result.summary}
            fileB64={result.file_b64}
            filename={result.filename}
            companyName={result.companyName}
            year={result.year}
            onReset={() => setResult(null)}
          />
        ) : (
          <>
            <div style={{ marginBottom: 36 }}>
              <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                IRS Tax <span style={{ color: C.green }}>Categorization</span>
              </h1>
              <p style={{ margin: "12px 0 0", color: C.textSub, fontSize: 17, lineHeight: 1.6 }}>
                Upload your bank statement and get a fully categorized expense report in seconds.
              </p>
            </div>
            <div style={{ ...glass, padding: "36px 32px" }}>
              <ClassifyForm token={token} onResult={(data, cn, yr) => setResult({ ...data, companyName: cn, year: yr })} />
            </div>
          </>
        )}
      </main>

      {showAdmin && <AdminPanel token={token} onClose={() => setShowAdmin(false)} />}

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        input::placeholder { color: #475569; }
        select option { background: #1a1a2e; color: #E2E8F0; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>
    </div>
  );
}
