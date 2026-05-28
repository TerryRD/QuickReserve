// coach/page-settings-notifications.jsx — /settings/notifications

const NOTIF_EVENTS = [
  { id: "new",      title: "新預約申請",     desc: "學員送出預約申請、等你核可" },
  { id: "confirm",  title: "預約確認",       desc: "你或助教確認了預約、寄信通知學員" },
  { id: "cancel",   title: "預約取消",       desc: "學員或你取消預約、套裝退堂" },
  { id: "resched",  title: "預約改期",       desc: "學員改期、原預約自動取消、需重新確認" },
  { id: "pkgApply", title: "套裝申請",       desc: "學員申請新套裝、需要你核可" },
  { id: "morning",  title: "每日 07:00 預覽", desc: "每天早上送一封「今日預約總覽」" },
  { id: "weekly",   title: "每週日 20:00 預覽", desc: "下週預約預覽、方便事先安排" },
  { id: "remind",   title: "預約前提醒",     desc: "預約開始前 N 分鐘提醒你準備" },
];

const NOTIF_CHANNELS = ["email", "push"]; // channel toggles
const NOTIF_STATE = {
  new:     { email: true,  push: true  },
  confirm: { email: true,  push: false },
  cancel:  { email: true,  push: true  },
  resched: { email: true,  push: true  },
  pkgApply:{ email: true,  push: true  },
  morning: { email: true,  push: false },
  weekly:  { email: true,  push: false },
  remind:  { email: false, push: true  },
};

const PUSH_DEVICES = [
  { id: "d1", name: "MacBook Pro · Chrome",   ua: "macOS 14 · Chrome 132", lastSeen: "2 分鐘前",  active: true },
  { id: "d2", name: "iPhone 15 Pro · Safari", ua: "iOS 18 · Safari",      lastSeen: "1 小時前", active: true },
  { id: "d3", name: "iPad · Chrome",          ua: "iPadOS 17 · Chrome",   lastSeen: "3 天前",   active: false },
];

function Toggle({ on, size = 18 }) {
  const w = size * 2;
  return (
    <span aria-hidden style={{
      width: w, height: size, borderRadius: 999,
      background: on ? "var(--primary)" : "var(--secondary)",
      border: `1.5px solid ${on ? "var(--primary)" : "var(--border)"}`,
      position: "relative",
      transition: "background .15s",
      display: "inline-block", flexShrink: 0,
    }}>
      <span style={{
        position: "absolute", top: 1, left: on ? w - size + 1 : 1,
        width: size - 5, height: size - 5,
        borderRadius: "50%",
        background: on ? "var(--accent)" : "var(--background)",
        boxShadow: "0 1px 3px rgba(0,0,0,.2)",
        transition: "left .15s",
      }} />
    </span>
  );
}

function SettingsNotificationsPage({ size = "desktop" }) {
  const isMobile = size === "mobile";
  return (
    <AppShell active="settings" size={size} title="通知偏好">
      <PageHeader
        kicker="SETTINGS · 通知偏好"
        title="設定"
        eng="SETTINGS"
        hint="選擇哪些事件要送 Email、哪些要在裝置上彈 Web Push 提醒。"
        size={size}
      />
      <SettingsTabs active="notifications" size={size} />

      <div style={{ maxWidth: 1080, display: "flex", flexDirection: "column", gap: 28 }}>
        {/* PUSH SUBSCRIPTION STATUS (top) */}
        <div style={{
          background: "var(--primary)", color: "var(--primary-foreground)",
          borderRadius: 18,
          padding: isMobile ? "20px" : "28px 32px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: 16, flexWrap: "wrap", position: "relative", overflow: "hidden",
        }}>
          <div aria-hidden style={{
            position: "absolute", right: -40, top: -40,
            width: 200, height: 200, borderRadius: "50%",
            background: "var(--accent)", opacity: 0.18,
          }} />
          <div style={{ position: "relative" }}>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".18em", opacity: 0.7 }}>WEB PUSH · 推播訂閱</div>
            <h2 className="display cjk" style={{
              fontSize: isMobile ? 28 : 36, lineHeight: 0.95, margin: "10px 0 0", fontWeight: 400,
              textTransform: "uppercase", letterSpacing: "-0.01em",
            }}>已啟用 · ACTIVE</h2>
            <p className="cjk" style={{ fontSize: 13.5, opacity: 0.75, margin: "10px 0 0", maxWidth: 520, lineHeight: 1.55 }}>
              目前有 <strong>2 個裝置</strong>會收到推播。Email 一律會寄送（即使推播關閉），確保你不會錯過任何事件。
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, position: "relative" }}>
            <Btn variant="secondary" size="md" style={{ borderColor: "rgba(255,255,255,.25)", color: "var(--primary-foreground)" }}>
              <Plus size={13}/> 新增裝置
            </Btn>
            <Btn variant="ghost" size="md" style={{ color: "var(--primary-foreground)", opacity: 0.85 }}>
              <X size={13}/> 停用所有推播
            </Btn>
          </div>
        </div>

        {/* DEVICES list */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
            <h2 className="cjk display" style={{ fontSize: 20, margin: 0, fontWeight: 900 }}>已訂閱的裝置</h2>
            <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".1em" }}>
              {PUSH_DEVICES.length} DEVICES
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PUSH_DEVICES.map((d) => (
              <div key={d.id} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: isMobile ? "14px 16px" : "16px 20px",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                opacity: d.active ? 1 : 0.65,
              }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: d.active ? "var(--accent)" : "var(--secondary)",
                  color: d.active ? "var(--accent-foreground)" : "var(--muted-foreground)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}><Bell size={16} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cjk" style={{ fontSize: 13.5, fontWeight: 600 }}>{d.name}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 3, letterSpacing: ".04em" }}>
                    {d.ua} · 上次活動 {d.lastSeen}
                  </div>
                </div>
                {d.active ? (
                  <Pill variant="black" icon={<Check size={11} sw={2.5} />}>已啟用</Pill>
                ) : (
                  <Pill variant="outline">閒置</Pill>
                )}
                <Btn variant="ghost" size="sm" style={{ color: "var(--destructive)" }}>取消訂閱</Btn>
              </div>
            ))}
          </div>
        </div>

        {/* EVENT-CHANNEL matrix */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
            <h2 className="cjk display" style={{ fontSize: 20, margin: 0, fontWeight: 900 }}>事件通知偏好</h2>
            <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".1em" }}>
              {NOTIF_EVENTS.length} EVENTS · 2 CHANNELS
            </span>
          </div>

          <div style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 18, overflow: "hidden",
          }}>
            {/* table header */}
            {!isMobile && (
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 110px 110px",
                padding: "12px 22px", background: "var(--muted)",
                borderBottom: "1px solid var(--border)",
                fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".15em", color: "var(--muted-foreground)",
              }}>
                <div>EVENT</div>
                <div style={{ textAlign: "center" }}>EMAIL</div>
                <div style={{ textAlign: "center" }}>PUSH</div>
              </div>
            )}
            {NOTIF_EVENTS.map((e, i) => {
              const state = NOTIF_STATE[e.id];
              return (
                <div key={e.id} style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr auto" : "1fr 110px 110px",
                  alignItems: "center",
                  padding: isMobile ? "14px 18px" : "18px 22px",
                  gap: 14,
                  borderBottom: i < NOTIF_EVENTS.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="cjk" style={{ fontSize: 14, fontWeight: 600 }}>{e.title}</div>
                    <div className="cjk" style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 3, lineHeight: 1.5 }}>
                      {e.desc}
                    </div>
                    {e.id === "remind" && (
                      <div style={{
                        marginTop: 10,
                        display: "flex", gap: 8, alignItems: "center",
                      }}>
                        <input defaultValue="30" className="mono" style={{
                          width: 64, height: 32, padding: "0 10px",
                          borderRadius: 8, border: "1.5px solid var(--border)",
                          background: "var(--background)", textAlign: "center",
                          fontSize: 13, outline: "none",
                        }} />
                        <span className="cjk" style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>分鐘前</span>
                      </div>
                    )}
                  </div>
                  {isMobile ? (
                    <div style={{ display: "flex", gap: 10 }}>
                      <Toggle on={state.email} />
                      <Toggle on={state.push} />
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "center" }}><Toggle on={state.email} /></div>
                      <div style={{ display: "flex", justifyContent: "center" }}><Toggle on={state.push} /></div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {isMobile && (
            <div className="mono" style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 8, letterSpacing: ".08em", textAlign: "right" }}>
              左：EMAIL · 右：PUSH
            </div>
          )}
        </div>

        {/* Quiet hours card */}
        <div style={{
          background: "var(--muted)", borderRadius: 16, padding: isMobile ? 20 : 24,
          display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap",
        }}>
          <span style={{
            width: 44, height: 44, borderRadius: 12,
            background: "var(--accent)", color: "var(--accent-foreground)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}><Moon size={20} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cjk display" style={{ fontSize: 16, fontWeight: 900 }}>勿擾時段</div>
            <div className="cjk" style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 4 }}>
              指定時間範圍內 Push 不會響鈴。Email 不受影響、預約前 N 分鐘提醒也不受影響。
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input defaultValue="22:00" className="mono" style={{ width: 76, height: 36, padding: "0 10px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--background)", textAlign: "center", fontSize: 13, outline: "none" }} />
            <span className="cjk" style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>—</span>
            <input defaultValue="07:00" className="mono" style={{ width: 76, height: 36, padding: "0 10px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--background)", textAlign: "center", fontSize: 13, outline: "none" }} />
            <Toggle on />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

Object.assign(window, { SettingsNotificationsPage, Toggle });
