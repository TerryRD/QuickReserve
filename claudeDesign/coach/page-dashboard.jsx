// coach/page-dashboard.jsx — /dashboard

function DashboardPage({ size = "desktop" }) {
  const isMobile = size === "mobile";
  const isTablet = size === "tablet";

  return (
    <AppShell active="dashboard" size={size} title="總覽">
      {/* GREETING HERO */}
      <div style={{
        position: "relative",
        background: "var(--primary)", color: "var(--primary-foreground)",
        borderRadius: 18,
        padding: isMobile ? "24px 22px" : "36px 36px 32px",
        marginBottom: 24,
        overflow: "hidden",
      }}>
        {/* yellow corner accent */}
        <div aria-hidden style={{
          position: "absolute", right: -40, top: -40,
          width: 220, height: 220, borderRadius: "50%",
          background: "var(--accent)", opacity: 0.20,
        }} />
        <div className="mono" style={{ fontSize: 11, letterSpacing: ".18em", opacity: 0.7, marginBottom: 14 }}>
          DASHBOARD · TUE 2026.08.19 · 內湖工作室
        </div>
        <h1 className="display" style={{
          fontSize: isMobile ? 44 : 72, lineHeight: 0.9, margin: 0, fontWeight: 400,
          textTransform: "uppercase", letterSpacing: "-0.01em",
          display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap",
        }}>
          <span className="cjk">早安、{COACH.name}</span>
          <span aria-hidden style={{
            display: "inline-block", width: isMobile ? 10 : 14, height: isMobile ? 10 : 14,
            borderRadius: "50%", background: "var(--accent)", transform: "translateY(-10%)",
          }} />
        </h1>
        <p className="cjk" style={{ fontSize: isMobile ? 14 : 16, lineHeight: 1.55, margin: "14px 0 0", opacity: 0.75, maxWidth: 540 }}>
          今天 5 堂預約・3 筆待核可的套裝申請・1 筆改期等你回覆。
        </p>

        <div style={{ marginTop: isMobile ? 22 : 28, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={{
            ...BTN_BASE,
            height: 44, padding: "0 6px 0 22px", borderRadius: 999,
            background: "var(--accent)", color: "var(--accent-foreground)",
            gap: 12, fontSize: 13.5,
          }}>
            開啟今日行事曆
            <span style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "var(--primary)", color: "var(--primary-foreground)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}><Arrow size={13} /></span>
          </button>
          <Btn variant="secondary" size="md" style={{ borderColor: "rgba(255,255,255,.25)", color: "var(--primary-foreground)" }}>
            <Plus size={13}/> 建立可用時段
          </Btn>
          <Btn variant="ghost" size="md" style={{ color: "var(--primary-foreground)", opacity: 0.85 }}>
            <Layers size={13}/> 開放新套裝
          </Btn>
        </div>
      </div>

      {/* KPI row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
        gap: 12, marginBottom: 28,
      }}>
        <KpiCard label="本週待確認" value={COACH_KPIS.pendingThisWeek} unit="筆" hint="教練核可中" accent icon={<Clock size={13} />} />
        <KpiCard label="本週確認"   value={COACH_KPIS.confirmedThisWeek} unit="堂" hint="比上週多 2 堂" icon={<Check size={13} sw={2.5} />} />
        <KpiCard label="套裝待審"   value={COACH_KPIS.packagesAwait} unit="筆" hint="最久等待 2 天" accent icon={<Layers size={13} />} />
        <KpiCard label="本月新學員" value={COACH_KPIS.newStudentsThisMonth} unit="位" hint="周宇翔、蔡淑芬" icon={<Sparkle size={13} />} />
      </div>

      {/* Two-column layout: today + pending */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr" : "minmax(0, 1.3fr) minmax(0, 1fr)",
        gap: 20, alignItems: "start",
      }}>
        {/* TODAY's bookings — timeline */}
        <Card padded={false}>
          <div style={{ padding: "20px 22px 6px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 className="display cjk" style={{ fontSize: 22, margin: 0, fontWeight: 900 }}>今日預約</h2>
            <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".1em" }}>{TODAY_BOOKINGS.length} 堂</span>
          </div>
          <div style={{ padding: "12px 22px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
            {TODAY_BOOKINGS.map((b, i) => {
              const isNext = i === 3; // 16:00 = "next up" highlight
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: isNext ? "var(--accent)" : "var(--card)",
                  color: isNext ? "var(--accent-foreground)" : "var(--foreground)",
                }}>
                  <div className="display" style={{
                    fontSize: 20, fontWeight: 400, lineHeight: 1,
                    width: 64, fontVariantNumeric: "tabular-nums", letterSpacing: ".02em",
                  }}>{b.time}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cjk" style={{ fontSize: 13.5, fontWeight: 600 }}>{b.student}</div>
                    <div className="cjk" style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                      {b.service} · {b.coach}
                    </div>
                  </div>
                  {b.group && (
                    <span className="mono" style={{
                      padding: "3px 8px", borderRadius: 999,
                      background: isNext ? "var(--primary)" : "var(--accent)",
                      color: isNext ? "var(--primary-foreground)" : "var(--accent-foreground)",
                      fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
                    }}>{b.group.filled}/{b.group.capacity}</span>
                  )}
                  {isNext && (
                    <span className="mono" style={{ fontSize: 10, letterSpacing: ".1em", fontWeight: 700 }}>NEXT UP</span>
                  )}
                  <MoreV size={14} />
                </div>
              );
            })}
          </div>
        </Card>

        {/* PENDING column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card padded={false}>
            <div style={{
              padding: "20px 22px",
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              borderBottom: "1px solid var(--border)",
            }}>
              <h2 className="display cjk" style={{ fontSize: 18, margin: 0, fontWeight: 900 }}>待確認預約</h2>
              <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".1em" }}>{PENDING_BK.length} 筆</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {PENDING_BK.slice(0, 3).map((p, i) => (
                <div key={p.id} style={{
                  padding: "14px 22px",
                  borderBottom: i < 2 ? "1px solid var(--border)" : "none",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span className="cjk" style={{ fontSize: 14, fontWeight: 600 }}>{p.student}</span>
                    <StatusBadge status="pending" />
                  </div>
                  <div className="cjk" style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 4 }}>
                    {p.service} · {p.date} {p.time} · {p.since}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <Btn variant="primary" size="sm" style={{ flex: 1 }}><Check size={12} sw={2.5}/> 確認</Btn>
                    <Btn variant="ghost" size="sm" style={{ color: "var(--muted-foreground)" }}><X size={12} sw={2.5}/></Btn>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 22px", borderTop: "1px solid var(--border)" }}>
              <Btn variant="ghost" size="sm" fullWidth style={{ color: "var(--muted-foreground)" }}>
                查看全部待確認 <Arrow size={13}/>
              </Btn>
            </div>
          </Card>

          {/* Quick action card */}
          <Card style={{ padding: 22, background: "var(--muted)", display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".18em", color: "var(--muted-foreground)" }}>QUICK ACTIONS</div>
            <h3 className="cjk display" style={{ fontSize: 18, margin: 0, fontWeight: 900 }}>還沒設定本週時段？</h3>
            <p className="cjk" style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.55 }}>
              用作息模板一次設定整週的時段、或用重複規則自動展開未來四週。
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <Btn variant="primary" size="sm">設定作息模板 <Arrow size={13}/></Btn>
              <Btn variant="secondary" size="sm">建立重複規則</Btn>
            </div>
          </Card>

          {/* Empty state preview (compact) */}
          <div style={{
            padding: "20px 22px",
            border: "1.5px dashed var(--border)", borderRadius: 14,
            display: "flex", gap: 12, alignItems: "center",
          }}>
            <span style={{
              flexShrink: 0, width: 40, height: 40, borderRadius: "50%",
              background: "var(--secondary)", color: "var(--muted-foreground)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}><Sparkle size={18} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="cjk" style={{ fontSize: 13, fontWeight: 600 }}>剛開始使用 QuickReserve？</div>
              <div className="cjk" style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 3 }}>
                完成 4 步驟讓你的 <span className="mono" style={{ background: "var(--secondary)", padding: "0 6px", borderRadius: 4, fontSize: 10.5 }}>/{COACH.slug}</span> 上線。
              </div>
            </div>
            <Arrow size={14} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

Object.assign(window, { DashboardPage });
