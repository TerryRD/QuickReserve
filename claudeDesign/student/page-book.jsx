// student/page-book.jsx — /book/[slotId]

function BookPage({ size = "desktop" }) {
  const isMobile = size === "mobile";
  const isTablet = size === "tablet";
  const padX = isMobile ? 20 : isTablet ? 40 : 72;

  // mock slot
  const slot = {
    serviceName: "一對一肌力訓練",
    date: "2026-08-19",
    weekday: "週二",
    time: "16:00",
    duration: 60,
    price: 2000,
    coach: COACH.name,
    location: COACH.city,
  };

  // mock punch cards (student's purchased packages with this coach)
  const punchCards = [
    { id: "pk1", name: "10 堂套裝・一對一肌力訓練", remaining: 6, total: 10, expiresAt: "2026-10-15", selected: true },
    { id: "pk2", name: "20 堂套裝・一對一肌力訓練", remaining: 18, total: 20, expiresAt: "2026-12-22", selected: false },
  ];

  return (
    <Mockup>
      <TopBar variant="public-in" size={size} crumb={"/" + COACH.slug} />

      <section style={{ padding: `${isMobile ? 24 : 40}px ${padX}px ${isMobile ? 16 : 24}px` }}>
        <Btn variant="ghost" size="sm" style={{ marginBottom: 16 }}><ArrowL size={13}/> 返回時段選擇</Btn>

        <div className="mono" style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 12 }}>
          BOOKING / CONFIRM
        </div>
        <h1 className="display" style={{
          fontSize: isMobile ? 44 : 76, lineHeight: 0.92, margin: 0, fontWeight: 400,
          textTransform: "uppercase", letterSpacing: "-0.01em",
        }}>
          <span className="cjk">確認預約</span>
        </h1>
      </section>

      <section style={{
        padding: `0 ${padX}px ${isMobile ? 48 : 80}px`,
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.4fr) minmax(0, 1fr)",
        gap: isMobile ? 16 : 24,
        alignItems: "start",
      }}>
        {/* LEFT — slot detail card */}
        <Card padded={false} style={{ overflow: "hidden" }}>
          {/* big slot header */}
          <div style={{
            padding: isMobile ? "24px 20px" : "32px 28px",
            background: "var(--primary)", color: "var(--primary-foreground)",
            display: "flex", flexDirection: "column", gap: 14,
            position: "relative",
          }}>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".18em", opacity: 0.7 }}>
              SLOT / 2026.08.19 · {slot.weekday.toUpperCase()}
            </div>
            <div style={{
              display: "flex",
              alignItems: "baseline",
              gap: isMobile ? 12 : 20,
              flexWrap: "wrap",
            }}>
              <span className="display" style={{
                fontSize: isMobile ? 76 : 132, lineHeight: 0.85, fontWeight: 400,
                letterSpacing: "-0.02em",
              }}>{slot.time}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="cjk display" style={{ fontSize: isMobile ? 22 : 30, fontWeight: 900 }}>{slot.serviceName}</span>
                <span className="cjk" style={{ fontSize: 13, opacity: 0.75 }}>{slot.duration} 分鐘 · {slot.coach} · {slot.location}</span>
              </span>
            </div>
          </div>

          {/* meta */}
          <div style={{
            padding: isMobile ? "18px 20px" : "20px 28px",
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
            gap: 16,
            borderBottom: "1px solid var(--border)",
          }}>
            {[
              ["DATE",     "8 / 19 · 二"],
              ["DURATION", "60 分鐘"],
              ["COACH",    slot.coach],
              ["PRICE",    `NT$ ${slot.price.toLocaleString()}`],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: ".15em", color: "var(--muted-foreground)" }}>{k}</div>
                <div className="cjk" style={{ marginTop: 4, fontSize: 14, fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* punch-card selector */}
          <div style={{ padding: isMobile ? "20px" : "24px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <h3 className="cjk display" style={{ fontSize: 18, margin: 0, fontWeight: 900 }}>選擇要扣堂的套裝</h3>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".08em" }}>
                此堂將扣 1 堂
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {punchCards.map((c) => (
                <button key={c.id} style={{
                  ...BTN_BASE,
                  display: "flex", justifyContent: "flex-start", alignItems: "center",
                  gap: 14,
                  height: "auto",
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: c.selected ? "1.5px solid var(--foreground)" : "1px solid var(--border)",
                  background: c.selected ? "var(--accent)" : "var(--card)",
                  color: c.selected ? "var(--accent-foreground)" : "var(--foreground)",
                  width: "100%",
                  textAlign: "left",
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: "50%",
                    border: "1.5px solid var(--foreground)",
                    background: c.selected ? "var(--foreground)" : "transparent",
                    color: c.selected ? "var(--background)" : "transparent",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}><Check size={12} sw={3} /></span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
                    <span className="cjk" style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                    <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".08em", opacity: 0.75 }}>
                      剩餘 {c.remaining}/{c.total} 堂 · 期限 {c.expiresAt}
                    </span>
                  </span>
                  <span className="display" style={{ fontSize: 20, fontWeight: 400 }}>{c.remaining}</span>
                </button>
              ))}
            </div>
          </div>

          {/* confirm strip */}
          <div style={{
            padding: isMobile ? "16px 20px 20px" : "20px 28px 24px",
            background: "var(--muted)",
            borderTop: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            gap: 14, flexWrap: "wrap",
          }}>
            <div style={{ minWidth: 0 }}>
              <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", color: "var(--muted-foreground)" }}>
                CONFIRM · 待教練核可
              </div>
              <div className="cjk" style={{ fontSize: 13, marginTop: 4, color: "var(--muted-foreground)" }}>
                送出後狀態為「待確認」，教練核可後會 Email 通知。
              </div>
            </div>
            <PrimaryCta size="lg">確認預約</PrimaryCta>
          </div>
        </Card>

        {/* RIGHT — package balance summary + alt actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* balance card */}
          <Card style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".15em", color: "var(--muted-foreground)" }}>
              MY BALANCE · {COACH.name}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span className="display" style={{ fontSize: 56, lineHeight: 0.9, fontWeight: 400 }}>24</span>
              <span className="cjk" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>堂可用 · 2 個套裝</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
              {MY_PACKAGES.map((p, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 12px", borderRadius: 10,
                  background: "var(--muted)",
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="cjk" style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>剩 {p.remaining}/{p.total} · ~{p.expiresAt}</div>
                  </div>
                </div>
              ))}
            </div>
            <Btn variant="secondary" size="sm" fullWidth>查看所有套裝</Btn>
          </Card>

          {/* warning card */}
          <Card style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12, background: "var(--secondary)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "var(--accent)", color: "var(--accent-foreground)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}><Alert size={14} sw={2.5} /></span>
              <span className="cjk display" style={{ fontSize: 16, fontWeight: 900 }}>取消政策</span>
            </div>
            <ul className="cjk" style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7, color: "var(--muted-foreground)" }}>
              <li>開始前 <strong style={{ color: "var(--foreground)" }}>24 小時</strong>以上取消、堂數退回套裝</li>
              <li>24 小時內取消 / 改期、堂數不退回</li>
              <li>未到場視同已上完一堂</li>
            </ul>
            <Btn variant="ghost" size="sm" style={{ alignSelf: "flex-start", color: "var(--muted-foreground)" }}>
              查看完整條款 <Arrow size={13}/>
            </Btn>
          </Card>

          {/* no-balance alt state preview */}
          <div style={{
            padding: 18, borderRadius: 14,
            border: "1.5px dashed var(--border)",
            display: "flex", gap: 12, alignItems: "flex-start",
          }}>
            <span style={{
              width: 26, height: 26, borderRadius: "50%",
              background: "var(--muted)", color: "var(--muted-foreground)",
              display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}><Info size={14} /></span>
            <div>
              <div className="cjk" style={{ fontSize: 12.5, fontWeight: 600 }}>沒有套裝餘額時會怎樣？</div>
              <div className="cjk" style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4, lineHeight: 1.55 }}>
                此處會顯示「需先購買套裝」、按鈕變灰、並附「前往套裝頁面」連結。
              </div>
            </div>
          </div>
        </div>
      </section>
    </Mockup>
  );
}

Object.assign(window, { BookPage });
