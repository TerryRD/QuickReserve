// mockups.jsx — Hero + section components, one per direction.
// All take props: { size: 'desktop' | 'tablet' | 'mobile' }
// Tokens come from a parent wrapper (.dir-a / .dir-b / .dir-c [.dark]).

const COACH = {
  name: "陳柏宇",
  title: "Coach Po-Yu Chen",
  subtitle: "專注一對一肌力訓練・幫助你建立可持續的運動習慣",
  email: "poyu.chen@quickreserve.app",
  phone: "0912-345-678",
  line: "@poyu-coach",
  city: "台北・內湖工作室",
};

const SERVICES = [
  { name: "一對一肌力訓練", desc: "依個人需求設計動作組合，著重姿勢矯正與循序加重。", duration: "60 分鐘", price: "NT$ 2,000" },
  { name: "雙人課程",      desc: "兩人共同訓練，分擔費用、保持規律。", duration: "60 分鐘", price: "NT$ 1,400 /人" },
  { name: "體態評估與諮詢", desc: "首次客戶建議方案。量測體態、動作篩檢、訓練建議。", duration: "90 分鐘", price: "NT$ 1,800" },
];

// shared tiny icons (line, no decorative SVG; just glyph shapes)
const Icon = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const MailIcon  = (p) => <Icon {...p} d={<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>} />;
const PhoneIcon = (p) => <Icon {...p} d={<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>} />;
const ChatIcon  = (p) => <Icon {...p} d={<path d="M21 12a8 8 0 0 1-12.5 6.6L4 20l1.4-4.5A8 8 0 1 1 21 12z"/>} />;
const PinIcon   = (p) => <Icon {...p} d={<><path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></>} />;
const ArrowIcon = (p) => <Icon {...p} d={<><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>} />;

// Striped placeholder for "real image goes here"
function Stripe({ label, ratio = "16 / 9", radius }) {
  return (
    <div style={{
      aspectRatio: ratio, width: "100%", borderRadius: radius || "calc(var(--radius) + 4px)",
      background: "repeating-linear-gradient(135deg, var(--muted) 0 10px, var(--card) 10px 20px)",
      border: "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".05em",
    }}>{label}</div>
  );
}

function Avatar({ size, initial = "陳" }) {
  return (
    <div className="display" style={{
      width: size, height: size, borderRadius: "50%",
      background: "var(--accent)", color: "var(--accent-foreground)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.42, fontWeight: 600,
      border: "1px solid var(--border)",
      boxShadow: "inset 0 -2px 8px rgba(0,0,0,.06)",
    }}>{initial}</div>
  );
}

// ───────────────────────────────────────────────────────────────
// DIRECTION A · Quiet Editorial
//   centered serif hero, ample whitespace, rich-text bio below.
// ───────────────────────────────────────────────────────────────
function MockA({ size = "desktop" }) {
  const isMobile = size === "mobile";
  const isTablet = size === "tablet";
  const pad = isMobile ? "32px 20px" : isTablet ? "56px 40px" : "88px 96px";
  const avatarSize = isMobile ? 72 : isTablet ? 88 : 104;
  const titleSize = isMobile ? 40 : isTablet ? 60 : 76;
  const subSize = isMobile ? 15 : isTablet ? 18 : 20;
  const maxW = 720;

  return (
    <div className="mockup">
      {/* top bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: isMobile ? "14px 20px" : "20px 40px",
        borderBottom: "1px solid var(--border)",
      }}>
        <div className="display" style={{ fontSize: 15, fontStyle: "italic", letterSpacing: ".01em" }}>QuickReserve</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".08em", textTransform: "uppercase" }}>
          {!isMobile && "/coach-poyu"}
        </div>
      </div>

      {/* HERO */}
      <section style={{ padding: pad, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: isMobile ? 18 : 24 }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: ".24em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
          Strength · Coach
        </div>
        <Avatar size={avatarSize} />
        <h1 className="display cjk" style={{
          fontSize: titleSize, lineHeight: 1.05, margin: 0, fontWeight: 500,
          letterSpacing: "-0.015em",
        }}>
          {COACH.name}<span style={{ fontStyle: "italic", fontWeight: 400, opacity: 0.85 }}> · 教練</span>
        </h1>
        <p className="cjk" style={{
          fontSize: subSize, lineHeight: 1.6, margin: 0, maxWidth: maxW,
          color: "var(--muted-foreground)", textWrap: "balance",
        }}>{COACH.subtitle}</p>

        <div style={{
          display: "flex", flexWrap: "wrap", justifyContent: "center", gap: isMobile ? 10 : 14,
          fontSize: isMobile ? 12 : 13, color: "var(--foreground)",
          paddingTop: 4,
        }}>
          {[
            [<MailIcon size={13} />, COACH.email],
            [<PhoneIcon size={13} />, COACH.phone],
            [<ChatIcon size={13} />, "LINE " + COACH.line],
            [<PinIcon size={13} />, COACH.city],
          ].map(([ico, txt], i) => (
            <span key={i} style={{ display: "inline-flex", gap: 6, alignItems: "center", color: "var(--muted-foreground)" }}>
              <span style={{ color: "var(--primary)" }}>{ico}</span>{txt}
            </span>
          ))}
        </div>

        {/* AuthCta */}
        <div style={{
          marginTop: isMobile ? 12 : 20,
          display: "flex", gap: 10, flexDirection: isMobile ? "column" : "row",
          width: isMobile ? "100%" : "auto",
        }}>
          <button style={btnPrimary(isMobile)}>登入預約 <ArrowIcon size={14} /></button>
          <button style={btnGhost(isMobile)}>建立帳號</button>
        </div>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".1em", color: "var(--muted-foreground)", textTransform: "uppercase", marginTop: 4 }}>
          訪客可瀏覽 · 預約需登入
        </div>
      </section>

      {/* SECTION — Bio */}
      <hr style={{ border: 0, height: 1, background: "var(--border)", margin: 0 }} />
      <section style={{ padding: pad, paddingTop: isMobile ? 40 : 72, paddingBottom: isMobile ? 40 : 72, display: "flex", justifyContent: "center" }}>
        <article className="cjk" style={{ maxWidth: 640, width: "100%" }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: ".24em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 16 }}>
            About · 關於我
          </div>
          <h2 className="display" style={{
            fontSize: isMobile ? 28 : 36, lineHeight: 1.15, margin: "0 0 24px",
            fontWeight: 500, letterSpacing: "-0.012em",
          }}>
            從健身房新手到能完成自身體重的硬舉。
          </h2>
          <p style={{ fontSize: isMobile ? 15 : 17, lineHeight: 1.75, margin: "0 0 18px", color: "var(--foreground)" }}>
            我是 <strong style={{ fontWeight: 600 }}>柏宇</strong>，從事一對一肌力訓練教學已邁入第七年。我相信運動的核心不在於追求短期成果，
            而是讓你<em style={{ fontStyle: "italic" }}>長期、規律</em>地把訓練放進日常生活裡。
          </p>
          <p style={{ fontSize: isMobile ? 15 : 17, lineHeight: 1.75, margin: "0 0 24px", color: "var(--muted-foreground)" }}>
            訓練前先評估、再設計動作組合；過程中以姿勢與技術為優先，循序加重。
          </p>
          <h3 className="display" style={{ fontSize: isMobile ? 18 : 21, fontWeight: 600, margin: "32px 0 12px" }}>
            適合下列族群
          </h3>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: isMobile ? 14 : 16, lineHeight: 1.85, color: "var(--foreground)" }}>
            <li>過去自己練但姿勢不確定、想被人盯動作的人</li>
            <li>產後或久坐族，想從基礎重新建立運動習慣</li>
            <li>追求中長期肌力進步、不滿足於單堂體驗的學員</li>
          </ul>
          <p style={{ fontSize: isMobile ? 14 : 15, lineHeight: 1.7, marginTop: 28, color: "var(--muted-foreground)" }}>
            更多訓練紀錄與學員回饋，請見{" "}
            <a href="#" style={{ color: "var(--primary)", textDecorationThickness: 1, textUnderlineOffset: 3 }}>我的 Instagram</a>。
          </p>
        </article>
      </section>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// DIRECTION B · Modern Minimal
//   left-aligned data-dense hero, sharp services grid below.
// ───────────────────────────────────────────────────────────────
function MockB({ size = "desktop" }) {
  const isMobile = size === "mobile";
  const isTablet = size === "tablet";
  const padX = isMobile ? 20 : isTablet ? 40 : 72;
  const avatarSize = isMobile ? 64 : 80;
  const titleSize = isMobile ? 36 : isTablet ? 48 : 60;

  return (
    <div className="mockup">
      {/* top bar — minimal */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: `14px ${padX}px`, borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 18, height: 18, border: "1.5px solid var(--foreground)", borderRadius: 3, position: "relative" }}>
            <div style={{ position: "absolute", inset: 3, background: "var(--primary)", borderRadius: 1 }} />
          </div>
          <div className="mono" style={{ fontSize: 12, letterSpacing: ".05em" }}>QuickReserve</div>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          quickreserve.app/coach-poyu
        </div>
      </div>

      {/* HERO */}
      <section style={{ padding: `${isMobile ? 32 : 56}px ${padX}px ${isMobile ? 36 : 64}px` }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".06em", marginBottom: isMobile ? 20 : 32 }}>
          COACH · STRENGTH TRAINING · TAIPEI
        </div>

        <div style={{ display: "flex", gap: isMobile ? 16 : 24, alignItems: "center", marginBottom: isMobile ? 24 : 36, flexWrap: "wrap" }}>
          <Avatar size={avatarSize} />
          <div>
            <h1 className="display cjk" style={{ fontSize: titleSize, lineHeight: 1.05, margin: 0, fontWeight: 600, letterSpacing: "-0.025em" }}>
              {COACH.name}<span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>　教練</span>
            </h1>
            <div className="mono" style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6, letterSpacing: ".03em" }}>{COACH.title} · 7 yrs experience</div>
          </div>
        </div>

        <p className="cjk" style={{ fontSize: isMobile ? 16 : 19, lineHeight: 1.55, margin: 0, maxWidth: 620, color: "var(--foreground)" }}>
          {COACH.subtitle}
        </p>

        {/* contact grid */}
        <div style={{
          marginTop: isMobile ? 24 : 32,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
          gap: 1, background: "var(--border)",
          border: "1px solid var(--border)", borderRadius: "var(--radius)",
          overflow: "hidden", maxWidth: 720,
        }}>
          {[
            ["EMAIL", COACH.email, <MailIcon size={12} />],
            ["PHONE", COACH.phone, <PhoneIcon size={12} />],
            ["LINE",  COACH.line, <ChatIcon size={12} />],
            ["LOC",   "內湖工作室", <PinIcon size={12} />],
          ].map(([k, v, ico], i) => (
            <div key={i} style={{ background: "var(--card)", padding: "10px 14px" }}>
              <div className="mono" style={{ fontSize: 9.5, letterSpacing: ".12em", color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "var(--primary)" }}>{ico}</span>{k}
              </div>
              <div className="cjk" style={{ fontSize: 12.5, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{v}</div>
            </div>
          ))}
        </div>

        {/* AuthCta */}
        <div style={{
          marginTop: isMobile ? 24 : 32,
          padding: isMobile ? 16 : "18px 24px",
          background: "var(--secondary)", borderRadius: "var(--radius)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: 16, flexDirection: isMobile ? "column" : "row",
          maxWidth: 720,
        }}>
          <div>
            <div className="cjk" style={{ fontSize: 14, fontWeight: 500 }}>準備好開始了嗎？</div>
            <div className="cjk" style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 2 }}>
              登入後即可購買套裝、預約時段
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto" }}>
            <button style={{ ...btnPrimary(isMobile), flex: 1 }}>登入</button>
            <button style={{ ...btnGhost(isMobile), flex: 1 }}>建立帳號</button>
          </div>
        </div>
      </section>

      {/* SECTION — Services grid */}
      <section style={{ padding: `${isMobile ? 28 : 48}px ${padX}px ${isMobile ? 40 : 72}px`, borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: isMobile ? 20 : 28, flexWrap: "wrap", gap: 8 }}>
          <h2 className="display cjk" style={{ fontSize: isMobile ? 24 : 32, margin: 0, fontWeight: 600, letterSpacing: "-0.02em" }}>
            服務項目
          </h2>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".08em" }}>
            03 SERVICES · 點選後選擇時段
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(3, 1fr)",
          gap: 12,
        }}>
          {SERVICES.map((s, i) => (
            <div key={i} style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: isMobile ? 18 : 22,
              background: "var(--card)",
              display: "flex", flexDirection: "column", gap: 14,
              position: "relative",
            }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: ".15em", color: "var(--muted-foreground)" }}>
                0{i + 1}
              </div>
              <h3 className="cjk display" style={{ fontSize: isMobile ? 18 : 20, margin: 0, fontWeight: 600 }}>{s.name}</h3>
              <p className="cjk" style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0, color: "var(--muted-foreground)", minHeight: 44 }}>{s.desc}</p>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                paddingTop: 12, borderTop: "1px dashed var(--border)",
              }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".04em" }}>{s.duration}</span>
                <span className="mono cjk" style={{ fontSize: 16, fontWeight: 600, color: "var(--primary)" }}>{s.price}</span>
              </div>
              <button style={{
                ...btnGhost(false), height: 36, fontSize: 12.5, padding: "0 14px",
                justifyContent: "space-between", width: "100%",
              }}>
                <span>選擇時段</span><ArrowIcon size={13} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// QuickReserve mark — fixed brand colors. Black rounded tile + white Q
// letterform (bowl + integrated tail) + yellow pie wedge as a "reserved slot"
// clock cue inside the bowl. Tail crosses the bowl perimeter at ~4:30 so it
// reads as a Q tail, not a magnifier handle.
function QRMark({ size = 32 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-label="QuickReserve" style={{ display: "block", flexShrink: 0 }}>
      <rect width="32" height="32" rx="9" fill="#0E0E0E" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      {/* yellow reserved-slot wedge: 12 → 3 o'clock */}
      <path d="M 14.6 14.6 L 14.6 7.2 A 7.4 7.4 0 0 1 22 14.6 Z" fill="#F5D90A" />
      {/* white bowl / clock face */}
      <circle cx="14.6" cy="14.6" r="7.8" fill="none" stroke="#FFFFFF" strokeWidth="2.4" />
      {/* center pin */}
      <circle cx="14.6" cy="14.6" r="1.3" fill="#FFFFFF" />
      {/* Q tail — starts INSIDE the bowl, crosses the perimeter at 4:30,
          ends just past it. Same stroke weight as the bowl so it reads as
          one continuous letterform, not a handle. */}
      <line x1="17.4" y1="17.4" x2="22.6" y2="22.6" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

// ───────────────────────────────────────────────────────────────
// DIRECTION C · 圓潤運動 / Bold Round
//   黑/白/黃三色 + 灰階透明度。Light 以白為主、Dark 以黑為主，
//   黃只在小範圍點綴（icon wedge / underline / 角落 stamp / hover dot）。
//   全圓角：cards 12-18px、buttons 999px pill、icon stamps 圓形。
// ───────────────────────────────────────────────────────────────
function MockC({ size = "desktop" }) {
  const isMobile = size === "mobile";
  const isTablet = size === "tablet";
  const padX = isMobile ? 20 : isTablet ? 40 : 72;
  const avatarSize = isMobile ? 76 : 104;
  const titleSize = isMobile ? 60 : isTablet ? 92 : 128;

  const Avatar2 = (
    <div className="display cjk" style={{
      width: avatarSize, height: avatarSize, borderRadius: "50%",
      background: "var(--secondary)", color: "var(--foreground)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: avatarSize * 0.4, fontWeight: 700,
      border: "1px solid var(--border)",
      flexShrink: 0, position: "relative",
    }}>
      陳
      <span aria-hidden style={{
        position: "absolute", right: 0, bottom: 4,
        width: 20, height: 20, borderRadius: "50%",
        background: "var(--accent)", color: "var(--accent-foreground)",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "2.5px solid var(--background)",
        fontSize: 10, fontWeight: 800, fontFamily: "var(--font-mono)",
      }}>✓</span>
    </div>
  );

  return (
    <div className="mockup">
      {/* TOP BAR */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: `16px ${padX}px`,
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <QRMark size={36} />
          <div style={{ lineHeight: 1 }}>
            <div className="display" style={{ fontSize: 18, fontWeight: 400, letterSpacing: ".01em", textTransform: "uppercase" }}>
              QuickReserve
            </div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-foreground)", letterSpacing: ".15em", marginTop: 3 }}>
              BOOK · YOUR · COACH
            </div>
          </div>
        </div>
        {!isMobile && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>quickreserve.app</span>
            <span className="mono" style={{
              fontSize: 11, padding: "5px 12px",
              borderRadius: "999px", background: "var(--secondary)",
              color: "var(--foreground)", letterSpacing: ".05em",
            }}>/coach-poyu</span>
          </div>
        )}
      </div>

      {/* HERO */}
      <section style={{ padding: `${isMobile ? 32 : 56}px ${padX}px ${isMobile ? 36 : 56}px` }}>
        {/* badge row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: isMobile ? 24 : 32 }}>
          <span style={{
            background: "var(--accent)", color: "var(--accent-foreground)",
            padding: "6px 14px", borderRadius: "999px",
            fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: ".12em",
          }}>★ STRENGTH COACH</span>
          <span className="mono" style={{
            fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".12em",
          }}>EST 2018 · 7 YRS · TAIPEI 內湖</span>
        </div>

        {/* big condensed name */}
        <h1 className="display" style={{
          fontSize: titleSize, lineHeight: 0.9, margin: 0, fontWeight: 400,
          letterSpacing: "-0.01em", textTransform: "uppercase", color: "var(--foreground)",
        }}>
          PO-YU
          <br />
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 12 }}>
            CHEN
            <span aria-hidden style={{
              display: "inline-block",
              width: isMobile ? 10 : 16, height: isMobile ? 10 : 16,
              borderRadius: "50%", background: "var(--accent)",
              transform: "translateY(-10%)",
            }} />
          </span>
        </h1>

        {/* CJK name row */}
        <div className="display cjk" style={{
          fontSize: isMobile ? 22 : 28, fontWeight: 900,
          marginTop: isMobile ? 10 : 14, display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap",
        }}>
          陳柏宇
          <span className="mono" style={{
            fontSize: isMobile ? 11 : 13, fontWeight: 700,
            color: "var(--muted-foreground)", letterSpacing: ".15em",
          }}>—— 教練 / COACH</span>
        </div>

        {/* avatar + subtitle */}
        <div style={{
          display: "flex", flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? 20 : 28, alignItems: isMobile ? "flex-start" : "center",
          marginTop: isMobile ? 28 : 40, maxWidth: 880,
        }}>
          {Avatar2}
          <p className="cjk" style={{
            fontSize: isMobile ? 16 : 19, lineHeight: 1.55, margin: 0,
            color: "var(--foreground)", fontWeight: 500,
          }}>{COACH.subtitle}</p>
        </div>

        {/* contact pills */}
        <div style={{
          marginTop: isMobile ? 24 : 32,
          display: "flex", flexWrap: "wrap", gap: 8,
        }}>
          {[
            [<MailIcon size={12} />, COACH.email],
            [<PhoneIcon size={12} />, COACH.phone],
            [<ChatIcon size={12} />, "LINE " + COACH.line],
            [<PinIcon size={12} />, COACH.city],
          ].map(([ico, txt], i) => (
            <span key={i} className="cjk" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 14px", borderRadius: "999px",
              background: "var(--secondary)",
              fontSize: 12.5, color: "var(--foreground)",
              fontFamily: "var(--font-mono)", fontWeight: 500,
            }}>
              <span style={{ color: "var(--foreground)" }}>{ico}</span>
              {txt}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div style={{ marginTop: isMobile ? 28 : 36, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button style={{
            background: "var(--primary)", color: "var(--primary-foreground)",
            border: 0, height: 52, padding: "0 8px 0 26px", borderRadius: "999px",
            fontFamily: "var(--font-sans), var(--font-cjk)", fontSize: 14, fontWeight: 600,
            display: "inline-flex", alignItems: "center", gap: 14, cursor: "pointer",
            letterSpacing: ".02em",
          }}>
            登入預約
            <span style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--accent)", color: "var(--accent-foreground)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <ArrowIcon size={14} />
            </span>
          </button>
          <button style={{
            background: "transparent", color: "var(--foreground)",
            border: "1.5px solid var(--border)", height: 52, padding: "0 24px",
            borderRadius: "999px", fontFamily: "var(--font-sans), var(--font-cjk)",
            fontSize: 14, fontWeight: 500, cursor: "pointer",
          }}>建立帳號</button>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".12em", marginLeft: 4 }}>
            訪客可瀏覽 · 預約需登入
          </span>
        </div>
      </section>

      {/* SERVICES — light gray surface with rounded cards */}
      <section style={{
        padding: `${isMobile ? 36 : 56}px ${padX}px ${isMobile ? 48 : 80}px`,
        borderTop: "1px solid var(--border)",
        background: "var(--muted)",
      }}>
        {/* Section header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: isMobile ? 24 : 36 }}>
          <div>
            <div className="mono" style={{ fontSize: 11, letterSpacing: ".18em", color: "var(--muted-foreground)", marginBottom: 10 }}>
              SECTION / 02
            </div>
            <h2 className="display" style={{
              fontSize: isMobile ? 44 : 76, lineHeight: 0.9, margin: 0,
              fontWeight: 400, textTransform: "uppercase", letterSpacing: "-0.01em",
              display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap",
            }}>
              <span className="cjk">服務</span>
              <span style={{ position: "relative", display: "inline-block" }}>
                SERVICES
                <span aria-hidden style={{
                  position: "absolute", left: 0, right: 0, bottom: -2,
                  height: 7, background: "var(--accent)", borderRadius: 6,
                }} />
              </span>
            </h2>
          </div>
          <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".12em" }}>
            03 ITEMS · 點選後選擇時段
          </span>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(3, 1fr)",
          gap: isMobile ? 14 : 18,
        }}>
          {SERVICES.map((s, i) => (
            <div key={i} style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "calc(var(--radius) + 6px)",
              padding: isMobile ? 22 : 26,
              display: "flex", flexDirection: "column", gap: 14,
              position: "relative",
              boxShadow: "0 1px 0 var(--border), 0 8px 24px -18px rgba(0,0,0,.18)",
            }}>
              {/* ghosted big number — muted gray as user liked */}
              <div className="display" style={{
                fontSize: 96, lineHeight: 0.9,
                color: "var(--muted-foreground)", opacity: 0.10,
                margin: 0, fontWeight: 400,
                position: "absolute", top: 14, right: 18,
              }}>0{i + 1}</div>

              <div className="mono" style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: ".18em",
                color: "var(--muted-foreground)",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ width: 14, height: 2, background: "var(--accent)", borderRadius: 2 }} aria-hidden />
                SERVICE / 0{i + 1}
              </div>

              <h3 className="cjk display" style={{
                fontSize: isMobile ? 22 : 26, margin: 0, fontWeight: 900,
                lineHeight: 1.15, maxWidth: "82%",
              }}>{s.name}</h3>

              <p className="cjk" style={{
                fontSize: 13, lineHeight: 1.65, margin: 0,
                color: "var(--muted-foreground)",
              }}>{s.desc}</p>

              <div style={{
                marginTop: "auto", paddingTop: 16,
                borderTop: "1px dashed var(--border)",
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
              }}>
                <span className="mono" style={{ fontSize: 11, letterSpacing: ".08em", color: "var(--muted-foreground)" }}>{s.duration}</span>
                <span className="display" style={{
                  fontSize: 24, fontWeight: 400, color: "var(--foreground)",
                  borderBottom: "3px solid var(--accent)", paddingBottom: 1, lineHeight: 1,
                }}>{s.price}</span>
              </div>

              <button style={{
                marginTop: 4,
                background: "var(--primary)", color: "var(--primary-foreground)",
                border: 0, height: 44, padding: "0 18px",
                borderRadius: "999px",
                fontFamily: "var(--font-sans), var(--font-cjk)", fontSize: 13, fontWeight: 600,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer", width: "100%",
              }}>
                <span>選擇時段</span>
                <ArrowIcon size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// shared button styles (tokenised)
function btnPrimary(isMobile) {
  return {
    height: isMobile ? 44 : 46,
    padding: isMobile ? "0 18px" : "0 22px",
    background: "var(--primary)",
    color: "var(--primary-foreground)",
    border: "1px solid var(--primary)",
    borderRadius: "var(--radius)",
    fontFamily: "var(--font-sans), var(--font-cjk)",
    fontSize: 14, fontWeight: 500, letterSpacing: ".01em",
    cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    transition: "transform .12s, box-shadow .12s",
  };
}
function btnGhost(isMobile) {
  return {
    height: isMobile ? 44 : 46,
    padding: isMobile ? "0 18px" : "0 22px",
    background: "transparent",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    fontFamily: "var(--font-sans), var(--font-cjk)",
    fontSize: 14, fontWeight: 500,
    cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  };
}

Object.assign(window, { MockA, MockB, MockC, QRMark, COACH, SERVICES });
