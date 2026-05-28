// coach/page-packages.jsx — /packages + /packages/pending

function CoachPackageCard({ pkg, size }) {
  const isMobile = size === "mobile";
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 16, padding: isMobile ? 18 : 22,
      display: "flex", flexDirection: "column", gap: 12, position: "relative",
    }}>
      {pkg.popular && (
        <span style={{
          position: "absolute", top: 16, right: 16,
          background: "var(--accent)", color: "var(--accent-foreground)",
          padding: "4px 10px", borderRadius: 999,
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: ".12em",
        }}>★ POPULAR</span>
      )}
      <div className="mono" style={{
        display: "flex", alignItems: "center", gap: 8,
        fontSize: 10.5, fontWeight: 700, letterSpacing: ".18em",
        color: "var(--muted-foreground)",
      }}>
        <span style={{ width: 14, height: 2, background: "var(--accent)", borderRadius: 2 }} />
        PACKAGE
      </div>
      <h3 className="cjk display" style={{ fontSize: 19, margin: 0, fontWeight: 900, lineHeight: 1.15, maxWidth: pkg.popular ? "70%" : "100%" }}>
        {pkg.name}
      </h3>
      <div className="cjk" style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>
        <span className="mono">{pkg.lessons} 堂</span> · {pkg.expiry} · <span className="mono">{pkg.holders} 人持有</span>
      </div>
      <div style={{
        marginTop: 4, paddingTop: 12, borderTop: "1px dashed var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
      }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".06em" }}>
          每堂 NT$ {Math.round(pkg.price / pkg.lessons).toLocaleString()}
        </span>
        <span className="display" style={{
          fontSize: 24, fontWeight: 400,
          borderBottom: "3px solid var(--accent)", paddingBottom: 1, lineHeight: 1,
        }}>NT$ {pkg.price.toLocaleString()}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <Btn variant="secondary" size="sm" style={{ flex: 1 }}><Edit size={13}/> 編輯</Btn>
        <Btn variant="ghost" size="sm" style={{ color: "var(--muted-foreground)" }}><Trash size={13}/></Btn>
      </div>
    </div>
  );
}

function PackagesPageCoach({ size = "desktop" }) {
  const isMobile = size === "mobile";
  const isTablet = size === "tablet";
  const byService = COACH_SERVICES.map((s) => ({
    service: s,
    packages: COACH_PACKAGES.filter((p) => p.serviceId === s.id),
  })).filter((g) => g.packages.length > 0);

  return (
    <AppShell active="packages" size={size} title="套裝管理">
      <PageHeader
        kicker="PACKAGES · 套裝管理"
        title="套裝"
        eng="PACKAGES"
        hint="管理你的所有套裝。按服務分組、學員從公開頁可以看到「使用中」的套裝、申請後等你核可。"
        size={size}
        action={!isMobile && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Btn variant="ghost" size="sm" style={{ color: "var(--muted-foreground)" }}>
              <Layers size={13}/> 審核列表 <span className="mono" style={{ marginLeft: 4, padding: "1px 7px", borderRadius: 999, background: "var(--accent)", color: "var(--accent-foreground)", fontSize: 10 }}>3</span>
            </Btn>
            <PrimaryCta size="md"><Plus size={14}/> 新增套裝</PrimaryCta>
          </div>
        )}
      />

      {/* tabs + meta row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <TabBar
          tabs={[{ id: "active", label: "使用中" }, { id: "deleted", label: "已刪除" }]}
          active="active"
          counts={{ active: COACH_PACKAGES.length, deleted: 2 }}
        />
        <div className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".1em" }}>
          共 {COACH_PACKAGES.length} 個套裝 · 持有人總計 {COACH_PACKAGES.reduce((a, p) => a + p.holders, 0)}
        </div>
      </div>

      {/* grouped grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 4 }}>
        {byService.map((g, gi) => (
          <div key={g.service.id}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 14 }}>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".18em" }}>
                GROUP / 0{gi + 1}
              </span>
              <h2 className="cjk display" style={{ fontSize: 22, margin: 0, fontWeight: 900 }}>{g.service.name}</h2>
              <span className="cjk" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>· {g.service.duration} 分鐘 · {g.packages.length} 個套裝</span>
              <span aria-hidden style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(3, 1fr)",
              gap: 14,
            }}>
              {g.packages.map((p) => <CoachPackageCard key={p.id} pkg={p} size={size} />)}
              {/* add-new placeholder card */}
              <button style={{
                ...BTN_BASE,
                flexDirection: "column", gap: 8,
                borderRadius: 16, padding: 22,
                background: "transparent",
                border: "1.5px dashed var(--border)",
                color: "var(--muted-foreground)",
                height: "auto", alignItems: "center", justifyContent: "center",
                minHeight: 180,
              }}>
                <span style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: "var(--secondary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}><Plus size={18} /></span>
                <span className="cjk" style={{ fontSize: 13, fontWeight: 600 }}>新增 {g.service.name} 套裝</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

// ── /packages/pending ───────────────────────────────────────────
function PendingRow({ p, size, expanded }) {
  const isMobile = size === "mobile";
  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      overflow: "hidden",
      ...(expanded ? { borderColor: "var(--foreground)", boxShadow: "0 0 0 2px var(--foreground), 0 12px 32px -16px rgba(0,0,0,.22)" } : {}),
    }}>
      <div style={{
        padding: isMobile ? "18px 18px 14px" : "20px 22px",
        display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap",
      }}>
        <Avatar size={44} initial={p.student[0]} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span className="cjk display" style={{ fontSize: 17, fontWeight: 900 }}>{p.student}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>· {p.email}</span>
          </div>
          <div className="cjk" style={{ fontSize: 13, marginTop: 6, color: "var(--foreground)" }}>
            申請 <strong>{p.pkgName}</strong> · {p.lessons} 堂 · <span className="display">NT$ {p.price.toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Pill variant={p.payState === "已轉帳" ? "yellow" : "outline"}>
              付款 · {p.payState}
            </Pill>
            <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".08em" }}>{p.since}</span>
          </div>
          {p.note && (
            <div className="cjk" style={{
              fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 8,
              padding: "8px 12px", borderRadius: 10, background: "var(--muted)",
            }}>
              <span className="mono" style={{ marginRight: 6, fontSize: 10 }}>NOTE</span>{p.note}
            </div>
          )}
        </div>
        <div style={{
          display: "flex", flexDirection: isMobile ? "row" : "column",
          gap: 8, width: isMobile ? "100%" : "auto",
          minWidth: isMobile ? 0 : 140,
        }}>
          <Btn variant="primary" size="sm" style={{ flex: 1 }}><Check size={13} sw={2.5}/> 同意</Btn>
          <Btn variant="ghost" size="sm" style={{ flex: 1, color: "var(--muted-foreground)" }}><X size={13} sw={2.5}/> 拒絕</Btn>
        </div>
      </div>
    </div>
  );
}

function PackagesPendingPage({ size = "desktop" }) {
  const isMobile = size === "mobile";
  return (
    <AppShell active="packages" size={size} title="套裝審核">
      <PageHeader
        kicker="PACKAGES · 審核列表"
        title="套裝申請"
        eng="PENDING"
        hint={`目前有 ${PENDING_PKG.length} 筆等待你核可。同意後該套裝會出現在學員的「我的套裝」、可開始預約。`}
        size={size}
        action={!isMobile && (
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="ghost" size="sm" style={{ color: "var(--muted-foreground)" }}>
              <Layers size={13}/> 歷史紀錄 <Arrow size={13}/>
            </Btn>
            <Btn variant="secondary" size="sm"><Filter size={13}/> 篩選</Btn>
          </div>
        )}
      />

      {/* counter row */}
      <div style={{
        marginBottom: 18,
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
        gap: 1, background: "var(--border)",
        border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden",
        maxWidth: 880,
      }}>
        {[
          ["待審核", PENDING_PKG.length, "筆"],
          ["已付款",  PENDING_PKG.filter(p => p.payState === "已轉帳").length, "筆"],
          ["金額合計", `NT$ ${PENDING_PKG.reduce((a, p) => a + p.price, 0).toLocaleString()}`, ""],
          ["最久等待", "2 天", ""],
        ].map(([k, v, u], i) => (
          <div key={i} style={{ background: "var(--card)", padding: "14px 18px" }}>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".15em", color: "var(--muted-foreground)" }}>{k}</div>
            <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 4 }}>
              <span className="display" style={{ fontSize: 24, fontWeight: 400 }}>{v}</span>
              {u && <span className="cjk" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{u}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 880 }}>
        {PENDING_PKG.map((p, i) => <PendingRow key={p.id} p={p} size={size} expanded={i === 0} />)}
      </div>
    </AppShell>
  );
}

Object.assign(window, { PackagesPageCoach, PackagesPendingPage });
