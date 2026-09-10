import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Plus, Settings, CreditCard, LogOut } from "lucide-react";
import { useAuthStore, useCurrentUser } from "@/stores/authStore";
import { Avatar } from "@/components/shared/Avatar";

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/projects/new", icon: Plus, label: "New Deck" },
  { to: "/settings", icon: Settings, label: "Settings" },
  { to: "/billing", icon: CreditCard, label: "Billing" },
];

const sidebarCss = `
.ipr-sidebar{
  width:244px; flex-shrink:0; display:flex; flex-direction:column;
  background:var(--glass-1);
  -webkit-backdrop-filter:var(--glass-blur-lg); backdrop-filter:var(--glass-blur-lg);
  border-right:1px solid var(--glass-edge);
  box-shadow:inset -1px 0 0 rgba(255,255,255,.05);
  height:100vh; max-height:100vh; position:sticky; top:0; align-self:flex-start;
}
.ipr-sidebar__logo{
  padding:24px 22px 20px; border-bottom:1px solid var(--glass-edge);
}
.ipr-sidebar__nav{
  flex:1; padding:16px 12px; display:flex; flex-direction:column; gap:3px;
  overflow-y:auto;
}
.ipr-nav-item{
  display:flex; align-items:center; gap:12px; padding:11px 13px;
  border-radius:var(--radius-md); border:1px solid transparent;
  background:transparent; color:var(--text-muted);
  font:600 14px var(--font-body); cursor:pointer;
  transition:var(--transition); width:100%; text-decoration:none;
}
.ipr-nav-item:hover{ background:var(--surface-hover); color:var(--text-strong); text-decoration:none; }
.ipr-nav-item--active{
  background:var(--clay-500); color:var(--text-on-brand);
  border-color:transparent; box-shadow:var(--clay-raise-sm);
}
.ipr-nav-item--active:hover{ background:var(--clay-400); color:var(--text-on-brand); }
.ipr-nav-dot{
  width:5px; height:16px; border-radius:999px;
  background:var(--text-on-brand); opacity:.55; margin-left:auto; flex-shrink:0;
}
.ipr-sidebar__user{
  margin:12px; padding:11px 12px; display:flex; align-items:center; gap:11px;
  border-radius:var(--radius-md); background:var(--surface-sunken);
  border:1px solid var(--glass-edge); box-shadow:var(--clay-inset);
}
.ipr-sidebar__username{
  font:600 12px var(--font-body); color:var(--text-strong);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.ipr-sidebar__plan{
  font:500 11px var(--font-body); color:var(--text-muted);
}
.ipr-logout-btn{
  border:0; background:none; color:var(--text-faint); cursor:pointer;
  display:inline-flex; padding:4px; flex-shrink:0;
  border-radius:var(--radius-sm); transition:var(--transition);
}
.ipr-logout-btn:hover{ color:var(--danger); background:var(--danger-surface); }
`;

function useInjectSidebar() {
  if (typeof document !== "undefined" && !document.getElementById("ipr-sidebar-css")) {
    const s = document.createElement("style");
    s.id = "ipr-sidebar-css";
    s.textContent = sidebarCss;
    document.head.appendChild(s);
  }
}

export function DashboardLayout() {
  useInjectSidebar();
  const user = useCurrentUser();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "transparent" }}>
      {/* ── Sidebar ── */}
      <aside className="ipr-sidebar">
        <div className="ipr-sidebar__logo">
          <img src="/ipreneur-logo.webp" alt="iPreneur" style={{ width: 124 }} />
        </div>

        <nav className="ipr-sidebar__nav">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to !== "/projects/new"}
              className={({ isActive }) =>
                "ipr-nav-item" + (isActive ? " ipr-nav-item--active" : "")
              }
            >
              <Icon size={18} />
              <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
              {/* active dot handled by CSS via :is(.ipr-nav-item--active) */}
            </NavLink>
          ))}
        </nav>

        <div className="ipr-sidebar__user">
          <Avatar name={user?.name || "U"} size="sm" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ipr-sidebar__username">{user?.name || "User"}</div>
            <div className="ipr-sidebar__plan">{user?.role || "free"}</div>
          </div>
          <button onClick={handleLogout} title="Sign out" className="ipr-logout-btn">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
