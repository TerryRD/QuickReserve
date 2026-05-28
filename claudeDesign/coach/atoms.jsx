// coach/atoms.jsx — coach-app primitives (loaded AFTER student/atoms.jsx so it
// can lean on its icons, buttons, cards, dummy COACH/STUDENT, etc.)

// ─── Coach-side dummy data ──────────────────────────────────────
const ASSISTANT = { name: "黃彥君", initial: "黃", role: "Staff" };

const COACH_KPIS = {
  pendingThisWeek: 3,
  confirmedThisWeek: 12,
  packagesAwait: 4,
  newStudentsThisMonth: 2,
};

const TODAY_BOOKINGS = [
  { time: "09:00", student: "張采妮", service: "一對一肌力", coach: "陳柏宇", status: "confirmed" },
  { time: "10:30", student: "林書豪", service: "體態評估與諮詢", coach: "陳柏宇", status: "confirmed" },
  { time: "14:00", student: "雙人 / 王怡靜 + 陳威翰", service: "雙人課程", coach: "陳柏宇", status: "confirmed", group: { filled: 2, capacity: 4 } },
  { time: "16:00", student: "李雅文", service: "一對一肌力", coach: "陳柏宇", status: "confirmed" },
  { time: "19:00", student: "吳哲銘", service: "一對一肌力", coach: "黃彥君", status: "confirmed" },
];

const PENDING_BK = [
  { id: "pb1", student: "李雅文",   email: "yawen@x.com", service: "一對一肌力", date: "8/22 五", time: "10:00", duration: 60, since: "2 小時前", note: "用 10 堂套裝扣 1 堂" },
  { id: "pb2", student: "周宇翔",   email: "yuxiang@x.com", service: "雙人課程", date: "8/24 日", time: "15:00", duration: 60, since: "今天 09:14", note: "需湊一位夥伴、若無則改一對一" },
  { id: "pb3", student: "蔡淑芬",   email: "shufen@x.com", service: "體態評估", date: "8/25 一", time: "14:00", duration: 90, since: "昨天 18:42", note: "" },
];

const CUSTOMERS = [
  { id: "c1", name: "李雅文",  email: "yawen.lee@example.com",  bookings: 18, balance: 7,  lastSeen: "2026-08-19", status: "active" },
  { id: "c2", name: "張采妮",  email: "tsaini.chang@example.com", bookings: 24, balance: 12, lastSeen: "2026-08-19", status: "active" },
  { id: "c3", name: "林書豪",  email: "shuhao.lin@example.com",  bookings: 6,  balance: 0,  lastSeen: "2026-08-12", status: "active" },
  { id: "c4", name: "周宇翔",  email: "yuxiang.chou@example.com", bookings: 2,  balance: 0,  lastSeen: "2026-08-05", status: "new" },
  { id: "c5", name: "吳哲銘",  email: "zheming.wu@example.com",  bookings: 32, balance: 4,  lastSeen: "2026-08-18", status: "active" },
  { id: "c6", name: "蔡淑芬",  email: "shufen.tsai@example.com", bookings: 0,  balance: 0,  lastSeen: "—",          status: "new" },
  { id: "c7", name: "王怡靜",  email: "yijing.wang@example.com", bookings: 11, balance: 3,  lastSeen: "2026-08-14", status: "active" },
];

const COACH_SERVICES = [
  { id: "s1", name: "一對一肌力訓練", desc: "依個人需求設計動作組合、著重姿勢矯正與循序加重。", duration: 60, price: 2000, capacity: 1, minAttend: 1, cancelHrs: 24, active: 12 },
  { id: "s2", name: "雙人課程",       desc: "兩人共同訓練、分擔費用、保持規律。",                duration: 60, price: 1400, capacity: 2, minAttend: 2, cancelHrs: 24, active: 4 },
  { id: "s3", name: "團班・週末晨間", desc: "週六早上 4 人團班、入門到中階肌力課表。",            duration: 75, price: 800,  capacity: 4, minAttend: 2, cancelHrs: 48, active: 8 },
  { id: "s4", name: "體態評估與諮詢",  desc: "首次客戶建議方案。量測體態、動作篩檢、訓練建議。",   duration: 90, price: 1800, capacity: 1, minAttend: 1, cancelHrs: 24, active: 2 },
  { id: "s5", name: "線上諮詢",       desc: "Google Meet 視訊、適合異地或無法到場的學員。",        duration: 45, price: 1200, capacity: 1, minAttend: 1, cancelHrs: 12, active: 1 },
];

const COACH_PACKAGES = [
  { id: "p1", serviceId: "s1", name: "10 堂套裝",  lessons: 10, expiry: "90 天",  price: 18000, holders: 12 },
  { id: "p2", serviceId: "s1", name: "20 堂套裝",  lessons: 20, expiry: "180 天", price: 33000, holders: 8, popular: true },
  { id: "p3", serviceId: "s2", name: "雙人 10 堂", lessons: 10, expiry: "永久",   price: 13000, holders: 4 },
  { id: "p4", serviceId: "s3", name: "團班 12 堂", lessons: 12, expiry: "120 天", price: 9000,  holders: 14 },
  { id: "p5", serviceId: "s4", name: "體態評估單堂", lessons: 1,  expiry: "30 天",  price: 1800,  holders: 3 },
];

const PENDING_PKG = [
  { id: "pp1", student: "李雅文", email: "yawen@x.com", pkgName: "20 堂套裝", lessons: 20, price: 33000, payState: "已轉帳", since: "今天 10:24", note: "末五碼 24913 · 8/19 上午轉帳" },
  { id: "pp2", student: "周宇翔", email: "yuxiang@x.com", pkgName: "雙人 10 堂", lessons: 10, price: 13000, payState: "現場付款", since: "昨天 18:11", note: "預計下週一上課現場給" },
  { id: "pp3", student: "蔡淑芬", email: "shufen@x.com", pkgName: "體態評估單堂", lessons: 1, price: 1800, payState: "未付款", since: "8/17 14:02", note: "等課表確認再付" },
];

const NOTIFICATIONS = [
  { id: "n1", kind: "new",     unread: true,  title: "新預約申請 · 李雅文 · 8/22 10:00", body: "服務：一對一肌力 · 60 分鐘", t: "5 分鐘前" },
  { id: "n2", kind: "package", unread: true,  title: "套裝申請 · 周宇翔 · 雙人 10 堂", body: "現場付款 · NT$ 13,000", t: "12 分鐘前" },
  { id: "n3", kind: "cancel",  unread: true,  title: "預約取消 · 林書豪 · 8/12 14:00", body: "24 小時內取消、不退堂數", t: "今天 09:14" },
  { id: "n4", kind: "confirm", unread: false, title: "預約確認 · 雙人 / 王怡靜 + 陳威翰 · 8/19 14:00", body: "你今早核可這筆預約", t: "昨天 18:30" },
  { id: "n5", kind: "resched", unread: false, title: "改期 · 吳哲銘 · 8/14 → 8/18 19:00", body: "原時段釋出、新時段需教練再確認", t: "昨天 11:02" },
  { id: "n6", kind: "digest",  unread: false, title: "每日 07:00 預覽 · 8/19 (二)", body: "今日 5 堂預約 · 1 堂團班 (2/4)", t: "今天 07:00" },
];

// ─── Extra icons we need on the coach side ────────────────────
const Grid     = (p) => <I {...p} d={<><rect x="3" y="3"  width="7" height="7" rx="1"/><rect x="14" y="3"  width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>} />;
const Box      = (p) => <I {...p} d={<><path d="M3 7v10l9 4 9-4V7l-9-4z"/><path d="m3 7 9 4 9-4"/><path d="M12 11v10"/></>} />;
const Layers   = (p) => <I {...p} d={<><path d="m12 3-9 5 9 5 9-5z"/><path d="m3 13 9 5 9-5"/><path d="m3 18 9 5 9-5"/></>} />;
const Bell     = (p) => <I {...p} d={<><path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3z"/><path d="M10 21a2 2 0 0 0 4 0"/></>} />;
const Cog      = (p) => <I {...p} d={<><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.18-1.5l2-1.5-2-3.5-2.4 1A7 7 0 0 0 14 4.3L13.6 2h-3.2L10 4.3a7 7 0 0 0-2.4 1.2L5.2 4.5l-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .5.06 1 .18 1.5l-2 1.5 2 3.5 2.4-1c.7.5 1.5.9 2.4 1.2l.4 2.3h3.2l.4-2.3c.9-.3 1.7-.7 2.4-1.2l2.4 1 2-3.5-2-1.5c.12-.5.18-1 .18-1.5z"/></>} />;
const Sun      = (p) => <I {...p} d={<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>} />;
const Moon     = (p) => <I {...p} d={<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>} />;
const MoreV    = (p) => <I {...p} d={<><circle cx="12" cy="5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/></>} />;
const Edit     = (p) => <I {...p} d={<><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 3 22l1.5-4.5z"/><path d="M15 5l4 4"/></>} />;
const Trash    = (p) => <I {...p} d={<><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M19 7v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7"/><path d="M10 11v6M14 11v6"/></>} />;
const Search   = (p) => <I {...p} d={<><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>} />;
const Users    = (p) => <I {...p} d={<><circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0 1 14 0"/><circle cx="17" cy="6" r="2.5"/><path d="M22 19a5 5 0 0 0-5-5"/></>} />;
const Logout   = (p) => <I {...p} d={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></>} />;
const Hash     = (p) => <I {...p} d={<><path d="M5 9h14M5 15h14M10 3 8 21M16 3l-2 18"/></>} />;
const Sparkle  = (p) => <I {...p} d={<><path d="M12 4v6"/><path d="M12 14v6"/><path d="M4 12h6"/><path d="M14 12h6"/></>} />;

// ─── Sidebar ───────────────────────────────────────────────────
const SIDE_NAV = [
  { id: "dashboard",   icon: <Grid    size={16} />, label: "Dashboard", zh: "總覽" },
  { id: "calendar",    icon: <Calendar size={16} />, label: "Calendar",  zh: "行事曆" },
  { id: "customers",   icon: <Users   size={16} />, label: "Customers", zh: "學員" },
  { id: "services",    icon: <Box     size={16} />, label: "Services",  zh: "服務" },
  { id: "packages",    icon: <Layers  size={16} />, label: "Packages",  zh: "套裝", badge: 3 },
  { id: "notifications",icon:<Bell    size={16} />, label: "Notifications", zh: "通知", badge: 3, dot: true },
];
const SIDE_NAV_BOTTOM = [
  { id: "settings",    icon: <Cog size={16} />,  label: "Settings", zh: "設定" },
];

function Sidebar({ active = "dashboard", state = "expanded" /* expanded / collapsed / drawer */ }) {
  const isCollapsed = state === "collapsed";
  const isDrawer = state === "drawer";
  const w = isCollapsed ? 76 : 260;
  const fontSize = 13;

  return (
    <aside style={{
      flexShrink: 0,
      width: isDrawer ? 280 : w,
      height: "100%",
      background: "var(--sidebar)", color: "var(--sidebar-foreground)",
      borderRight: "1px solid var(--sidebar-border)",
      display: "flex", flexDirection: "column",
      ...(isDrawer ? { position: "absolute", left: 0, top: 0, zIndex: 10, boxShadow: "12px 0 36px -16px rgba(0,0,0,.35)" } : {}),
    }}>
      {/* brand */}
      <div style={{
        padding: isCollapsed ? "16px 14px" : "16px 18px",
        display: "flex", alignItems: "center", gap: 12,
        borderBottom: "1px solid var(--sidebar-border)",
      }}>
        <QRMark size={32} />
        {!isCollapsed && (
          <div style={{ lineHeight: 1, minWidth: 0 }}>
            <div className="display" style={{ fontSize: 15, fontWeight: 400, letterSpacing: ".01em", textTransform: "uppercase" }}>QuickReserve</div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-foreground)", letterSpacing: ".12em", marginTop: 3 }}>
              /{COACH.slug}
            </div>
          </div>
        )}
      </div>

      {/* coach card */}
      <div style={{
        padding: isCollapsed ? "16px 14px" : "16px 18px",
        borderBottom: "1px solid var(--sidebar-border)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <Avatar size={isCollapsed ? 36 : 40} initial="陳" />
        {!isCollapsed && (
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="cjk" style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {COACH.name}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
              <span className="mono" style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em",
                padding: "2px 7px", borderRadius: 999,
                background: "var(--accent)", color: "var(--accent-foreground)",
              }}>OWNER</span>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted-foreground)", letterSpacing: ".06em" }}>
                · {COACH.yearsExp}y
              </span>
            </div>
          </div>
        )}
      </div>

      {/* nav */}
      <nav style={{ flex: 1, padding: isCollapsed ? "12px 10px" : "12px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        {!isCollapsed && (
          <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-foreground)", letterSpacing: ".18em", padding: "8px 8px 4px" }}>
            MAIN
          </div>
        )}
        {SIDE_NAV.map((it) => {
          const isActive = it.id === active;
          return (
            <button key={it.id} style={{
              ...BTN_BASE,
              justifyContent: "flex-start",
              height: 40, padding: isCollapsed ? 0 : "0 14px",
              borderRadius: 10,
              background: isActive ? "var(--sidebar-accent)" : "transparent",
              color: isActive ? "var(--sidebar-accent-foreground)" : "var(--sidebar-foreground)",
              gap: 12, fontWeight: isActive ? 600 : 500, fontSize: fontSize,
              position: "relative",
            }}>
              {isActive && !isCollapsed && (
                <span aria-hidden style={{
                  position: "absolute", left: 0, top: 8, bottom: 8, width: 3,
                  background: "var(--accent)", borderRadius: 999,
                }} />
              )}
              <span style={{ width: 24, display: "flex", justifyContent: "center", color: isActive ? "var(--foreground)" : "var(--muted-foreground)" }}>
                {it.icon}
              </span>
              {!isCollapsed && (
                <span style={{ flex: 1, textAlign: "left" }}>
                  <span className="cjk">{it.zh}</span>
                  <span className="mono" style={{ marginLeft: 8, fontSize: 9.5, color: "var(--muted-foreground)", letterSpacing: ".08em" }}>{it.label.toUpperCase()}</span>
                </span>
              )}
              {it.badge && (
                <span className="mono" style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 7px",
                  borderRadius: 999, background: "var(--accent)", color: "var(--accent-foreground)",
                  marginLeft: "auto",
                }}>{it.badge}</span>
              )}
              {isCollapsed && it.dot && (
                <span aria-hidden style={{
                  position: "absolute", top: 8, right: 8,
                  width: 8, height: 8, borderRadius: "50%", background: "var(--accent)",
                }} />
              )}
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        {!isCollapsed && (
          <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-foreground)", letterSpacing: ".18em", padding: "8px 8px 4px" }}>
            SETUP
          </div>
        )}
        {SIDE_NAV_BOTTOM.map((it) => {
          const isActive = it.id === active;
          return (
            <button key={it.id} style={{
              ...BTN_BASE,
              justifyContent: "flex-start",
              height: 40, padding: isCollapsed ? 0 : "0 14px",
              borderRadius: 10,
              background: isActive ? "var(--sidebar-accent)" : "transparent",
              color: "var(--sidebar-foreground)",
              gap: 12, fontWeight: 500, fontSize: fontSize,
            }}>
              <span style={{ width: 24, display: "flex", justifyContent: "center", color: "var(--muted-foreground)" }}>{it.icon}</span>
              {!isCollapsed && (
                <span style={{ flex: 1, textAlign: "left" }}>
                  <span className="cjk">{it.zh}</span>
                  <span className="mono" style={{ marginLeft: 8, fontSize: 9.5, color: "var(--muted-foreground)", letterSpacing: ".08em" }}>{it.label.toUpperCase()}</span>
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* footer: theme toggle + logout */}
      <div style={{
        padding: isCollapsed ? "12px 10px 14px" : "14px 14px 16px",
        borderTop: "1px solid var(--sidebar-border)",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {!isCollapsed ? (
          <div style={{
            display: "flex", padding: 3,
            background: "var(--secondary)", borderRadius: 999, gap: 2,
          }}>
            {[
              { id: "light", icon: <Sun size={14} />, label: "Light" },
              { id: "dark",  icon: <Moon size={14} />, label: "Dark" },
              { id: "sys",   icon: <Sparkle size={14} />, label: "Sys" },
            ].map((t, i) => {
              const isOn = i === 0;
              return (
                <button key={t.id} style={{
                  ...BTN_BASE,
                  flex: 1, height: 30, padding: "0 8px",
                  borderRadius: 999, fontSize: 11.5,
                  background: isOn ? "var(--background)" : "transparent",
                  color: isOn ? "var(--foreground)" : "var(--muted-foreground)",
                  boxShadow: isOn ? "0 1px 2px rgba(0,0,0,.08)" : "none",
                }}>{t.icon}<span className="mono" style={{ fontSize: 10, letterSpacing: ".05em" }}>{t.label}</span></button>
              );
            })}
          </div>
        ) : (
          <button style={{
            ...BTN_BASE,
            width: "100%", height: 36, borderRadius: 999,
            background: "var(--secondary)", color: "var(--foreground)",
          }}><Sun size={14} /></button>
        )}
        <button style={{
          ...BTN_BASE,
          height: 36, padding: isCollapsed ? 0 : "0 12px",
          borderRadius: 10,
          color: "var(--muted-foreground)", background: "transparent",
          justifyContent: "flex-start", gap: 10,
        }}>
          <span style={{ width: 24, display: "flex", justifyContent: "center" }}><Logout size={15} /></span>
          {!isCollapsed && <span className="cjk" style={{ fontSize: 12.5 }}>登出</span>}
        </button>
      </div>
    </aside>
  );
}

// ─── Mobile top bar (drawer trigger) ──────────────────────────
function MobileBar({ title, action }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px",
      borderBottom: "1px solid var(--border)",
      background: "var(--background)",
    }}>
      <button style={{
        ...BTN_BASE,
        width: 40, height: 40, borderRadius: 10,
        background: "var(--secondary)", color: "var(--foreground)",
      }}><Menu size={18} /></button>
      <QRMark size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="cjk display" style={{ fontSize: 14, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-foreground)", letterSpacing: ".12em" }}>QUICKRESERVE / COACH</div>
      </div>
      {action}
    </div>
  );
}

// ─── AppShell — wraps a page with sidebar + main column ───────
function AppShell({ active, size = "desktop", title, action, children, fullBleed, drawerOpen }) {
  const isMobile = size === "mobile";
  const isTablet = size === "tablet";
  const sidebarState = isMobile ? (drawerOpen ? "drawer" : "hidden") : isTablet ? "collapsed" : "expanded";

  return (
    <Mockup>
      <div style={{ flex: 1, display: "flex", minHeight: 0, position: "relative", overflow: "hidden" }}>
        {/* drawer backdrop */}
        {isMobile && drawerOpen && (
          <div aria-hidden onClick={() => {}} style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 9,
          }} />
        )}
        {(!isMobile || drawerOpen) && <Sidebar active={active} state={sidebarState} />}
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--background)" }}>
          {isMobile && <MobileBar title={title || ""} action={action} />}
          {fullBleed ? children : (
            <div style={{ padding: isMobile ? "20px" : "32px 40px", flex: 1 }}>{children}</div>
          )}
        </main>
      </div>
    </Mockup>
  );
}

// ─── Page header (used inside main column on most pages) ──────
function PageHeader({ kicker, title, eng, hint, action, size = "desktop" }) {
  const isMobile = size === "mobile";
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "flex-end",
      flexWrap: "wrap", gap: 16, marginBottom: isMobile ? 18 : 28,
    }}>
      <div style={{ minWidth: 0 }}>
        {kicker && (
          <div className="mono" style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 8 }}>
            {kicker}
          </div>
        )}
        <h1 className="display" style={{
          fontSize: isMobile ? 36 : 64, lineHeight: 0.95, margin: 0, fontWeight: 400,
          textTransform: "uppercase", letterSpacing: "-0.01em",
          display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap",
        }}>
          {title && <span className="cjk">{title}</span>}
          {eng && (
            <span style={{ position: "relative", display: "inline-block" }}>
              {eng}
              <span aria-hidden style={{
                position: "absolute", left: 0, right: 0, bottom: -2,
                height: 6, background: "var(--accent)", borderRadius: 6,
              }} />
            </span>
          )}
        </h1>
        {hint && <div className="cjk" style={{ marginTop: 12, fontSize: 13, color: "var(--muted-foreground)", maxWidth: 720 }}>{hint}</div>}
      </div>
      {action}
    </div>
  );
}

// ─── KPI card (small + big variant) ────────────────────────────
function KpiCard({ label, value, unit, hint, accent, icon }) {
  return (
    <div style={{
      padding: 20, background: "var(--card)",
      border: "1px solid var(--border)", borderRadius: 16,
      display: "flex", flexDirection: "column", gap: 8,
      position: "relative",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".15em" }}>{label}</span>
        {icon && (
          <span style={{
            width: 24, height: 24, borderRadius: 8,
            background: accent ? "var(--accent)" : "var(--secondary)",
            color: accent ? "var(--accent-foreground)" : "var(--muted-foreground)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{icon}</span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span className="display" style={{ fontSize: 44, lineHeight: 0.95, fontWeight: 400 }}>{value}</span>
        {unit && <span className="cjk" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{unit}</span>}
      </div>
      {hint && <div className="cjk" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{hint}</div>}
    </div>
  );
}

// ─── Tab bar (used by services & packages) ─────────────────────
function TabBar({ tabs, active, counts = {} }) {
  return (
    <div style={{
      display: "inline-flex", padding: 4,
      background: "var(--secondary)", borderRadius: 999,
      gap: 2, marginBottom: 24,
    }}>
      {tabs.map((t) => {
        const isOn = t.id === active;
        return (
          <button key={t.id} style={{
            ...BTN_BASE,
            height: 36, padding: "0 16px", borderRadius: 999,
            background: isOn ? "var(--background)" : "transparent",
            color: isOn ? "var(--foreground)" : "var(--muted-foreground)",
            fontWeight: isOn ? 600 : 500, fontSize: 13,
            boxShadow: isOn ? "0 1px 2px rgba(0,0,0,.08)" : "none",
          }}>
            <span className="cjk">{t.label}</span>
            {counts[t.id] != null && (
              <span className="mono" style={{
                fontSize: 10, padding: "1px 7px", borderRadius: 999,
                background: isOn ? "var(--secondary)" : "var(--card)",
                color: "var(--muted-foreground)",
              }}>{counts[t.id]}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  ASSISTANT, COACH_KPIS, TODAY_BOOKINGS, PENDING_BK, CUSTOMERS, COACH_SERVICES, COACH_PACKAGES, PENDING_PKG, NOTIFICATIONS,
  Grid, Box, Layers, Bell, Cog, Sun, Moon, MoreV, Edit, Trash, Search, Users, Logout, Hash, Sparkle,
  Sidebar, MobileBar, AppShell, PageHeader, KpiCard, TabBar,
});
