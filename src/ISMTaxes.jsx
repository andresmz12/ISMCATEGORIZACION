import { useState, useEffect } from "react";

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
  bg:           "#FFFFFF",
  surface:      "#FFFFFF",
  surfaceAlt:   "#F9FAFB",
  primary:      "#F5C518",
  primaryHover: "#E6B800",
  primaryDim:   "rgba(245,197,24,0.12)",
  primaryText:  "#92400E",
  border:       "#E5E7EB",
  borderPrimary:"rgba(245,197,24,0.5)",
  text:         "#1A1A1A",
  textMuted:    "#6B7280",
  textSub:      "#9CA3AF",
  red:          "#DC2626",
  redDim:       "rgba(220,38,38,0.06)",
  green:        "#16A34A",
  greenDim:     "rgba(22,163,74,0.06)",
  shadow:       "0 2px 12px rgba(0,0,0,0.08)",
  shadowMd:     "0 4px 24px rgba(0,0,0,0.12)",
};

const card = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  boxShadow: C.shadow,
};

const inputStyle = {
  width: "100%",
  background: C.surface,
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
  fontWeight: 600,
  color: C.textMuted,
  marginBottom: 6,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
};

function fmt(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function downloadB64(b64, filename) {
  const bytes = atob(b64);
  const ab = new ArrayBuffer(bytes.length);
  const view = new Uint8Array(ab);
  for (let i = 0; i < bytes.length; i++) view[i] = bytes.charCodeAt(i);
  const blob = new Blob([ab], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Footer ─────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{
      textAlign: "center",
      padding: "20px 16px",
      color: C.textSub,
      fontSize: 13,
      borderTop: `1px solid ${C.border}`,
      marginTop: 48,
    }}>
      Creado por ISM Consulting
    </footer>
  );
}

// ── Btn ────────────────────────────────────────────────────────────────────
function Btn({ children, onClick, disabled, variant = "primary", style: extraStyle = {}, type = "button" }) {
  const base = {
    border: "none",
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 15,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s",
    padding: "11px 24px",
    opacity: disabled ? 0.5 : 1,
  };
  const variants = {
    primary: { background: C.primary, color: C.text },
    ghost:   { background: "transparent", color: C.text, border: `1px solid ${C.border}` },
    danger:  { background: "transparent", color: C.red, border: `1px solid rgba(220,38,38,0.3)` },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...extraStyle }}>
      {children}
    </button>
  );
}

// ── MetricCard ─────────────────────────────────────────────────────────────
function MetricCard({ label, value, color, sub }) {
  const cardColor = color || (value >= 0 ? C.green : C.red);
  return (
    <div style={{
      ...card,
      padding: "24px 28px",
      flex: 1,
      minWidth: 180,
      textAlign: "center",
      borderTop: `3px solid ${cardColor}`,
    }}>
      <div style={{ fontSize: 12, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: cardColor }}>{fmt(value)}</div>
      {sub && <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>{sub}</div>}
    </div>
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
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Invalid credentials"); }
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
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ ...card, padding: "48px 40px", width: "100%", maxWidth: 420 }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>⚖️</div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: C.text }}>
              ISM <span style={{ color: C.primary }}>Taxes</span>
            </h1>
            <p style={{ margin: "8px 0 0", color: C.textMuted, fontSize: 15 }}>
              Tax Categorization Platform
            </p>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com" required autoComplete="username" />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={labelStyle}>Password</label>
              <input style={inputStyle} type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password" />
            </div>
            {error && (
              <div style={{ background: C.redDim, border: `1px solid rgba(220,38,38,0.3)`, borderRadius: 10, padding: "10px 14px", marginBottom: 20, color: C.red, fontSize: 14 }}>
                {error}
              </div>
            )}
            <Btn type="submit" style={{ width: "100%" }} disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Btn>
          </form>
        </div>
      </div>
      <Footer />
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
  const [editUser, setEditUser] = useState(null);
  const [editMsg, setEditMsg]   = useState("");
  const [editErr, setEditErr]   = useState("");

  const loadUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/users`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json());
    } catch {}
  };

  useEffect(() => { loadUsers(); }, []);

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
      setMsg(`Usuario ${newEmail} creado exitosamente`);
      setNewEmail(""); setNewPwd("");
      loadUsers();
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  };

  const deleteUser = async (email) => {
    if (!confirm(`¿Eliminar usuario ${email}?`)) return;
    try {
      const res = await fetch(`${API_URL}/auth/users/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      loadUsers();
    } catch (e) { alert(e.message); }
  };

  const toggleActive = async (u) => {
    try {
      const res = await fetch(`${API_URL}/auth/users/${encodeURIComponent(u.email)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !u.active }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      loadUsers();
    } catch (e) { alert(e.message); }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setEditMsg(""); setEditErr("");
    try {
      const body = {};
      if (editUser.newPwd) body.password = editUser.newPwd;
      if (editUser.newEmail && editUser.newEmail !== editUser.email) body.new_email = editUser.newEmail;
      const res = await fetch(`${API_URL}/auth/users/${encodeURIComponent(editUser.email)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
      setEditUser(null);
      loadUsers();
    } catch (e) { setEditErr(e.message); }
  };

  const thStyle = {
    padding: "11px 16px", textAlign: "left", fontSize: 12, color: C.textMuted,
    fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
    borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt, whiteSpace: "nowrap",
  };
  const tdStyle = {
    padding: "12px 16px", fontSize: 14, color: C.text,
    borderBottom: `1px solid ${C.border}`, verticalAlign: "middle",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      zIndex: 1000, padding: "32px 16px", overflowY: "auto",
    }}>
      <div style={{ ...card, width: "100%", maxWidth: 900, boxShadow: C.shadowMd, marginBottom: 32 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 28px", borderBottom: `1px solid ${C.border}` }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text }}>Panel de Administrador</h2>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: C.textMuted }}>Gestión de usuarios del sistema</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 26, cursor: "pointer", lineHeight: 1, padding: "4px 8px" }}>×</button>
        </div>

        <div style={{ padding: "24px 28px" }}>

          {/* Create User */}
          <div style={{ background: C.surfaceAlt, borderRadius: 12, padding: 20, marginBottom: 28, border: `1px solid ${C.border}` }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: "0.04em" }}>Crear nuevo usuario</h3>
            <form onSubmit={createUser}>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: 2, minWidth: 180 }}>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="usuario@email.com" required />
                </div>
                <div style={{ flex: 2, minWidth: 180 }}>
                  <label style={labelStyle}>Password temporal</label>
                  <input style={inputStyle} type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="••••••••" required />
                </div>
                <div>
                  <Btn type="submit" disabled={loading}>{loading ? "Creando…" : "Crear usuario"}</Btn>
                </div>
              </div>
              {msg && <div style={{ marginTop: 10, color: C.green, fontSize: 14 }}>{msg}</div>}
              {err && <div style={{ marginTop: 10, color: C.red, fontSize: 14 }}>{err}</div>}
            </form>
          </div>

          {/* Edit inline */}
          {editUser && (
            <div style={{ background: "#FFFBEB", border: `1px solid ${C.borderPrimary}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: C.primaryText }}>Editar: {editUser.email}</h3>
              <form onSubmit={saveEdit}>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: 2, minWidth: 180 }}>
                    <label style={labelStyle}>Nuevo email</label>
                    <input style={inputStyle} type="email" value={editUser.newEmail}
                      onChange={e => setEditUser(u => ({ ...u, newEmail: e.target.value }))} />
                  </div>
                  <div style={{ flex: 2, minWidth: 180 }}>
                    <label style={labelStyle}>Nueva password</label>
                    <input style={inputStyle} type="password" value={editUser.newPwd}
                      onChange={e => setEditUser(u => ({ ...u, newPwd: e.target.value }))}
                      placeholder="Dejar vacío para no cambiar" />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn type="submit">Guardar</Btn>
                    <Btn variant="ghost" onClick={() => setEditUser(null)}>Cancelar</Btn>
                  </div>
                </div>
                {editErr && <div style={{ marginTop: 10, color: C.red, fontSize: 14 }}>{editErr}</div>}
              </form>
            </div>
          )}

          {/* Users Table */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Usuarios {users && <span style={{ color: C.textMuted, fontWeight: 400, textTransform: "none" }}>({users.length})</span>}
            </h3>
            <button onClick={loadUsers} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 13, cursor: "pointer" }}>↻ Actualizar</button>
          </div>

          {users === null ? (
            <div style={{ color: C.textMuted, padding: "32px", textAlign: "center" }}>Cargando…</div>
          ) : (
            <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${C.border}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Rol</th>
                    <th style={thStyle}>Creado</th>
                    <th style={thStyle}>Último login</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Reportes</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Estado</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.email} style={{ opacity: u.active ? 1 : 0.55 }}>
                      <td style={tdStyle}><span style={{ fontWeight: 500 }}>{u.email}</span></td>
                      <td style={tdStyle}>
                        <span style={{
                          background: u.role === "admin" ? C.primaryDim : "#F3F4F6",
                          color: u.role === "admin" ? C.primaryText : C.textMuted,
                          padding: "3px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                        }}>{u.role}</span>
                      </td>
                      <td style={{ ...tdStyle, color: C.textMuted, fontSize: 13 }}>{fmtDate(u.created_at)}</td>
                      <td style={{ ...tdStyle, color: C.textMuted, fontSize: 13 }}>{fmtDate(u.last_login)}</td>
                      <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>{u.report_count || 0}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <button onClick={() => toggleActive(u)} style={{
                          background: u.active ? "#DCFCE7" : "#FEE2E2",
                          color: u.active ? C.green : C.red,
                          border: "none", borderRadius: 20, padding: "4px 12px",
                          fontSize: 12, fontWeight: 600, cursor: "pointer",
                        }}>
                          {u.active ? "Activo" : "Inactivo"}
                        </button>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button
                            onClick={() => { setEditUser({ email: u.email, newEmail: u.email, newPwd: "" }); setEditMsg(""); setEditErr(""); }}
                            style={{ background: C.primaryDim, border: "none", borderRadius: 6, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: C.primaryText }}
                          >Editar</button>
                          <button
                            onClick={() => deleteUser(u.email)}
                            style={{ background: C.redDim, border: "none", borderRadius: 6, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: C.red }}
                          >Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        <MetricCard label="Total Income" value={total_income} color={C.green} />
        <MetricCard label="Total Expenses" value={-total_expenses} color={C.red} />
        <MetricCard label="Net" value={net} sub={net >= 0 ? "Surplus" : "Deficit"} />
      </div>

      <div style={{ ...card, overflow: "hidden", marginBottom: 24 }}>
        <div style={{
          padding: "16px 24px", borderBottom: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: C.surfaceAlt,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Expense Breakdown by Category</span>
          <span style={{ fontSize: 13, color: C.textMuted }}>{categories.length} categories</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.surfaceAlt }}>
                <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 12, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${C.border}` }}>Category</th>
                <th style={{ padding: "12px 24px", textAlign: "right", fontSize: 12, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${C.border}` }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, i) => (
                <tr key={cat.category} style={{ background: i % 2 === 0 ? C.surface : C.surfaceAlt }}>
                  <td style={{ padding: "13px 24px", fontSize: 15, color: C.text, borderBottom: `1px solid ${C.border}` }}>{cat.category}</td>
                  <td style={{ padding: "13px 24px", fontSize: 15, fontWeight: 500, color: C.text, textAlign: "right", borderBottom: `1px solid ${C.border}` }}>{fmt(cat.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: C.primaryDim, borderTop: `2px solid ${C.borderPrimary}` }}>
                <td style={{ padding: "14px 24px", fontSize: 15, fontWeight: 700, color: C.primaryText, textTransform: "uppercase", letterSpacing: "0.04em" }}>Total Expenses</td>
                <td style={{ padding: "14px 24px", fontSize: 16, fontWeight: 700, color: C.primaryText, textAlign: "right" }}>{fmt(total_expenses)}</td>
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
  const [notes, setNotes]             = useState("");
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
      fd.append("notes", notes);
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
        <input style={inputStyle} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Corp LLC" required />
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={labelStyle}>Fiscal Year</label>
          <select style={selectStyle} value={year} onChange={e => setYear(e.target.value)}>
            {YEARS.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ flex: 3, minWidth: 200 }}>
          <label style={labelStyle}>Industry</label>
          <select style={selectStyle} value={industry} onChange={e => setIndustry(e.target.value)}>
            {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Entity Type</label>
        <select style={selectStyle} value={entity} onChange={e => setEntity(e.target.value)}>
          {ENTITIES.map(en => <option key={en}>{en}</option>)}
        </select>
      </div>

      {/* Novedades del año */}
      <div style={{
        marginBottom: 24,
        background: "#FFFBEB",
        border: `1px solid ${C.borderPrimary}`,
        borderRadius: 12,
        padding: "18px 18px 14px",
      }}>
        <label style={{ ...labelStyle, color: C.primaryText, marginBottom: 2 }}>
          ¿Hubo gastos importantes este año?
        </label>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "#B45309", lineHeight: 1.5 }}>
          Cuéntanos brevemente: compras de vehículos, equipos, propiedades, etc.
        </p>
        <textarea
          style={{
            ...inputStyle,
            minHeight: 88,
            resize: "vertical",
            fontFamily: "inherit",
            lineHeight: 1.55,
          }}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Ej: Compré una camioneta en marzo por $45,000 y un equipo de computación por $3,200..."
        />
      </div>

      <div style={{ marginBottom: 28 }}>
        <label style={labelStyle}>Bank Statement</label>
        <label
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 10, padding: "32px 20px", cursor: "pointer",
            border: `2px dashed ${dragging ? C.primary : file ? C.borderPrimary : C.border}`,
            borderRadius: 12,
            background: dragging ? C.primaryDim : file ? "#FFFBEB" : C.surfaceAlt,
            transition: "all 0.2s",
          }}
        >
          <input type="file" accept=".xlsx,.xls,.csv,.pdf" style={{ display: "none" }} onChange={e => setFile(e.target.files[0])} />
          <span style={{ fontSize: 28 }}>{file ? "📄" : "⬆️"}</span>
          <span style={{ color: file ? C.primaryText : C.textSub, fontSize: 15, fontWeight: 500 }}>
            {file ? file.name : "Drop file here or click to browse"}
          </span>
          <span style={{ fontSize: 13, color: C.textMuted }}>
            {file ? `${(file.size / 1024).toFixed(1)} KB` : ".xlsx · .xls · .csv · .pdf"}
          </span>
        </label>
      </div>

      {error && (
        <div style={{ background: C.redDim, border: `1px solid rgba(220,38,38,0.3)`, borderRadius: 10, padding: "10px 14px", marginBottom: 20, color: C.red, fontSize: 14 }}>
          {error}
        </div>
      )}

      <Btn type="submit" style={{ width: "100%" }} disabled={loading}>
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
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter','Segoe UI',sans-serif", fontSize: 16, display: "flex", flexDirection: "column" }}>

      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        borderBottom: `1px solid ${C.border}`,
        background: C.surface, boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        padding: "0 32px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚖️</span>
          <span style={{ fontWeight: 800, fontSize: 20 }}>
            ISM <span style={{ color: C.primary }}>Taxes</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {user.role === "admin" && (
            <button onClick={() => setShowAdmin(true)} style={{
              background: C.primaryDim, border: `1px solid ${C.borderPrimary}`,
              color: C.primaryText, borderRadius: 8, padding: "6px 14px",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>⚙ Admin</button>
          )}
          <span style={{ fontSize: 13, color: C.textMuted }}>{user.email}</span>
          <Btn variant="ghost" onClick={handleLogout} style={{ padding: "7px 16px", fontSize: 13 }}>Sign Out</Btn>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", width: "100%", flex: 1 }}>
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
                IRS Tax <span style={{ color: C.primary }}>Categorization</span>
              </h1>
              <p style={{ margin: "12px 0 0", color: C.textMuted, fontSize: 17, lineHeight: 1.6 }}>
                Upload your bank statement and get a fully categorized expense report in seconds.
              </p>
            </div>
            <div style={{ ...card, padding: "36px 32px" }}>
              <ClassifyForm token={token} onResult={(data, cn, yr) => setResult({ ...data, companyName: cn, year: yr })} />
            </div>
          </>
        )}
      </main>

      <Footer />

      {showAdmin && <AdminPanel token={token} onClose={() => setShowAdmin(false)} />}

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #FFFFFF; }
        input::placeholder { color: #9CA3AF; }
        textarea::placeholder { color: #9CA3AF; }
        select option { background: #FFFFFF; color: #1A1A1A; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 3px; }
      `}</style>
    </div>
  );
}
