// coach/app.jsx — wires DesignCanvas with all coach-app sections.

const CH = {
  dash:   { d: 1500, t: 1900, m: 2400 },
  calW:   { d: 1140, t: 1240, m: 1520 },
  calL:   { d: 2020, t: 2220, m: 2440 },
  calM:   { d: 1120, t: 1220, m: 1520 },
  serv:   { d: 1940, t: 2120, m: 3060 },
  cust:   { d: 1180, t: 1240, m: 1860 },
  pkg:    { d: 1740, t: 1940, m: 2680 },
  pend:   { d: 1140, t: 1220, m: 1540 },
  notif:  { d: 1340, t: 1500, m: 1740 },
};

function App() {
  return (
    <DesignCanvas>
      {/* INTRO */}
      <DCSection id="intro" title="QuickReserve · 教練後台" subtitle="Brief 02 · 8 區塊：Sidebar + Dashboard + Calendar (3 views) + Services + Customers + Packages + Pending + Notifications">
        <DCArtboard id="brief-intro" label="Brief 摘要" width={460} height={580}>
          <div className="dir-c">
            <div className="meta-card" style={{ padding: 30, gap: 16 }}>
              <div className="mono muted" style={{ letterSpacing: ".2em", textTransform: "uppercase" }}>S6 · BRIEF 02</div>
              <h3 className="display cjk" style={{ fontSize: 32, lineHeight: 1.05, fontWeight: 400, margin: 0, letterSpacing: "-0.01em", textTransform: "uppercase" }}>
                教練後台<br/>COACH APP
              </h3>
              <p className="cjk" style={{ fontSize: 13.5, lineHeight: 1.7, margin: 0, color: "var(--muted-foreground)" }}>
                從每日 dashboard 到行事曆、服務管理、學員、套裝、套裝審核、通知，
                教練日常工作面的完整流程。沿用 anchor 選定的 C · 圓潤運動 direction。
              </p>
              <ul className="cjk" style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.85, color: "var(--foreground)" }}>
                <li><strong>共用</strong>　Sidebar 三斷點（240 / 64 / drawer）+ theme toggle</li>
                <li><strong>01</strong>　/dashboard 早安、KPI、今日、待確認</li>
                <li><strong>02</strong>　/calendar 三視圖（週 / 列表 / 月）+ slot popover</li>
                <li><strong>03</strong>　/services CRUD + 編輯展開狀態</li>
                <li><strong>04</strong>　/customers 列表 + 詳情 drawer</li>
                <li><strong>05</strong>　/packages 按服務分組 + 新增 placeholder</li>
                <li><strong>06</strong>　/packages/pending 同意 / 拒絕</li>
                <li><strong>07</strong>　/notifications 列表 + tab</li>
              </ul>
              <div className="mono muted" style={{ marginTop: "auto", fontSize: 11 }}>
                每頁四個 artboard：desktop / tablet / mobile / desktop-dark
              </div>
            </div>
          </div>
        </DCArtboard>
      </DCSection>

      {/* SIDEBAR NAV — shared chrome */}
      <DCSection id="chrome" title="共用 · Sidebar Nav" subtitle="桌機展開 240 · 平板摺疊 64 icon-only · 手機抽屜模式">
        <DCArtboard id="sb-desk" label="Desktop · Expanded" width={260} height={760}>
          <Mockup><Sidebar active="dashboard" state="expanded" /></Mockup>
        </DCArtboard>
        <DCArtboard id="sb-tab"  label="Tablet · Collapsed" width={76}  height={760}>
          <Mockup><Sidebar active="calendar" state="collapsed" /></Mockup>
        </DCArtboard>
        <DCArtboard id="sb-mob"  label="Mobile · Drawer Open" width={375} height={760}>
          <Mockup>
            <div style={{ flex: 1, display: "flex", position: "relative", minHeight: 0 }}>
              <div aria-hidden style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 9 }} />
              <Sidebar active="customers" state="drawer" />
            </div>
          </Mockup>
        </DCArtboard>
        <DCArtboard id="sb-dark" label="Desktop · Dark"     width={260} height={760}>
          <Mockup theme="dark"><Sidebar active="dashboard" state="expanded" /></Mockup>
        </DCArtboard>
      </DCSection>

      {/* 01 — Dashboard */}
      <DCSection id="dash" title="01 · /dashboard 教練首頁" subtitle="早安問候、KPI、今日預約、待確認、Quick actions">
        <DCArtboard id="dash-desk" label="Desktop · 1280" width={1280} height={CH.dash.d}><DashboardPage size="desktop" /></DCArtboard>
        <DCArtboard id="dash-tab"  label="Tablet · 768"   width={768}  height={CH.dash.t}><DashboardPage size="tablet" /></DCArtboard>
        <DCArtboard id="dash-mob"  label="Mobile · 375"   width={375}  height={CH.dash.m}><DashboardPage size="mobile" /></DCArtboard>
        <DCArtboard id="dash-dark" label="Desktop · Dark" width={1280} height={CH.dash.d}>
          <Mockup theme="dark"><DashboardPage size="desktop" /></Mockup>
        </DCArtboard>
      </DCSection>

      {/* 02 — Calendar */}
      <DCSection id="cal" title="02 · /calendar 行事曆" subtitle="三視圖：週 / 列表 / 月。含 slot popover、衝突 badge、團班 capacity badge、教練 filter">
        <DCArtboard id="cal-week"     label="Week · 1280"   width={1280} height={CH.calW.d}><CalendarPage size="desktop" view="week" /></DCArtboard>
        <DCArtboard id="cal-pop"      label="Week · Popover" width={1280} height={CH.calW.d}><CalendarPage size="desktop" view="week" popoverOpen /></DCArtboard>
        <DCArtboard id="cal-list"     label="List · 1280"   width={1280} height={CH.calL.d}><CalendarPage size="desktop" view="list" /></DCArtboard>
        <DCArtboard id="cal-month"    label="Month · 1280"  width={1280} height={CH.calM.d}><CalendarPage size="desktop" view="month" /></DCArtboard>
        <DCArtboard id="cal-tab"      label="Tablet · Week" width={768}  height={CH.calW.t}><CalendarPage size="tablet" view="week" /></DCArtboard>
        <DCArtboard id="cal-mob"      label="Mobile · List" width={375}  height={CH.calL.m}><CalendarPage size="mobile" view="list" /></DCArtboard>
        <DCArtboard id="cal-dark"     label="Week · Dark"   width={1280} height={CH.calW.d}>
          <Mockup theme="dark"><CalendarPage size="desktop" view="week" /></Mockup>
        </DCArtboard>
      </DCSection>

      {/* 03 — Services */}
      <DCSection id="serv" title="03 · /services 服務管理" subtitle="CRUD 含團班參數（capacity / minAttend / cancelHrs）、Tab 切換、編輯展開">
        <DCArtboard id="serv-desk" label="Desktop · 1280" width={1280} height={CH.serv.d}><ServicesPage size="desktop" /></DCArtboard>
        <DCArtboard id="serv-tab"  label="Tablet · 768"   width={768}  height={CH.serv.t}><ServicesPage size="tablet" /></DCArtboard>
        <DCArtboard id="serv-mob"  label="Mobile · 375"   width={375}  height={CH.serv.m}><ServicesPage size="mobile" /></DCArtboard>
        <DCArtboard id="serv-dark" label="Desktop · Dark" width={1280} height={CH.serv.d}>
          <Mockup theme="dark"><ServicesPage size="desktop" /></Mockup>
        </DCArtboard>
      </DCSection>

      {/* 04 — Customers */}
      <DCSection id="cust" title="04 · /customers 學員管理" subtitle="搜尋 / 篩選 + 列表 + 右側詳情 drawer（含預約紀錄、套裝餘額、進度條）">
        <DCArtboard id="cust-desk" label="Desktop · 1280" width={1280} height={CH.cust.d}><CustomersPage size="desktop" /></DCArtboard>
        <DCArtboard id="cust-tab"  label="Tablet · 768"   width={768}  height={CH.cust.t}><CustomersPage size="tablet" /></DCArtboard>
        <DCArtboard id="cust-mob"  label="Mobile · 375"   width={375}  height={CH.cust.m}><CustomersPage size="mobile" /></DCArtboard>
        <DCArtboard id="cust-dark" label="Desktop · Dark" width={1280} height={CH.cust.d}>
          <Mockup theme="dark"><CustomersPage size="desktop" /></Mockup>
        </DCArtboard>
      </DCSection>

      {/* 05 — Packages */}
      <DCSection id="pkg" title="05 · /packages 套裝管理" subtitle="按服務分組、含新增 placeholder card、Tab 切換">
        <DCArtboard id="pkg-desk" label="Desktop · 1280" width={1280} height={CH.pkg.d}><PackagesPageCoach size="desktop" /></DCArtboard>
        <DCArtboard id="pkg-tab"  label="Tablet · 768"   width={768}  height={CH.pkg.t}><PackagesPageCoach size="tablet" /></DCArtboard>
        <DCArtboard id="pkg-mob"  label="Mobile · 375"   width={375}  height={CH.pkg.m}><PackagesPageCoach size="mobile" /></DCArtboard>
        <DCArtboard id="pkg-dark" label="Desktop · Dark" width={1280} height={CH.pkg.d}>
          <Mockup theme="dark"><PackagesPageCoach size="desktop" /></Mockup>
        </DCArtboard>
      </DCSection>

      {/* 06 — Pending packages */}
      <DCSection id="pend" title="06 · /packages/pending 套裝審核" subtitle="同意 / 拒絕、含 KPI 列、第一筆展示「強調」狀態">
        <DCArtboard id="pend-desk" label="Desktop · 1280" width={1280} height={CH.pend.d}><PackagesPendingPage size="desktop" /></DCArtboard>
        <DCArtboard id="pend-tab"  label="Tablet · 768"   width={768}  height={CH.pend.t}><PackagesPendingPage size="tablet" /></DCArtboard>
        <DCArtboard id="pend-mob"  label="Mobile · 375"   width={375}  height={CH.pend.m}><PackagesPendingPage size="mobile" /></DCArtboard>
        <DCArtboard id="pend-dark" label="Desktop · Dark" width={1280} height={CH.pend.d}>
          <Mockup theme="dark"><PackagesPendingPage size="desktop" /></Mockup>
        </DCArtboard>
      </DCSection>

      {/* 07 — Notifications */}
      <DCSection id="notif" title="07 · /notifications 通知" subtitle="未讀 / 已讀視覺差異、含 tab 切換、Web Push 偏好按鈕">
        <DCArtboard id="notif-desk" label="Desktop · 1280" width={1280} height={CH.notif.d}><NotificationsPage size="desktop" /></DCArtboard>
        <DCArtboard id="notif-tab"  label="Tablet · 768"   width={768}  height={CH.notif.t}><NotificationsPage size="tablet" /></DCArtboard>
        <DCArtboard id="notif-mob"  label="Mobile · 375"   width={375}  height={CH.notif.m}><NotificationsPage size="mobile" /></DCArtboard>
        <DCArtboard id="notif-dark" label="Desktop · Dark" width={1280} height={CH.notif.d}>
          <Mockup theme="dark"><NotificationsPage size="desktop" /></Mockup>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
