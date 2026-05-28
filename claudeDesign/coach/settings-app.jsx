// coach/settings-app.jsx — wires DesignCanvas with 4 settings pages.

const SH = {
  profile: { d: 3660, t: 4060, m: 4800 },
  notif:   { d: 1700, t: 1900, m: 2400 },
  avail:   { d: 2400, t: 2700, m: 3300 },
  rules:   { d: 1900, t: 2100, m: 2700 },
};

function App() {
  return (
    <DesignCanvas>
      <DCSection id="intro" title="QuickReserve · 教練設定" subtitle="Brief 03 · 4 頁：公開頁資料 (6 sections) · 通知偏好 · 作息模板 · 重複規則">
        <DCArtboard id="brief-intro" label="Brief 摘要" width={460} height={560}>
          <div className="dir-c">
            <div className="meta-card" style={{ padding: 30, gap: 16 }}>
              <div className="mono muted" style={{ letterSpacing: ".2em", textTransform: "uppercase" }}>S6 · BRIEF 03</div>
              <h3 className="display cjk" style={{ fontSize: 32, lineHeight: 1.05, fontWeight: 400, margin: 0, letterSpacing: "-0.01em", textTransform: "uppercase" }}>
                教練設定<br/>SETTINGS
              </h3>
              <p className="cjk" style={{ fontSize: 13.5, lineHeight: 1.7, margin: 0, color: "var(--muted-foreground)" }}>
                沿用 brief 02 的 sidebar，內部加入頂端 sub-nav 切換 4 個設定頁。
              </p>
              <ul className="cjk" style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.85, color: "var(--foreground)" }}>
                <li><strong>01</strong>　/settings/profile 公開頁資料（6 section、編號 badge、sticky 儲存列）</li>
                <li><strong>02</strong>　/settings/notifications 事件 × 通道矩陣 + 勿擾時段</li>
                <li><strong>03</strong>　/calendar/availability 模板 + 不可用事件 + materialize 預覽</li>
                <li><strong>04</strong>　/calendar/rules 4 種重複類型 + 衝突偵測</li>
              </ul>
              <div className="mono muted" style={{ marginTop: "auto", fontSize: 11 }}>
                每頁四個 artboard：desktop / tablet / mobile / desktop-dark
              </div>
            </div>
          </div>
        </DCArtboard>
      </DCSection>

      <DCSection id="profile" title="01 · /settings/profile 公開頁資料" subtitle="6 sections + sticky 儲存列 + 編號 badge 為節奏感">
        <DCArtboard id="prof-desk" label="Desktop · 1280" width={1280} height={SH.profile.d}><SettingsProfilePage size="desktop" /></DCArtboard>
        <DCArtboard id="prof-tab"  label="Tablet · 768"   width={768}  height={SH.profile.t}><SettingsProfilePage size="tablet" /></DCArtboard>
        <DCArtboard id="prof-mob"  label="Mobile · 375"   width={375}  height={SH.profile.m}><SettingsProfilePage size="mobile" /></DCArtboard>
        <DCArtboard id="prof-dark" label="Desktop · Dark" width={1280} height={SH.profile.d}>
          <Mockup theme="dark"><SettingsProfilePage size="desktop" /></Mockup>
        </DCArtboard>
      </DCSection>

      <DCSection id="notif" title="02 · /settings/notifications 通知偏好" subtitle="Web Push 訂閱卡 + 裝置列表 + 事件×通道矩陣 + 勿擾時段">
        <DCArtboard id="notif-desk" label="Desktop · 1280" width={1280} height={SH.notif.d}><SettingsNotificationsPage size="desktop" /></DCArtboard>
        <DCArtboard id="notif-tab"  label="Tablet · 768"   width={768}  height={SH.notif.t}><SettingsNotificationsPage size="tablet" /></DCArtboard>
        <DCArtboard id="notif-mob"  label="Mobile · 375"   width={375}  height={SH.notif.m}><SettingsNotificationsPage size="mobile" /></DCArtboard>
        <DCArtboard id="notif-dark" label="Desktop · Dark" width={1280} height={SH.notif.d}>
          <Mockup theme="dark"><SettingsNotificationsPage size="desktop" /></Mockup>
        </DCArtboard>
      </DCSection>

      <DCSection id="avail" title="03 · /calendar/availability 作息模板" subtitle="模板列表 + 編輯展開（週幾 chip + 時段 + 範圍）+ 不可用事件 + 預覽展開">
        <DCArtboard id="avail-desk" label="Desktop · 1280" width={1280} height={SH.avail.d}><AvailabilityPage size="desktop" /></DCArtboard>
        <DCArtboard id="avail-tab"  label="Tablet · 768"   width={768}  height={SH.avail.t}><AvailabilityPage size="tablet" /></DCArtboard>
        <DCArtboard id="avail-mob"  label="Mobile · 375"   width={375}  height={SH.avail.m}><AvailabilityPage size="mobile" /></DCArtboard>
        <DCArtboard id="avail-dark" label="Desktop · Dark" width={1280} height={SH.avail.d}>
          <Mockup theme="dark"><AvailabilityPage size="desktop" /></Mockup>
        </DCArtboard>
      </DCSection>

      <DCSection id="rules" title="04 · /calendar/rules 重複規則" subtitle="4 種重複類型 segmented control + 動態參數 + 結束條件 + 衝突偵測 inline">
        <DCArtboard id="rules-desk" label="Desktop · 1280" width={1280} height={SH.rules.d}><RulesPage size="desktop" /></DCArtboard>
        <DCArtboard id="rules-tab"  label="Tablet · 768"   width={768}  height={SH.rules.t}><RulesPage size="tablet" /></DCArtboard>
        <DCArtboard id="rules-mob"  label="Mobile · 375"   width={375}  height={SH.rules.m}><RulesPage size="mobile" /></DCArtboard>
        <DCArtboard id="rules-dark" label="Desktop · Dark" width={1280} height={SH.rules.d}>
          <Mockup theme="dark"><RulesPage size="desktop" /></Mockup>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
