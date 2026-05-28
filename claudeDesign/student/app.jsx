// student/app.jsx — wires DesignCanvas with the 6 student pages.

// Heights per page × breakpoint. Generous so content doesn't clip.
const H = {
  pub:   { d: 4540, t: 4960, m: 6280 },
  pkg:   { d: 2260, t: 2300, m: 2480 },
  book:  { d: 1280, t: 1420, m: 1840 },
  login: { d: 780,  t: 820,  m: 980  },
  sign:  { d: 860,  t: 900,  m: 1100 },
  mb:    { d: 2040, t: 2220, m: 2600 },
};

function App() {
  return (
    <DesignCanvas>
      {/* INTRO */}
      <DCSection id="intro" title="QuickReserve · 學員旅程" subtitle="Brief 01 · 6 頁完整流程：公開頁 → 套裝 → 預約 → 我的預約 / 登入 / 註冊 · 沿用 C · 圓潤運動 direction">
        <DCArtboard id="intro-card" label="Brief 摘要" width={460} height={560}>
          <div className="dir-c">
            <div className="meta-card" style={{ padding: 30, gap: 16 }}>
              <div className="mono muted" style={{ letterSpacing: ".2em", textTransform: "uppercase" }}>S6 · BRIEF 01</div>
              <h3 className="display cjk" style={{ fontSize: 32, lineHeight: 1.05, fontWeight: 400, margin: 0, letterSpacing: "-0.01em", textTransform: "uppercase" }}>
                學員端<br/>STUDENT EXPERIENCE
              </h3>
              <p className="cjk" style={{ fontSize: 13.5, lineHeight: 1.7, margin: 0, color: "var(--muted-foreground)" }}>
                把學員的「逛 → 買 → 預約 → 管理」串成一條視覺一致的 flow。
                所有頁面沿用 anchor 選定的 C · 圓潤運動 direction。
              </p>
              <ul className="cjk" style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.85, color: "var(--foreground)" }}>
                <li><strong>01</strong>　/<span className="mono">&lt;slug&gt;</span> · 公開頁完整版（含改期模式 banner）</li>
                <li><strong>02</strong>　/<span className="mono">&lt;slug&gt;</span>/packages · 套裝瀏覽 + 申請表單</li>
                <li><strong>03</strong>　/book/<span className="mono">&lt;slotId&gt;</span> · 預約確認 + 套裝餘額</li>
                <li><strong>04</strong>　/login · 登入</li>
                <li><strong>05</strong>　/signup · 註冊（含邀請模式）</li>
                <li><strong>06</strong>　/my-bookings · 學員預約列表 + 狀態 badge</li>
              </ul>
              <div className="mono muted" style={{ marginTop: "auto", fontSize: 11 }}>
                每頁四個 artboard：desktop / tablet / mobile / desktop-dark
              </div>
            </div>
          </div>
        </DCArtboard>
        <DCArtboard id="intro-tokens" label="新增 Token / 規則" width={460} height={560}>
          <div className="dir-c">
            <div className="meta-card" style={{ padding: 30, gap: 14 }}>
              <div className="mono muted" style={{ letterSpacing: ".2em", textTransform: "uppercase" }}>NEW · TOKENS & RULES</div>
              <h3 className="display cjk" style={{ fontSize: 22, lineHeight: 1.15, fontWeight: 600, margin: 0 }}>
                Anchor 之外新增的設計規則
              </h3>
              <ul className="cjk" style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.85 }}>
                <li><strong>狀態 badge</strong>：pending=黃、confirmed=黑、cancelled=outline、completed=灰</li>
                <li><strong>SlotPicker</strong>：date ribbon（含今日點 + 時段數）+ time chips（4 種 state: open / full / group N/M / selected）</li>
                <li><strong>改期模式 banner</strong>：黃色 warning、含原預約資訊與「退出改期」按鈕</li>
                <li><strong>Auth flow</strong>：split layout（form 50% + 編輯系 side panel 50%）</li>
                <li><strong>Empty state</strong>：dashed border 圓角區、含 icon + title + 提示</li>
                <li><strong>付款狀態 chips</strong>：申請套裝時的 segmented control</li>
                <li>所有按鈕 999px pill · cards 18px radius · 卡片陰影 `0 8px 24px -18px rgba(0,0,0,.18)`</li>
              </ul>
            </div>
          </div>
        </DCArtboard>
      </DCSection>

      {/* 01 — Public coach page */}
      <DCSection id="p1-public" title="01 · /<slug> 教練公開頁" subtitle="完整版：hero · 改期 banner · bio · video · gallery · services · slot picker">
        <DCArtboard id="p1-desk"   label="Desktop · 1280" width={1280} height={H.pub.d}>
          <PublicCoachPage size="desktop" />
        </DCArtboard>
        <DCArtboard id="p1-tab"    label="Tablet · 768"   width={768}  height={H.pub.t}>
          <PublicCoachPage size="tablet" />
        </DCArtboard>
        <DCArtboard id="p1-mob"    label="Mobile · 375"   width={375}  height={H.pub.m}>
          <PublicCoachPage size="mobile" />
        </DCArtboard>
        <DCArtboard id="p1-dark"   label="Desktop · Dark" width={1280} height={H.pub.d}>
          <Mockup theme="dark"><PublicCoachPage size="desktop" /></Mockup>
        </DCArtboard>
        <DCArtboard id="p1-resch"  label="Desktop · 改期模式" width={1280} height={H.pub.d + 80}>
          <PublicCoachPage size="desktop" reschedule />
        </DCArtboard>
      </DCSection>

      {/* 02 — Packages */}
      <DCSection id="p2-packages" title="02 · /<slug>/packages 套裝瀏覽 + 申請" subtitle="按服務分組、含 popular 標記、一張卡展開為申請表單">
        <DCArtboard id="p2-desk" label="Desktop · 1280" width={1280} height={H.pkg.d}>
          <PackagesPage size="desktop" />
        </DCArtboard>
        <DCArtboard id="p2-tab"  label="Tablet · 768"   width={768}  height={H.pkg.t}>
          <PackagesPage size="tablet" />
        </DCArtboard>
        <DCArtboard id="p2-mob"  label="Mobile · 375"   width={375}  height={H.pkg.m}>
          <PackagesPage size="mobile" />
        </DCArtboard>
        <DCArtboard id="p2-dark" label="Desktop · Dark" width={1280} height={H.pkg.d}>
          <Mockup theme="dark"><PackagesPage size="desktop" /></Mockup>
        </DCArtboard>
      </DCSection>

      {/* 03 — Booking confirm */}
      <DCSection id="p3-book" title="03 · /book/<slotId> 預約確認" subtitle="時段詳情 + 套裝餘額選擇 + 取消政策">
        <DCArtboard id="p3-desk" label="Desktop · 1280" width={1280} height={H.book.d}>
          <BookPage size="desktop" />
        </DCArtboard>
        <DCArtboard id="p3-tab"  label="Tablet · 768"   width={768}  height={H.book.t}>
          <BookPage size="tablet" />
        </DCArtboard>
        <DCArtboard id="p3-mob"  label="Mobile · 375"   width={375}  height={H.book.m}>
          <BookPage size="mobile" />
        </DCArtboard>
        <DCArtboard id="p3-dark" label="Desktop · Dark" width={1280} height={H.book.d}>
          <Mockup theme="dark"><BookPage size="desktop" /></Mockup>
        </DCArtboard>
      </DCSection>

      {/* 04 — Login */}
      <DCSection id="p4-login" title="04 · /login 登入" subtitle="Split layout · 含 ?signedup=1 註冊成功 banner 樣態">
        <DCArtboard id="p4-desk"   label="Desktop · 1280" width={1280} height={H.login.d}>
          <LoginPage size="desktop" />
        </DCArtboard>
        <DCArtboard id="p4-signed" label="Desktop · 註冊成功" width={1280} height={H.login.d + 80}>
          <LoginPage size="desktop" signedUp />
        </DCArtboard>
        <DCArtboard id="p4-tab"    label="Tablet · 768"   width={768}  height={H.login.t}>
          <LoginPage size="tablet" />
        </DCArtboard>
        <DCArtboard id="p4-mob"    label="Mobile · 375"   width={375}  height={H.login.m}>
          <LoginPage size="mobile" />
        </DCArtboard>
        <DCArtboard id="p4-dark"   label="Desktop · Dark" width={1280} height={H.login.d}>
          <Mockup theme="dark"><LoginPage size="desktop" /></Mockup>
        </DCArtboard>
      </DCSection>

      {/* 05 — Signup */}
      <DCSection id="p5-signup" title="05 · /signup 註冊" subtitle="與 login 視覺一致 · 含 ?invite=token 邀請模式">
        <DCArtboard id="p5-desk"    label="Desktop · 1280" width={1280} height={H.sign.d}>
          <SignupPage size="desktop" />
        </DCArtboard>
        <DCArtboard id="p5-invited" label="Desktop · 邀請模式" width={1280} height={H.sign.d + 80}>
          <SignupPage size="desktop" invited />
        </DCArtboard>
        <DCArtboard id="p5-tab"     label="Tablet · 768"   width={768}  height={H.sign.t}>
          <SignupPage size="tablet" />
        </DCArtboard>
        <DCArtboard id="p5-mob"     label="Mobile · 375"   width={375}  height={H.sign.m}>
          <SignupPage size="mobile" />
        </DCArtboard>
        <DCArtboard id="p5-dark"    label="Desktop · Dark" width={1280} height={H.sign.d}>
          <Mockup theme="dark"><SignupPage size="desktop" /></Mockup>
        </DCArtboard>
      </DCSection>

      {/* 06 — My bookings */}
      <DCSection id="p6-mb" title="06 · /my-bookings 學員預約列表" subtitle="按時間分組（今日 / 本週 / 之後 / 已過）· 含 4 種狀態 badge · KPI 列">
        <DCArtboard id="p6-desk" label="Desktop · 1280" width={1280} height={H.mb.d}>
          <MyBookingsPage size="desktop" />
        </DCArtboard>
        <DCArtboard id="p6-tab"  label="Tablet · 768"   width={768}  height={H.mb.t}>
          <MyBookingsPage size="tablet" />
        </DCArtboard>
        <DCArtboard id="p6-mob"  label="Mobile · 375"   width={375}  height={H.mb.m}>
          <MyBookingsPage size="mobile" />
        </DCArtboard>
        <DCArtboard id="p6-dark" label="Desktop · Dark" width={1280} height={H.mb.d}>
          <Mockup theme="dark"><MyBookingsPage size="desktop" /></Mockup>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
