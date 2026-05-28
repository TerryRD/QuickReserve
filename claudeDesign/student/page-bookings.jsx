// student/page-bookings.jsx — /my-bookings

function BookingCard({ b, size }) {
  const isMobile = size === "mobile";
  const date = new Date(b.date);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
  const isCancelledOrCompleted = b.status === "cancelled" || b.status === "completed";

  return (
    <Card padded={false} style={{
      display: "flex", flexDirection: isMobile ? "column" : "row",
      overflow: "hidden",
      opacity: isCancelledOrCompleted ? 0.7 : 1,
    }}>
      {/* date strip */}
      <div style={{
        flexShrink: 0,
        width: isMobile ? "auto" : 132,
        padding: isMobile ? "16px 20px" : "24px 18px",
        background: "var(--muted)",
        borderRight: isMobile ? "none" : "1px solid var(--border)",
        borderBottom: isMobile ? "1px solid var(--border)" : "none",
        display: "flex", flexDirection: isMobile ? "row" : "column",
        alignItems: isMobile ? "center" : "flex-start",
        gap: isMobile ? 14 : 6,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span className="display" style={{ fontSize: isMobile ? 32 : 44, lineHeight: 1, fontWeight: 400 }}>{day}</span>
          <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".1em" }}>
            /{String(month).padStart(2, "0")}
          </span>
        </div>
        <div className="cjk" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".05em" }}>
          {date.getFullYear()} · 週{weekday}
        </div>
        <div className="display" style={{
          marginTop: isMobile ? 0 : "auto",
          fontSize: isMobile ? 18 : 22, fontWeight: 400, letterSpacing: ".02em",
        }}>{b.time}</div>
      </div>

      {/* body */}
      <div style={{ flex: 1, padding: isMobile ? "16px 20px 20px" : "20px 24px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".12em", marginBottom: 4 }}>
              {b.coach} · {b.duration} MIN
            </div>
            <h3 className="cjk display" style={{ fontSize: isMobile ? 19 : 22, margin: 0, fontWeight: 900, lineHeight: 1.2 }}>
              {b.service}
            </h3>
          </div>
          <StatusBadge status={b.status} />
        </div>

        {/* actions */}
        {(b.canReschedule || b.canCancel) ? (
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {b.canReschedule && <Btn variant="secondary" size="sm"><Calendar size={13} /> 改期</Btn>}
            {b.canCancel && <Btn variant="ghost" size="sm" style={{ color: "var(--muted-foreground)" }}><X size={13}/> 取消預約</Btn>}
            <Btn variant="ghost" size="sm" style={{ marginLeft: "auto", color: "var(--muted-foreground)" }}>查看詳情 <Arrow size={13}/></Btn>
          </div>
        ) : (
          <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".08em", marginTop: 8 }}>
            {b.status === "completed" ? "已完成 · 期待下次見面" : "已取消 · 不會佔用套裝堂數"}
          </div>
        )}
      </div>
    </Card>
  );
}

function MyBookingsPage({ size = "desktop" }) {
  const isMobile = size === "mobile";
  const isTablet = size === "tablet";
  const padX = isMobile ? 20 : isTablet ? 40 : 72;

  const groups = ["今日", "本週", "之後", "已過"];

  return (
    <Mockup>
      <TopBar variant="public-in" size={size} crumb="我的預約" />

      <section style={{ padding: `${isMobile ? 28 : 48}px ${padX}px ${isMobile ? 20 : 32}px` }}>
        {/* page hero */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
          <div>
            <div className="mono" style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 10 }}>
              MY BOOKINGS · {STUDENT.name}
            </div>
            <h1 className="display" style={{
              fontSize: isMobile ? 56 : 88, lineHeight: 0.9, margin: 0, fontWeight: 400,
              textTransform: "uppercase", letterSpacing: "-0.01em",
              display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap",
            }}>
              <span className="cjk">我的預約</span>
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Pill icon={<Filter size={11} />}>狀態 · 全部</Pill>
            <Pill icon={<Calendar size={11} />}>本月 · 8 月</Pill>
          </div>
        </div>

        {/* quick stats row */}
        <div style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)",
          gap: 1, background: "var(--border)",
          border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden",
        }}>
          {[
            ["本月已預約", "4", "堂"],
            ["待確認",    "1", "堂"],
            ["套裝餘額",  "7", "堂"],
            ["最近一次",  "今日 16:00", ""],
          ].map(([k, v, u], i) => (
            <div key={i} style={{ background: "var(--card)", padding: "14px 18px" }}>
              <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".15em", color: "var(--muted-foreground)" }}>{k}</div>
              <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 4 }}>
                <span className="display" style={{ fontSize: 26, fontWeight: 400 }}>{v}</span>
                {u && <span className="cjk" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{u}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* list */}
      <section style={{ padding: `0 ${padX}px ${isMobile ? 40 : 72}px`, display: "flex", flexDirection: "column", gap: 32 }}>
        {groups.map((g) => {
          const items = MY_BOOKINGS.filter((b) => b.group === g);
          if (!items.length) return null;
          return (
            <div key={g}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 14 }}>
                <h2 className="display cjk" style={{ fontSize: isMobile ? 22 : 26, margin: 0, fontWeight: 900 }}>
                  {g === "今日" ? "今日" : g === "本週" ? "本週" : g === "之後" ? "之後" : "已過"}
                </h2>
                <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".1em" }}>
                  {items.length} 筆
                </span>
                <span aria-hidden style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {items.map((b) => <BookingCard key={b.id} b={b} size={size} />)}
              </div>
            </div>
          );
        })}

        {/* empty state preview at bottom */}
        <div style={{
          marginTop: 16,
          padding: isMobile ? "32px 20px" : 48,
          border: "1.5px dashed var(--border)",
          borderRadius: 18,
          textAlign: "center",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "var(--secondary)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--muted-foreground)",
          }}><Calendar size={24} /></div>
          <h3 className="cjk display" style={{ fontSize: 20, margin: 0, fontWeight: 900 }}>還想預約其他教練嗎？</h3>
          <p className="cjk" style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0, maxWidth: 360 }}>
            點選教練給的連結（如 <span className="mono" style={{ background: "var(--secondary)", padding: "2px 8px", borderRadius: 999, fontSize: 11.5 }}>/coach-poyu</span>）即可瀏覽他們的服務與套裝。
          </p>
        </div>
      </section>
    </Mockup>
  );
}

Object.assign(window, { MyBookingsPage, BookingCard });
