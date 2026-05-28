// coach/page-services-customers.jsx — /services + /customers

// ─── Service edit card ────────────────────────────────────────
function ServiceEditCard({ s, size, expanded }) {
  const isMobile = size === "mobile";
  const isGroup = s.capacity > 1;
  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      overflow: "hidden",
      ...(expanded ? { borderColor: "var(--foreground)", boxShadow: "0 0 0 2px var(--foreground), 0 12px 32px -16px rgba(0,0,0,.22)" } : {}),
    }}>
      <div style={{
        padding: isMobile ? "18px" : "22px 24px",
        display: "flex", flexDirection: "column", gap: 12, position: "relative",
      }}>
        {/* corner badges */}
        <div style={{ display: "flex", gap: 6, position: "absolute", top: 18, right: 20, alignItems: "center" }}>
          {isGroup && (
            <span className="mono" style={{
              fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
              background: "var(--accent)", color: "var(--accent-foreground)", letterSpacing: ".1em",
            }}>GROUP · {s.capacity}</span>
          )}
          <span className="mono" style={{
            fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 999,
            background: "var(--secondary)", color: "var(--muted-foreground)", letterSpacing: ".08em",
          }}>{s.active} 開設中</span>
        </div>

        <div className="mono" style={{
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 10.5, fontWeight: 700, letterSpacing: ".18em",
          color: "var(--muted-foreground)",
        }}>
          <span style={{ width: 14, height: 2, background: "var(--accent)", borderRadius: 2 }} />
          SERVICE
        </div>
        <h3 className="cjk display" style={{ fontSize: 20, margin: 0, fontWeight: 900, lineHeight: 1.2, maxWidth: "70%" }}>
          {s.name}
        </h3>
        <p className="cjk" style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: "var(--muted-foreground)" }}>{s.desc}</p>

        {/* param grid */}
        <div style={{
          marginTop: 6,
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)",
          gap: 1, background: "var(--border)",
          border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden",
        }}>
          {[
            ["時長",        `${s.duration} 分`],
            ["價格",        `NT$ ${s.price.toLocaleString()}`],
            ["最大人數",    `${s.capacity}`],
            ["最低開課",    `${s.minAttend}`],
            ["取消期限",    `${s.cancelHrs} 小時`],
          ].map(([k, v], i) => (
            <div key={i} style={{ background: "var(--card)", padding: "8px 12px" }}>
              <div className="mono" style={{ fontSize: 9.5, letterSpacing: ".15em", color: "var(--muted-foreground)" }}>{k}</div>
              <div className="display" style={{ fontSize: 14, marginTop: 2, fontWeight: 400 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <Btn variant="secondary" size="sm" style={{ flex: 1 }}><Edit size={13}/> 編輯</Btn>
          <Btn variant="ghost" size="sm" style={{ color: "var(--muted-foreground)" }}><Layers size={13}/> 套裝</Btn>
          <Btn variant="ghost" size="sm" style={{ color: "var(--muted-foreground)" }}><Trash size={13}/></Btn>
        </div>
      </div>

      {/* expanded edit form */}
      {expanded && (
        <div style={{
          background: "var(--muted)",
          padding: isMobile ? "20px" : "24px 26px",
          borderTop: "1px solid var(--border)",
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "var(--accent)", color: "var(--accent-foreground)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}><Edit size={11} /></span>
            <span className="cjk display" style={{ fontSize: 16, fontWeight: 900 }}>編輯服務</span>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: 14,
          }}>
            <Field label="服務名稱"><TextInput value={s.name} /></Field>
            <Field label="時長 (分鐘)"><TextInput value={String(s.duration)} /></Field>
            <Field label="價格 (NT$)"><TextInput value={String(s.price)} /></Field>
            <Field label="最大人數 (Capacity)" hint="1 = 一對一、≥2 = 團班"><TextInput value={String(s.capacity)} /></Field>
            <Field label="最低開課人數" hint="未達將自動取消"><TextInput value={String(s.minAttend)} /></Field>
            <Field label="取消期限 (小時)" hint="開課前多少小時內取消不退堂數"><TextInput value={String(s.cancelHrs)} /></Field>
          </div>
          <Field label="說明"><TextInput value={s.desc} /></Field>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Btn variant="ghost" size="md">取消</Btn>
            <PrimaryCta size="md">儲存變更</PrimaryCta>
          </div>
        </div>
      )}
    </div>
  );
}

function ServicesPage({ size = "desktop" }) {
  const isMobile = size === "mobile";
  const isTablet = size === "tablet";
  return (
    <AppShell active="services" size={size} title="服務管理">
      <PageHeader
        kicker="SERVICES · 服務管理"
        title="服務"
        eng="SERVICES"
        hint="管理可被學員預約的所有服務。團班服務需設定 Capacity / 最低開課人數 / 取消期限三個參數。"
        size={size}
        action={!isMobile && <PrimaryCta size="md"><Plus size={14}/> 新增服務</PrimaryCta>}
      />

      <TabBar
        tabs={[{ id: "active", label: "使用中" }, { id: "deleted", label: "已刪除" }]}
        active="active"
        counts={{ active: COACH_SERVICES.length, deleted: 1 }}
      />

      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr",
        gap: 16,
      }}>
        {COACH_SERVICES.map((s, i) => (
          <ServiceEditCard key={s.id} s={s} size={size} expanded={i === 0} />
        ))}
      </div>
    </AppShell>
  );
}

// ─── /customers ───────────────────────────────────────────────
function CustomerRow({ c, size, selected }) {
  const isMobile = size === "mobile";
  return (
    <button style={{
      ...BTN_BASE,
      width: "100%", textAlign: "left", justifyContent: "flex-start", alignItems: "center",
      gap: 14, padding: isMobile ? "14px 16px" : "16px 20px",
      borderRadius: 14,
      background: selected ? "var(--secondary)" : "transparent",
      border: selected ? "1.5px solid var(--foreground)" : "1px solid var(--border)",
      height: "auto",
    }}>
      <Avatar size={isMobile ? 36 : 44} initial={c.name[0]} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span className="cjk display" style={{ fontSize: 15, fontWeight: 900 }}>{c.name}</span>
          {c.status === "new" && (
            <span className="mono" style={{
              fontSize: 9.5, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
              background: "var(--accent)", color: "var(--accent-foreground)", letterSpacing: ".1em",
            }}>NEW</span>
          )}
          {!isMobile && <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>· {c.email}</span>}
        </div>
        {isMobile && <div className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{c.email}</div>}
      </div>
      {!isMobile && (
        <>
          <div style={{ textAlign: "right", minWidth: 60 }}>
            <div className="display" style={{ fontSize: 18, fontWeight: 400, lineHeight: 1 }}>{c.bookings}</div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-foreground)", letterSpacing: ".08em", marginTop: 2 }}>BOOKINGS</div>
          </div>
          <div style={{ textAlign: "right", minWidth: 80 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 3, justifyContent: "flex-end" }}>
              <span className="display" style={{ fontSize: 18, fontWeight: 400, lineHeight: 1, color: c.balance > 0 ? "var(--foreground)" : "var(--muted-foreground)" }}>{c.balance}</span>
              <span className="cjk" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>堂</span>
            </div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-foreground)", letterSpacing: ".08em", marginTop: 2 }}>BALANCE</div>
          </div>
          <div style={{ textAlign: "right", minWidth: 100 }}>
            <div className="mono" style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{c.lastSeen}</div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-foreground)", letterSpacing: ".08em", marginTop: 2 }}>LAST SEEN</div>
          </div>
        </>
      )}
      {isMobile && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span className="display" style={{ fontSize: 18, lineHeight: 1 }}>{c.bookings}</span>
          <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-foreground)" }}>{c.balance} 堂</span>
        </div>
      )}
      <Arrow size={14} />
    </button>
  );
}

// Detail drawer (shown on the right, persistent in mockup state)
function CustomerDrawer({ c }) {
  return (
    <aside style={{
      width: 380, flexShrink: 0, borderLeft: "1px solid var(--border)",
      background: "var(--card)",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        padding: "22px 24px",
        borderBottom: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".15em", color: "var(--muted-foreground)" }}>CUSTOMER · DETAIL</div>
        <Btn variant="ghost" size="sm" style={{ width: 32, padding: 0, color: "var(--muted-foreground)" }}><X size={14}/></Btn>
      </div>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 6 }}>
        <Avatar size={64} initial={c.name[0]} />
        <h2 className="cjk display" style={{ fontSize: 26, margin: "12px 0 0", fontWeight: 900 }}>{c.name}</h2>
        <div className="mono" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{c.email}</div>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <Pill variant="outline">{c.bookings} 次預約</Pill>
          <Pill variant="outline">{c.balance} 堂可用</Pill>
        </div>
      </div>

      {/* recent bookings */}
      <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".15em", color: "var(--muted-foreground)" }}>近期預約</div>
        {[
          { d: "8/19 二 16:00", s: "一對一肌力", st: "confirmed" },
          { d: "8/12 二 16:00", s: "一對一肌力", st: "completed" },
          { d: "8/05 二 16:00", s: "體態評估與諮詢", st: "completed" },
        ].map((r, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 12px", borderRadius: 10, background: "var(--muted)",
            gap: 10,
          }}>
            <div style={{ minWidth: 0 }}>
              <div className="mono" style={{ fontSize: 11.5, letterSpacing: ".05em", fontVariantNumeric: "tabular-nums" }}>{r.d}</div>
              <div className="cjk" style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 2 }}>{r.s}</div>
            </div>
            <StatusBadge status={r.st} />
          </div>
        ))}
      </div>

      {/* packages */}
      <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".15em", color: "var(--muted-foreground)" }}>持有套裝</div>
        {[
          { name: "10 堂套裝・一對一", rem: 6, total: 10, exp: "2026-10-15" },
          { name: "體態評估單堂", rem: 0, total: 1, exp: "已用完" },
        ].map((p, i) => (
          <div key={i} style={{
            padding: "12px 14px", borderRadius: 12,
            border: "1px solid var(--border)", background: "var(--background)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span className="cjk" style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
              <span className="display" style={{ fontSize: 18 }}>{p.rem}<span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>/{p.total}</span></span>
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 4, letterSpacing: ".08em" }}>EXP · {p.exp}</div>
            {/* progress */}
            <div style={{ marginTop: 8, height: 4, background: "var(--muted)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(p.rem / p.total) * 100}%`, background: "var(--accent)" }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "auto", padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
        <Btn variant="secondary" size="sm" style={{ flex: 1 }}><Mail size={13}/> 寄信</Btn>
        <Btn variant="secondary" size="sm" style={{ flex: 1 }}><Plus size={13}/> 新增預約</Btn>
      </div>
    </aside>
  );
}

function CustomersPage({ size = "desktop" }) {
  const isMobile = size === "mobile";
  const isTablet = size === "tablet";
  const showDrawer = !isMobile && !isTablet;

  const selectedId = "c1";
  const selected = CUSTOMERS.find((c) => c.id === selectedId);

  return (
    <AppShell active="customers" size={size} title="學員管理" fullBleed>
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, padding: isMobile ? "20px" : "32px 40px", overflow: "hidden" }}>
          <PageHeader
            kicker="CUSTOMERS · 學員管理"
            title="學員"
            eng="CUSTOMERS"
            hint="所有在你帳號下註冊預約過的學員。點開查看預約紀錄與持有套裝。"
            size={size}
            action={!isMobile && (
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="secondary" size="sm"><Filter size={13}/> 篩選</Btn>
                <PrimaryCta size="md"><Plus size={14}/> 邀請學員</PrimaryCta>
              </div>
            )}
          />

          {/* search row */}
          <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 480 }}>
              <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
              <input placeholder="搜尋名字、Email…" className="cjk" style={{
                width: "100%", height: 44, paddingLeft: 38, paddingRight: 14,
                borderRadius: 999, border: "1.5px solid var(--border)",
                background: "var(--card)", color: "var(--foreground)",
                fontFamily: "var(--font-sans), var(--font-cjk)", fontSize: 14, outline: "none",
              }} />
            </div>
            <Pill icon={<Hash size={11} />}>全部 {CUSTOMERS.length}</Pill>
            <Pill icon={<Star size={11} />}>新學員 {CUSTOMERS.filter(c => c.status === "new").length}</Pill>
            <Pill variant="outline">有套裝 {CUSTOMERS.filter(c => c.balance > 0).length}</Pill>
          </div>

          {/* list header (desktop only) */}
          {!isMobile && (
            <div style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "10px 20px", marginBottom: 8,
              fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted-foreground)", letterSpacing: ".15em",
            }}>
              <div style={{ width: 44 }}></div>
              <div style={{ flex: 1 }}>NAME / EMAIL</div>
              <div style={{ width: 60, textAlign: "right" }}>BOOKINGS</div>
              <div style={{ width: 80, textAlign: "right" }}>BALANCE</div>
              <div style={{ width: 100, textAlign: "right" }}>LAST SEEN</div>
              <div style={{ width: 14 }}></div>
            </div>
          )}

          {/* rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CUSTOMERS.map((c) => <CustomerRow key={c.id} c={c} size={size} selected={c.id === selectedId} />)}
          </div>
        </div>
        {showDrawer && <CustomerDrawer c={selected} />}
      </div>
    </AppShell>
  );
}

Object.assign(window, { ServicesPage, CustomersPage });
