// student/page-auth.jsx — LoginPage + SignupPage (share the same layout)

function AuthLayout({ size, children, side }) {
  const isMobile = size === "mobile";
  const isTablet = size === "tablet";
  // On desktop / tablet we use a split layout: form on the left,
  // editorial "side panel" on the right with brand vibe.
  return (
    <Mockup>
      <TopBar variant="auth" size={size} />
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)",
        minHeight: 0,
      }}>
        {/* form column */}
        <div style={{
          padding: isMobile ? "32px 24px 48px" : isTablet ? "48px 56px" : "72px 88px",
          display: "flex", flexDirection: "column", justifyContent: "center",
          maxWidth: 560, width: "100%", margin: isMobile ? "0 auto" : "0",
        }}>
          {children}
        </div>
        {/* side panel — hide on mobile */}
        {!isMobile && side}
      </div>
    </Mockup>
  );
}

// editorial side panel — same vibe across login & signup
function SidePanel({ title, lines }) {
  return (
    <div style={{
      background: "var(--muted)",
      padding: "72px 56px",
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      borderLeft: "1px solid var(--border)",
      overflow: "hidden", position: "relative",
    }}>
      {/* faded brand mark */}
      <div aria-hidden style={{
        position: "absolute", right: -30, top: -30,
        opacity: 0.06, transform: "rotate(-12deg)",
      }}>
        <QRMark size={320} />
      </div>
      <div style={{ position: "relative" }}>
        <div className="mono" style={{
          fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase",
          color: "var(--muted-foreground)", marginBottom: 16,
        }}>QUICKRESERVE / STUDENT</div>
        <h2 className="display cjk" style={{
          fontSize: 56, lineHeight: 0.95, margin: 0, fontWeight: 400,
          letterSpacing: "-0.01em", textTransform: "uppercase",
        }}>{title}</h2>
      </div>
      <ul className="cjk" style={{
        position: "relative",
        listStyle: "none", margin: 0, padding: 0,
        display: "flex", flexDirection: "column", gap: 18,
        fontSize: 14, lineHeight: 1.55, color: "var(--foreground)",
      }}>
        {lines.map((l, i) => (
          <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{
              flexShrink: 0, width: 24, height: 24, borderRadius: "50%",
              background: "var(--accent)", color: "var(--accent-foreground)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
            }}>{i + 1}</span>
            <span>{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LoginPage({ size = "desktop", signedUp = false }) {
  return (
    <AuthLayout size={size} side={<SidePanel
      title="登入　WELCOME BACK"
      lines={[
        "登入後可購買套裝、預約時段、改期或取消預約。",
        "教練核可後會以 Email 與 Web Push 通知你。",
        "資料安全：密碼以 bcrypt 雜湊儲存、session 採 httpOnly cookie。",
      ]}
    />}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {signedUp && (
          <Banner
            variant="success"
            icon={<Check size={18} sw={2.5} />}
            title="註冊成功"
            body="請使用剛建立的帳號登入。"
          />
        )}
        <div>
          <div className="mono" style={{
            fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase",
            color: "var(--muted-foreground)", marginBottom: 12,
          }}>STEP 01 · LOGIN</div>
          <h1 className="display cjk" style={{
            fontSize: 56, margin: 0, lineHeight: 0.95, fontWeight: 400,
            letterSpacing: "-0.01em", textTransform: "uppercase",
          }}>
            歡迎回來
          </h1>
          <p className="cjk" style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6, color: "var(--muted-foreground)" }}>
            還沒有帳號？<a href="#" style={{ color: "var(--foreground)", textDecorationThickness: 2, textUnderlineOffset: 4 }}>建立帳號</a>　·　學員 / 教練共用同一個入口。
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Field label="Email">
            <TextInput type="email" placeholder="you@example.com" value="yawen.lee@example.com" />
          </Field>
          <Field label="密碼" hint="忘記密碼？聯絡你的教練重設">
            <TextInput type="password" value="••••••••••" suffix={<Eye size={16} />} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <PrimaryCta size="lg">登入</PrimaryCta>
          <Btn variant="secondary" size="lg">建立帳號</Btn>
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".1em", marginTop: 4 }}>
          登入即表示同意服務條款 · 隱私權政策
        </div>
      </div>
    </AuthLayout>
  );
}

function SignupPage({ size = "desktop", invited = false }) {
  return (
    <AuthLayout size={size} side={<SidePanel
      title="建立帳號　JOIN"
      lines={[
        "免費註冊，第一次預約教練前必需。",
        "註冊後可在不同教練之間共用同一個帳號。",
        invited ? "完成註冊後將自動接受邀請。" : "若是被教練邀請、請使用邀請信件裡的連結。",
      ]}
    />}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {invited && (
          <Banner
            variant="warning"
            icon={<Star size={18} />}
            title="您正在接受教練邀請"
            body="完成註冊後將自動接受邀請、可立即購買該教練的套裝。"
          />
        )}
        <div>
          <div className="mono" style={{
            fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase",
            color: "var(--muted-foreground)", marginBottom: 12,
          }}>STEP 01 · SIGN UP</div>
          <h1 className="display cjk" style={{
            fontSize: 56, margin: 0, lineHeight: 0.95, fontWeight: 400,
            letterSpacing: "-0.01em", textTransform: "uppercase",
          }}>
            建立帳號
          </h1>
          <p className="cjk" style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6, color: "var(--muted-foreground)" }}>
            已有帳號？<a href="#" style={{ color: "var(--foreground)", textDecorationThickness: 2, textUnderlineOffset: 4 }}>登入</a>
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Field label="姓名">
            <TextInput placeholder="王小明" />
          </Field>
          <Field label="Email" hint="教練會以此 Email 寄送預約通知">
            <TextInput type="email" placeholder="you@example.com" />
          </Field>
          <Field label="密碼" hint="至少 8 個字元、包含英文與數字">
            <TextInput type="password" placeholder="至少 8 個字元" suffix={<Eye size={16} />} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <PrimaryCta size="lg">{invited ? "建立帳號並接受邀請" : "建立帳號"}</PrimaryCta>
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".08em", marginTop: 4 }}>
          建立帳號即同意服務條款與隱私權政策
        </div>
      </div>
    </AuthLayout>
  );
}

Object.assign(window, { LoginPage, SignupPage, AuthLayout, SidePanel });
