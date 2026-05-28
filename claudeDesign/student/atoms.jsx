// student/atoms.jsx — shared primitives for the student-experience deliverable.
// Self-contained: icons + QR mark + buttons + cards + dummy data are all
// defined here so a page component only has to import this file.

const COACH = {
  name: "陳柏宇",
  slug: "coach-poyu",
  title: "Coach Po-Yu Chen",
  subtitle: "專注一對一肌力訓練・幫助你建立可持續的運動習慣",
  email: "poyu.chen@quickreserve.app",
  phone: "0912-345-678",
  line: "@poyu-coach",
  city: "台北・內湖工作室",
  yearsExp: 7,
};

const STUDENT = {
  name: "李雅文",
  email: "yawen.lee@example.com",
  initial: "雅",
};

const SERVICES = [
  { id: "s1", name: "一對一肌力訓練", desc: "依個人需求設計動作組合，著重姿勢矯正與循序加重。", duration: 60, price: 2000 },
  { id: "s2", name: "雙人課程",       desc: "兩人共同訓練，分擔費用、保持規律。",       duration: 60, price: 1400, perPerson: true },
  { id: "s3", name: "體態評估與諮詢",  desc: "首次客戶建議方案。量測體態、動作篩檢、訓練建議。", duration: 90, price: 1800 },
];

const PACKAGES = [
  { id: "p1", serviceId: "s1", name: "10 堂套裝", lessons: 10, expiry: "90 天內上完", price: 18000, perLesson: 1800 },
  { id: "p2", serviceId: "s1", name: "20 堂套裝", lessons: 20, expiry: "180 天內上完", price: 33000, perLesson: 1650, popular: true },
  { id: "p3", serviceId: "s2", name: "雙人 10 堂", lessons: 10, expiry: "永久有效",   price: 13000, perLesson: 1300 },
  { id: "p4", serviceId: "s3", name: "體態評估單堂", lessons: 1,  expiry: "30 天內使用", price: 1800,  perLesson: 1800 },
];

// Dates Sat 8/16 → Fri 8/22 (mock current week)
const DATES = [
  { d: "8/16", w: "六", date: "2026-08-16", count: 0 },
  { d: "8/17", w: "日", date: "2026-08-17", count: 0 },
  { d: "8/18", w: "一", date: "2026-08-18", count: 5 },
  { d: "8/19", w: "二", date: "2026-08-19", count: 4, isToday: true },
  { d: "8/20", w: "三", date: "2026-08-20", count: 3 },
  { d: "8/21", w: "四", date: "2026-08-21", count: 6 },
  { d: "8/22", w: "五", date: "2026-08-22", count: 2 },
];

const SLOTS = [
  { t: "08:00", state: "open" },
  { t: "09:00", state: "full" },
  { t: "10:00", state: "open" },
  { t: "11:00", state: "open" },
  { t: "14:00", state: "group", filled: 2, capacity: 4 },
  { t: "15:00", state: "open" },
  { t: "16:00", state: "selected" },
  { t: "17:00", state: "open" },
  { t: "19:00", state: "full" },
  { t: "20:00", state: "open" },
];

const MY_BOOKINGS = [
  { id: "b1", group: "今日", coach: "陳柏宇", service: "一對一肌力訓練", date: "2026-08-19", time: "16:00", duration: 60, status: "confirmed", canCancel: true, canReschedule: true },
  { id: "b2", group: "本週", coach: "陳柏宇", service: "一對一肌力訓練", date: "2026-08-22", time: "10:00", duration: 60, status: "pending",  canCancel: true, canReschedule: false },
  { id: "b3", group: "之後", coach: "林書豪", service: "瑜伽私人課",     date: "2026-08-28", time: "19:30", duration: 75, status: "confirmed", canCancel: true, canReschedule: true },
  { id: "b4", group: "之後", coach: "陳柏宇", service: "一對一肌力訓練", date: "2026-09-02", time: "16:00", duration: 60, status: "confirmed", canCancel: true, canReschedule: true },
  { id: "b5", group: "已過", coach: "陳柏宇", service: "體態評估與諮詢", date: "2026-08-12", time: "14:00", duration: 90, status: "completed", canCancel: false, canReschedule: false },
  { id: "b6", group: "已過", coach: "陳柏宇", service: "一對一肌力訓練", date: "2026-08-05", time: "16:00", duration: 60, status: "cancelled", canCancel: false, canReschedule: false },
];

const MY_PACKAGES = [
  { name: "10 堂套裝・一對一肌力訓練", remaining: 6, total: 10, expiresAt: "2026-10-15" },
  { name: "體態評估單堂", remaining: 1, total: 1, expiresAt: "2026-09-12" },
];

// ─── Icons ─────────────────────────────────────────────────────
const I = ({ d, size = 16, sw = 1.7 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ flexShrink: 0 }}>{d}</svg>
);
const Mail   = (p) => <I {...p} d={<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>} />;
const Phone  = (p) => <I {...p} d={<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>} />;
const Chat   = (p) => <I {...p} d={<path d="M21 12a8 8 0 0 1-12.5 6.6L4 20l1.4-4.5A8 8 0 1 1 21 12z"/>} />;
const Pin    = (p) => <I {...p} d={<><path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></>} />;
const Arrow  = (p) => <I {...p} d={<><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>} />;
const ArrowL = (p) => <I {...p} d={<><path d="M19 12H5"/><path d="m11 6-6 6 6 6"/></>} />;
const Clock  = (p) => <I {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />;
const Calendar=(p) => <I {...p} d={<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>} />;
const Check  = (p) => <I {...p} d={<path d="m5 13 4 4L19 7"/>} />;
const X      = (p) => <I {...p} d={<><path d="M6 6l12 12"/><path d="M6 18 18 6"/></>} />;
const Play   = (p) => <I {...p} d={<path d="M7 5v14l12-7z" fill="currentColor"/>} />;
const User   = (p) => <I {...p} d={<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>} />;
const Menu   = (p) => <I {...p} d={<><path d="M4 7h16M4 12h16M4 17h16"/></>} />;
const Filter = (p) => <I {...p} d={<path d="M4 5h16l-6 8v6l-4-2v-4z"/>} />;
const Star   = (p) => <I {...p} d={<path d="m12 3 2.7 5.7 6.3.9-4.6 4.5 1.1 6.3L12 17.4l-5.6 3 1.1-6.3L3 9.6l6.3-.9z" fill="currentColor"/>} />;
const Info   = (p) => <I {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></>} />;
const Alert  = (p) => <I {...p} d={<><path d="M12 3 2 21h20z"/><path d="M12 10v4M12 18h.01"/></>} />;
const Plus   = (p) => <I {...p} d={<><path d="M12 5v14M5 12h14"/></>} />;
const Eye    = (p) => <I {...p} d={<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>} />;

// ─── QR mark (same as anchor) ─────────────────────────────────
function QRMark({ size = 32 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-label="QuickReserve" style={{ display: "block", flexShrink: 0 }}>
      <rect width="32" height="32" rx="9" fill="#0E0E0E" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      <path d="M 14.6 14.6 L 14.6 7.2 A 7.4 7.4 0 0 1 22 14.6 Z" fill="#F5D90A" />
      <circle cx="14.6" cy="14.6" r="7.8" fill="none" stroke="#FFFFFF" strokeWidth="2.4" />
      <circle cx="14.6" cy="14.6" r="1.3" fill="#FFFFFF" />
      <line x1="17.4" y1="17.4" x2="22.6" y2="22.6" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

// ─── Buttons ──────────────────────────────────────────────────
const BTN_BASE = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  borderRadius: "999px", border: 0,
  fontFamily: "var(--font-sans), var(--font-cjk)",
  fontWeight: 600, cursor: "pointer", letterSpacing: ".01em",
  whiteSpace: "nowrap",
};
function Btn({ variant = "primary", size = "md", children, withIcon, fullWidth, style, ...rest }) {
  const sz = size === "sm" ? { height: 36, padding: "0 16px", fontSize: 12.5 }
           : size === "lg" ? { height: 52, padding: "0 26px", fontSize: 14.5 }
           :                  { height: 44, padding: "0 20px", fontSize: 13.5 };
  const v = variant === "primary" ? { background: "var(--primary)", color: "var(--primary-foreground)" }
          : variant === "secondary" ? { background: "transparent", color: "var(--foreground)", border: "1.5px solid var(--border)" }
          : variant === "accent" ? { background: "var(--accent)", color: "var(--accent-foreground)" }
          : variant === "ghost" ? { background: "transparent", color: "var(--foreground)" }
          : variant === "danger" ? { background: "transparent", color: "var(--destructive)", border: "1.5px solid var(--destructive)" }
          :                       {};
  return <button style={{ ...BTN_BASE, ...sz, ...v, width: fullWidth ? "100%" : undefined, ...style }} {...rest}>{children}</button>;
}
// CTA pill with yellow arrow circle (used heavily in hero / forms)
function PrimaryCta({ children, size = "lg", ...rest }) {
  const h = size === "lg" ? 52 : 44;
  return (
    <button style={{
      ...BTN_BASE,
      background: "var(--primary)", color: "var(--primary-foreground)",
      height: h, padding: `0 ${h * 0.16}px 0 ${h * 0.5}px`,
      fontSize: size === "lg" ? 14.5 : 13.5, gap: 14,
    }} {...rest}>
      {children}
      <span style={{
        width: h - 16, height: h - 16, borderRadius: "50%",
        background: "var(--accent)", color: "var(--accent-foreground)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}><Arrow size={size === "lg" ? 14 : 12} /></span>
    </button>
  );
}

// ─── Inputs ───────────────────────────────────────────────────
function Field({ label, hint, error, children, suffix }) {
  return (
    <label style={{ display: "block" }}>
      {label && (
        <div className="cjk" style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--foreground)" }}>
          {label}
        </div>
      )}
      <div style={{ position: "relative" }}>
        {children}
        {suffix && (
          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }}>
            {suffix}
          </span>
        )}
      </div>
      {hint && <div className="cjk" style={{ fontSize: 11.5, color: error ? "var(--destructive)" : "var(--muted-foreground)", marginTop: 6 }}>{hint}</div>}
    </label>
  );
}
function TextInput({ value, placeholder, type = "text", ...rest }) {
  return (
    <input type={type} defaultValue={value} placeholder={placeholder} className="cjk" style={{
      width: "100%", height: 48, padding: "0 16px",
      borderRadius: 12, border: "1.5px solid var(--border)",
      background: "var(--background)", color: "var(--foreground)",
      fontFamily: "var(--font-sans), var(--font-cjk)", fontSize: 14,
      outline: "none", boxSizing: "border-box",
    }} {...rest} />
  );
}

// ─── Badges ───────────────────────────────────────────────────
function Pill({ children, variant = "neutral", style, icon }) {
  const v = variant === "yellow"  ? { background: "var(--accent)", color: "var(--accent-foreground)" }
          : variant === "black"   ? { background: "var(--primary)", color: "var(--primary-foreground)" }
          : variant === "outline" ? { background: "transparent", border: "1px solid var(--border)", color: "var(--foreground)" }
          : variant === "mutedOutline" ? { background: "transparent", border: "1px solid var(--border)", color: "var(--muted-foreground)" }
          :                         { background: "var(--secondary)", color: "var(--foreground)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 12px", borderRadius: "999px",
      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: ".06em",
      ...v, ...style,
    }}>
      {icon}{children}
    </span>
  );
}
const STATUS_MAP = {
  pending:   { label: "待確認",  variant: "yellow",       icon: <Clock size={11} sw={2} /> },
  confirmed: { label: "已確認",  variant: "black",        icon: <Check size={11} sw={2.5} /> },
  cancelled: { label: "已取消",  variant: "outline",      icon: <X     size={11} sw={2.5} /> },
  completed: { label: "已完成",  variant: "mutedOutline", icon: <Check size={11} sw={2} /> },
};
function StatusBadge({ status }) {
  const m = STATUS_MAP[status] || STATUS_MAP.pending;
  return <Pill variant={m.variant} icon={m.icon}>{m.label}</Pill>;
}

// ─── Avatar ───────────────────────────────────────────────────
function Avatar({ size = 80, initial = "陳", verified, ring }) {
  return (
    <div className="display cjk" style={{
      width: size, height: size, borderRadius: "50%",
      background: "var(--secondary)", color: "var(--foreground)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 700,
      border: "1px solid var(--border)",
      flexShrink: 0, position: "relative",
      boxShadow: ring ? "0 0 0 4px var(--background), 0 0 0 5.5px var(--border)" : undefined,
    }}>
      {initial}
      {verified && (
        <span aria-hidden style={{
          position: "absolute", right: 0, bottom: 4,
          width: size * 0.22, height: size * 0.22, borderRadius: "50%",
          background: "var(--accent)", color: "var(--accent-foreground)",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "2.5px solid var(--background)",
          fontSize: size * 0.12, fontWeight: 800,
        }}>✓</span>
      )}
    </div>
  );
}

// ─── Cards & wrappers ────────────────────────────────────────
function Card({ children, style, padded = true, hover }) {
  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: "calc(var(--radius) + 6px)",
      padding: padded ? 22 : 0,
      boxShadow: "0 1px 0 var(--border), 0 8px 24px -18px rgba(0,0,0,.18)",
      ...style,
    }}>{children}</div>
  );
}

// Striped placeholder for any image
function ImgSlot({ label, ratio = "16 / 9", radius }) {
  return (
    <div style={{
      aspectRatio: ratio, width: "100%",
      borderRadius: radius ?? "calc(var(--radius) + 4px)",
      background: "repeating-linear-gradient(135deg, var(--muted) 0 10px, var(--card) 10px 20px)",
      border: "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".05em",
    }}>{label}</div>
  );
}

// ─── Top bar ──────────────────────────────────────────────────
//   variant: "public-out" | "public-in" | "auth" | "app"
function TopBar({ variant = "public-out", size = "desktop", crumb }) {
  const isMobile = size === "mobile";
  const padX = isMobile ? 20 : 40;
  const isAuth = variant === "auth";
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: `${isAuth ? 18 : 14}px ${padX}px`,
      borderBottom: isAuth ? "none" : "1px solid var(--border)",
      background: "var(--background)",
      position: "relative",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <QRMark size={isMobile ? 32 : 36} />
        <div style={{ lineHeight: 1 }}>
          <div className="display" style={{
            fontSize: isMobile ? 15 : 17, fontWeight: 400,
            letterSpacing: ".01em", textTransform: "uppercase",
          }}>QuickReserve</div>
          {!isAuth && (
            <div className="mono" style={{
              fontSize: 9.5, color: "var(--muted-foreground)",
              letterSpacing: ".15em", marginTop: 3,
            }}>BOOK · YOUR · COACH</div>
          )}
        </div>
        {crumb && !isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 16 }}>
            <span className="mono" style={{ color: "var(--muted-foreground)", fontSize: 11 }}>/</span>
            <span className="mono" style={{
              fontSize: 11, padding: "5px 12px",
              borderRadius: "999px", background: "var(--secondary)",
              color: "var(--foreground)", letterSpacing: ".05em",
            }}>{crumb}</span>
          </div>
        )}
      </div>

      {variant === "public-out" && !isMobile && (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Btn variant="ghost" size="sm">登入</Btn>
          <Btn variant="primary" size="sm">建立帳號</Btn>
        </div>
      )}
      {variant === "public-out" && isMobile && (
        <Btn variant="primary" size="sm">登入 / 註冊</Btn>
      )}
      {variant === "public-in" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {!isMobile && <Btn variant="ghost" size="sm">我的預約</Btn>}
          <div style={{ position: "relative" }}>
            <Avatar size={36} initial={STUDENT.initial} />
          </div>
        </div>
      )}
      {variant === "auth" && (
        <Btn variant="ghost" size="sm"><ArrowL size={14}/> 返回首頁</Btn>
      )}
      {variant === "app" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Btn variant="ghost" size="sm">登出</Btn>
          <Avatar size={36} initial={STUDENT.initial} />
        </div>
      )}
    </div>
  );
}

// ─── Section header (used inside long pages) ───────────────────
function SectionHead({ kicker, title, eng, hint, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
      <div>
        {kicker && (
          <div className="mono" style={{
            fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase",
            color: "var(--muted-foreground)", marginBottom: 8,
          }}>{kicker}</div>
        )}
        <h2 className="display" style={{
          fontSize: 42, lineHeight: 0.95, margin: 0, fontWeight: 400,
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
        </h2>
        {hint && <div className="cjk" style={{ marginTop: 12, fontSize: 13, color: "var(--muted-foreground)" }}>{hint}</div>}
      </div>
      {right}
    </div>
  );
}

// ─── Banner (info / warning / success) ─────────────────────────
function Banner({ variant = "info", icon, title, body, action }) {
  const map = {
    info:    { bg: "var(--secondary)", fg: "var(--foreground)",   ring: "var(--border)" },
    warning: { bg: "var(--accent)",    fg: "var(--accent-foreground)", ring: "var(--accent)" },
    success: { bg: "var(--primary)",   fg: "var(--primary-foreground)", ring: "var(--primary)" },
  };
  const m = map[variant];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "14px 18px", borderRadius: 14,
      background: m.bg, color: m.fg,
      border: `1px solid ${m.ring}`,
    }}>
      {icon && <span style={{ flexShrink: 0 }}>{icon}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div className="cjk" style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{title}</div>}
        {body && <div className="cjk" style={{ fontSize: 13, lineHeight: 1.55, opacity: 0.9 }}>{body}</div>}
      </div>
      {action}
    </div>
  );
}

// ─── Service card (used on /<slug>) ────────────────────────────
function ServiceCard({ s, index, selected, compact }) {
  return (
    <Card style={{
      padding: compact ? 18 : 24,
      ...(selected ? { borderColor: "var(--foreground)", boxShadow: "0 0 0 2px var(--foreground), 0 8px 24px -18px rgba(0,0,0,.2)" } : {}),
      display: "flex", flexDirection: "column", gap: 12, position: "relative",
    }}>
      <div className="display" aria-hidden style={{
        position: "absolute", top: 14, right: 18,
        fontSize: compact ? 64 : 84, lineHeight: 0.9, fontWeight: 400,
        color: "var(--muted-foreground)", opacity: 0.10,
      }}>0{index + 1}</div>
      <div className="mono" style={{
        display: "flex", alignItems: "center", gap: 8,
        fontSize: 10.5, fontWeight: 700, letterSpacing: ".18em",
        color: "var(--muted-foreground)",
      }}>
        <span style={{ width: 14, height: 2, background: "var(--accent)", borderRadius: 2 }} />
        SERVICE / 0{index + 1}
      </div>
      <h3 className="cjk display" style={{ fontSize: compact ? 19 : 22, margin: 0, fontWeight: 900, lineHeight: 1.15, maxWidth: "78%" }}>
        {s.name}
      </h3>
      <p className="cjk" style={{ fontSize: 13, lineHeight: 1.65, margin: 0, color: "var(--muted-foreground)" }}>{s.desc}</p>
      <div style={{
        marginTop: "auto", paddingTop: 14,
        borderTop: "1px dashed var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
      }}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: ".08em", color: "var(--muted-foreground)" }}>{s.duration} 分鐘</span>
        <span className="display" style={{
          fontSize: 22, fontWeight: 400, color: "var(--foreground)",
          borderBottom: "3px solid var(--accent)", paddingBottom: 1, lineHeight: 1,
        }}>NT$ {s.price.toLocaleString()}{s.perPerson ? " /人" : ""}</span>
      </div>
      <Btn variant={selected ? "primary" : "secondary"} size="md" fullWidth style={{ marginTop: 4 }}>
        {selected ? <><Check size={13} sw={2.5} /> 已選擇 · 看時段</> : <>選擇此服務 <Arrow size={13}/></>}
      </Btn>
    </Card>
  );
}

// ─── Calendar-based slot picker (Google-Calendar-ish month view) ────
// Days with 0 available slots render as disabled (muted bg, no hover).
// Below the month grid we show the selected day's time chips.

// Hardcoded demo month: AUG 2026. Aug 1 is Saturday, so the Sunday-start grid
// begins with the tail of July (7/26 → 7/31). Closed days = Sat/Sun.
const MONTH_LABEL = { en: "AUG 2026", zh: "2026 年 8 月" };
const MONTH_CELLS = [
  // row 1 — late July (other month, all disabled)
  { d: 26, slots: 0, isOther: true }, { d: 27, slots: 0, isOther: true },
  { d: 28, slots: 0, isOther: true }, { d: 29, slots: 0, isOther: true },
  { d: 30, slots: 0, isOther: true }, { d: 31, slots: 0, isOther: true },
  { d: 1,  slots: 0 },
  // row 2
  { d: 2,  slots: 0 }, { d: 3, slots: 5 }, { d: 4,  slots: 5 },
  { d: 5,  slots: 4 }, { d: 6, slots: 6 }, { d: 7,  slots: 3 }, { d: 8, slots: 0 },
  // row 3
  { d: 9,  slots: 0 }, { d: 10, slots: 5 }, { d: 11, slots: 4 },
  { d: 12, slots: 6 }, { d: 13, slots: 5 }, { d: 14, slots: 3 }, { d: 15, slots: 0 },
  // row 4 — week of the selected date
  { d: 16, slots: 0 }, { d: 17, slots: 5 }, { d: 18, slots: 5 },
  { d: 19, slots: 5, isToday: true, isSelected: true },
  { d: 20, slots: 3 }, { d: 21, slots: 6 }, { d: 22, slots: 0 },
  // row 5
  { d: 23, slots: 0 }, { d: 24, slots: 5 }, { d: 25, slots: 4 },
  { d: 26, slots: 6 }, { d: 27, slots: 5 }, { d: 28, slots: 4 }, { d: 29, slots: 0 },
  // row 6
  { d: 30, slots: 0 }, { d: 31, slots: 5 },
  { d: 1, slots: 0, isOther: true }, { d: 2, slots: 0, isOther: true },
  { d: 3, slots: 0, isOther: true }, { d: 4, slots: 0, isOther: true },
  { d: 5, slots: 0, isOther: true },
];

function SlotPicker({ size = "desktop" }) {
  const isMobile = size === "mobile";
  const cellH = isMobile ? 64 : 84;
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

  return (
    <div>
      {/* Month nav header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 18, gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <h3 className="display" style={{
            fontSize: isMobile ? 24 : 32, margin: 0, fontWeight: 400,
            textTransform: "uppercase", letterSpacing: ".01em",
          }}>{MONTH_LABEL.en}</h3>
          <span className="cjk mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".08em" }}>
            · {MONTH_LABEL.zh}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Btn variant="secondary" size="sm"><ArrowL size={12}/></Btn>
          <Btn variant="ghost" size="sm">今天</Btn>
          <Btn variant="secondary" size="sm"><Arrow size={12}/></Btn>
          {!isMobile && (
            <div style={{ marginLeft: 8, display: "flex", border: "1px solid var(--border)", borderRadius: 999, overflow: "hidden" }}>
              {["月", "週", "列表"].map((v, i) => (
                <button key={v} style={{
                  ...BTN_BASE, height: 32, padding: "0 14px", borderRadius: 0,
                  fontSize: 12, fontWeight: 500,
                  background: i === 0 ? "var(--foreground)" : "transparent",
                  color: i === 0 ? "var(--background)" : "var(--muted-foreground)",
                }}>{v}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Calendar grid wrapper */}
      <div style={{
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflow: "hidden",
        background: "var(--card)",
      }}>
        {/* Weekday header */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
          background: "var(--muted)",
          borderBottom: "1px solid var(--border)",
        }}>
          {weekdays.map((w, i) => (
            <div key={w} className="mono" style={{
              padding: "10px 12px",
              fontSize: 10.5, letterSpacing: ".15em",
              color: i === 0 || i === 6 ? "var(--muted-foreground)" : "var(--foreground)",
              borderRight: i < 6 ? "1px solid var(--border)" : "none",
              fontWeight: 600,
            }}>{w}</div>
          ))}
        </div>

        {/* Days grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {MONTH_CELLS.map((c, i) => {
            const isAvailable = c.slots > 0 && !c.isOther;
            const isDisabled = !isAvailable;
            const dow = i % 7;
            const row = Math.floor(i / 7);
            const isLastRow = row === 5;
            const lowSlots = c.slots > 0 && c.slots <= 3;
            return (
              <button key={i} disabled={isDisabled} style={{
                ...BTN_BASE,
                position: "relative",
                height: cellH,
                padding: isMobile ? "6px 8px" : "10px 12px",
                borderRadius: 0,
                border: 0,
                borderRight: dow < 6 ? "1px solid var(--border)" : "none",
                borderBottom: isLastRow ? "none" : "1px solid var(--border)",
                background: c.isSelected ? "var(--foreground)" : "transparent",
                color: c.isSelected ? "var(--background)"
                       : c.isOther ? "var(--muted-foreground)"
                       : isDisabled ? "var(--muted-foreground)"
                       : "var(--foreground)",
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: c.isOther ? 0.45 : 1,
                display: "flex", flexDirection: "column", alignItems: "stretch",
                justifyContent: "space-between", gap: 4, textAlign: "left",
                fontWeight: 400,
              }}>
                {/* date number, with optional today ring */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  {c.isToday ? (
                    <span aria-label="今天" style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 26, height: 26, borderRadius: "50%",
                      background: c.isSelected ? "var(--accent)" : "var(--accent)",
                      color: "var(--accent-foreground)",
                    }}>
                      <span className="display" style={{ fontSize: 14, fontWeight: 700 }}>{c.d}</span>
                    </span>
                  ) : (
                    <span className="display" style={{
                      fontSize: isMobile ? 15 : 17, fontWeight: 400,
                    }}>{c.d}</span>
                  )}
                  {/* tiny dot indicator for "few slots left" */}
                  {lowSlots && !c.isSelected && (
                    <span aria-hidden style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: "var(--accent)",
                    }} />
                  )}
                </div>

                {/* availability label or em-dash for disabled */}
                {!c.isOther && (
                  <span className="mono" style={{
                    fontSize: isMobile ? 9 : 10, letterSpacing: ".05em",
                    color: c.isSelected ? "var(--background)"
                           : isAvailable ? "var(--muted-foreground)"
                           : "var(--muted-foreground)",
                    opacity: c.isSelected ? 0.8 : isDisabled ? 0.55 : 1,
                  }}>
                    {c.slots > 0 ? `${c.slots} 個時段` : "—"}
                  </span>
                )}

                {/* selected bottom strip */}
                {c.isSelected && (
                  <span aria-hidden style={{
                    position: "absolute", left: 0, right: 0, bottom: 0,
                    height: 3, background: "var(--accent)",
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* legend below calendar */}
      <div className="mono" style={{
        marginTop: 12, fontSize: 10, color: "var(--muted-foreground)",
        letterSpacing: ".08em", display: "flex", gap: 16, flexWrap: "wrap",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: "var(--accent)" }} />今天
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: "var(--foreground)" }} />已選擇
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />剩 ≤ 3
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, background: "var(--muted)", border: "1px solid var(--border)" }} />— 無時段
        </span>
      </div>

      {/* Selected date summary + time chips */}
      <div style={{
        marginTop: 28, marginBottom: 14,
        display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap",
      }}>
        <h4 className="display" style={{
          fontSize: isMobile ? 22 : 28, margin: 0, fontWeight: 400,
          textTransform: "uppercase", letterSpacing: ".01em",
        }}>8 / 19 · 週二</h4>
        <span className="mono" style={{
          padding: "4px 10px", borderRadius: 999,
          background: "var(--accent)", color: "var(--accent-foreground)",
          fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em",
        }}>SELECTED · 5 SLOTS</span>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)",
        gap: 10,
      }}>
        {SLOTS.map((sl) => {
          const isFull = sl.state === "full";
          const isGroup = sl.state === "group";
          const isSel = sl.state === "selected";
          const cellBg = isSel ? "var(--foreground)" : isFull ? "var(--muted)" : "var(--card)";
          const cellFg = isSel ? "var(--background)" : isFull ? "var(--muted-foreground)" : "var(--foreground)";
          return (
            <button key={sl.t} disabled={isFull} style={{
              ...BTN_BASE,
              flexDirection: "column", alignItems: "flex-start", gap: 4,
              height: 64, padding: "8px 14px",
              borderRadius: 14,
              border: isSel ? "1.5px solid var(--foreground)" : "1px solid var(--border)",
              background: cellBg, color: cellFg,
              opacity: isFull ? 0.55 : 1,
              cursor: isFull ? "not-allowed" : "pointer",
              justifyContent: "center", position: "relative",
            }}>
              <span className="display" style={{ fontSize: 18, fontWeight: 400, letterSpacing: ".01em" }}>{sl.t}</span>
              <span className="mono" style={{ fontSize: 9.5, opacity: 0.8, letterSpacing: ".06em" }}>
                {isFull ? "FULL · 已額滿" : isGroup ? `${sl.filled}/${sl.capacity} · 團班` : isSel ? "SELECTED" : "可預約"}
              </span>
              {isSel && (
                <span aria-hidden style={{
                  position: "absolute", top: 6, right: 6,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "var(--accent)", color: "var(--accent-foreground)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}><Check size={9} sw={3} /></span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page shell — applies direction class & theme to a fixed-size frame ──
function Mockup({ theme = "light", children }) {
  const cls = `dir-c${theme === "dark" ? " dark" : ""}`;
  return (
    <div className={cls} style={{ width: "100%", height: "100%" }}>
      <div className="mockup" style={{ overflow: "hidden" }}>{children}</div>
    </div>
  );
}

Object.assign(window, {
  COACH, STUDENT, SERVICES, PACKAGES, DATES, SLOTS, MY_BOOKINGS, MY_PACKAGES,
  Mail, Phone, Chat, Pin, Arrow, ArrowL, Clock, Calendar, Check, X, Play, User, Menu, Filter, Star, Info, Alert, Plus, Eye,
  QRMark, Btn, PrimaryCta, Field, TextInput, Pill, StatusBadge, Avatar, Card, ImgSlot,
  TopBar, SectionHead, Banner, ServiceCard, SlotPicker, Mockup,
});
