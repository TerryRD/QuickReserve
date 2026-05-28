// coach/page-notifications.jsx — /notifications

const NOTIF_ICON_MAP = {
  new:     { icon: <Sparkle size={14} />, color: "var(--accent)" },
  package: { icon: <Layers  size={14} />, color: "var(--accent)" },
  cancel:  { icon: <X       size={14} sw={2.5} />, color: "var(--destructive)" },
  confirm: { icon: <Check   size={14} sw={2.5} />, color: "var(--primary)" },
  resched: { icon: <Calendar size={14} />, color: "var(--primary)" },
  digest:  { icon: <Bell    size={14} />, color: "var(--muted-foreground)" },
};

function NotifRow({ n, size }) {
  const isMobile = size === "mobile";
  const m = NOTIF_ICON_MAP[n.kind] || NOTIF_ICON_MAP.digest;
  return (
    <button style={{
      ...BTN_BASE,
      width: "100%", justifyContent: "flex-start", alignItems: "flex-start",
      padding: isMobile ? "14px 16px" : "16px 20px",
      borderRadius: 14,
      border: "1px solid var(--border)",
      background: n.unread ? "var(--card)" : "var(--muted)",
      gap: 14, height: "auto", textAlign: "left",
      position: "relative",
    }}>
      {n.unread && (
        <span aria-hidden style={{
          position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
          width: 6, height: 6, borderRadius: "50%", background: "var(--accent)",
        }} />
      )}
      <span style={{
        flexShrink: 0, width: 36, height: 36, borderRadius: "50%",
        background: n.unread ? "var(--accent)" : "var(--secondary)",
        color: n.unread ? "var(--accent-foreground)" : "var(--muted-foreground)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginLeft: n.unread ? 4 : 0,
      }}>{m.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="cjk" style={{
          fontSize: 14, lineHeight: 1.4, fontWeight: n.unread ? 600 : 500,
          color: "var(--foreground)",
        }}>
          {n.title}
        </div>
        {n.body && (
          <div className="cjk" style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 4, lineHeight: 1.5 }}>
            {n.body}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".08em" }}>{n.t}</span>
        <Arrow size={13} />
      </div>
    </button>
  );
}

function NotificationsPage({ size = "desktop" }) {
  const isMobile = size === "mobile";
  const unreadCount = NOTIFICATIONS.filter((n) => n.unread).length;
  return (
    <AppShell active="notifications" size={size} title="通知">
      <PageHeader
        kicker="NOTIFICATIONS · 通知"
        title="通知"
        eng="INBOX"
        hint="所有與你預約 / 套裝 / 學員相關的事件。按項目跳轉到對應頁面、或標記為已讀。"
        size={size}
        action={!isMobile && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Pill icon={<Hash size={11} />}>{unreadCount} 則未讀</Pill>
            <Btn variant="secondary" size="sm"><Check size={13} sw={2.5}/> 全部標記已讀</Btn>
            <Btn variant="ghost" size="sm" style={{ color: "var(--muted-foreground)" }}><Cog size={13}/> 通知偏好</Btn>
          </div>
        )}
      />

      {/* filter tab */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <TabBar
          tabs={[
            { id: "all",     label: "全部" },
            { id: "unread",  label: "未讀" },
            { id: "today",   label: "今日" },
          ]}
          active="all"
          counts={{ all: NOTIFICATIONS.length, unread: unreadCount, today: 4 }}
        />
        {!isMobile && (
          <Pill icon={<Filter size={11} />} style={{ marginLeft: "auto" }}>
            類型 · 全部
          </Pill>
        )}
      </div>

      {/* list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 880 }}>
        {NOTIFICATIONS.map((n) => <NotifRow key={n.id} n={n} size={size} />)}
      </div>

      {/* empty state preview */}
      <div style={{
        marginTop: 28, maxWidth: 880,
        padding: isMobile ? "28px 18px" : 36,
        border: "1.5px dashed var(--border)", borderRadius: 18,
        textAlign: "center",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: "var(--secondary)", color: "var(--muted-foreground)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><Bell size={22} /></div>
        <h3 className="cjk display" style={{ fontSize: 18, margin: 0, fontWeight: 900 }}>沒有更多通知</h3>
        <p className="cjk" style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
          新預約 / 套裝申請 / 改期等事件會即時出現在這裡，也會以 Web Push 通知到瀏覽器。
        </p>
        <Btn variant="ghost" size="sm" style={{ color: "var(--muted-foreground)" }}>
          開啟瀏覽器通知 <Arrow size={13}/>
        </Btn>
      </div>
    </AppShell>
  );
}

Object.assign(window, { NotificationsPage });
