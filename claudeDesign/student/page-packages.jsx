// student/page-packages.jsx — /<slug>/packages

function PackageCard({ pkg, expanded, size }) {
  const isMobile = size === "mobile";
  return (
    <Card padded={false} style={{
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      borderColor: expanded ? "var(--foreground)" : "var(--border)",
      boxShadow: expanded ? "0 0 0 2px var(--foreground), 0 12px 32px -16px rgba(0,0,0,.22)" : undefined,
    }}>
      <div style={{ padding: isMobile ? 20 : 26, display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
        {pkg.popular && (
          <span style={{
            position: "absolute", top: 18, right: 18,
            background: "var(--accent)", color: "var(--accent-foreground)",
            padding: "5px 12px", borderRadius: "999px",
            fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}><Star size={11} /> POPULAR</span>
        )}
        <div className="mono" style={{
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 10.5, fontWeight: 700, letterSpacing: ".18em",
          color: "var(--muted-foreground)",
        }}>
          <span style={{ width: 14, height: 2, background: "var(--accent)", borderRadius: 2 }} />
          PACKAGE
        </div>
        <div>
          <h3 className="cjk display" style={{ fontSize: isMobile ? 22 : 26, margin: 0, fontWeight: 900, lineHeight: 1.15 }}>
            {pkg.name}
          </h3>
          <div className="cjk" style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6 }}>
            <span className="mono" style={{ fontSize: 12, marginRight: 8 }}>{pkg.lessons} 堂</span>
            ·　{pkg.expiry}
          </div>
        </div>
        <div style={{
          paddingTop: 12, borderTop: "1px dashed var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
        }}>
          <div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".1em" }}>每堂</div>
            <div className="display" style={{ fontSize: 18, marginTop: 2 }}>NT$ {pkg.perLesson.toLocaleString()}</div>
          </div>
          <span className="display" style={{
            fontSize: 32, fontWeight: 400,
            borderBottom: "3px solid var(--accent)", paddingBottom: 1, lineHeight: 1,
          }}>NT$ {pkg.price.toLocaleString()}</span>
        </div>
        {!expanded && <Btn variant="primary" size="md" fullWidth>申請此套裝 <Arrow size={13}/></Btn>}
      </div>

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
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
            }}>i</span>
            <span className="cjk" style={{ fontSize: 13, fontWeight: 600 }}>申請套裝</span>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".1em" }}>· 教練核可後生效</span>
          </div>
          <Field label="付款狀態">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                ["已轉帳", true],
                ["現場付款", false],
                ["未付款 (預約後再付)", false],
              ].map(([label, sel], i) => (
                <button key={i} style={{
                  ...BTN_BASE,
                  padding: "10px 16px", height: "auto",
                  borderRadius: 999, fontSize: 12.5,
                  border: sel ? "1.5px solid var(--foreground)" : "1px solid var(--border)",
                  background: sel ? "var(--foreground)" : "var(--card)",
                  color: sel ? "var(--background)" : "var(--foreground)",
                }}>
                  {sel && <Check size={11} sw={3} />} {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="收據備註（選填）" hint="例：匯款後五碼、付款日期、現場付款方式">
            <TextInput placeholder="末五碼 12345 · 08/19 轉帳" />
          </Field>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Btn variant="ghost" size="md">收起</Btn>
            <PrimaryCta size="md">送出申請</PrimaryCta>
          </div>
        </div>
      )}
    </Card>
  );
}

function PackagesPage({ size = "desktop" }) {
  const isMobile = size === "mobile";
  const isTablet = size === "tablet";
  const padX = isMobile ? 20 : isTablet ? 40 : 72;
  // group packages by service
  const byService = SERVICES.map((s) => ({
    service: s,
    packages: PACKAGES.filter((p) => p.serviceId === s.id),
  })).filter((g) => g.packages.length > 0);

  return (
    <Mockup>
      <TopBar variant="public-out" size={size} crumb={"/" + COACH.slug + "/packages"} />

      <section style={{ padding: `${isMobile ? 24 : 40}px ${padX}px ${isMobile ? 16 : 24}px` }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <Btn variant="ghost" size="sm"><ArrowL size={13}/> 返回 {COACH.name} 主頁</Btn>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div className="mono" style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 8 }}>
              PACKAGES · {COACH.name}
            </div>
            <h1 className="display" style={{
              fontSize: isMobile ? 56 : 88, lineHeight: 0.9, margin: 0, fontWeight: 400,
              textTransform: "uppercase", letterSpacing: "-0.01em",
              display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap",
            }}>
              <span className="cjk">套裝</span>
              <span style={{ position: "relative", display: "inline-block" }}>
                PACKAGES
                <span aria-hidden style={{
                  position: "absolute", left: 0, right: 0, bottom: -2,
                  height: 6, background: "var(--accent)", borderRadius: 6,
                }} />
              </span>
            </h1>
            <p className="cjk" style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted-foreground)", maxWidth: 540, marginTop: 14 }}>
              買套裝享更划算的單堂單價。送出申請後等教練核可、確認付款狀態，核可後即可預約時段。
            </p>
          </div>
        </div>
      </section>

      {/* AuthCta */}
      <section style={{ padding: `0 ${padX}px ${isMobile ? 24 : 32}px` }}>
        <Banner
          variant="info"
          icon={<Info size={20} />}
          title="申請套裝前需要登入"
          body="登入或註冊後填寫付款狀態、送出後等教練核可。"
          action={!isMobile && (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" size="sm">建立帳號</Btn>
              <Btn variant="primary" size="sm">登入</Btn>
            </div>
          )}
        />
      </section>

      {/* groups */}
      <section style={{ padding: `0 ${padX}px ${isMobile ? 48 : 80}px`, display: "flex", flexDirection: "column", gap: 36 }}>
        {byService.map((g, gi) => (
          <div key={g.service.id}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 18 }}>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".18em" }}>
                GROUP / 0{gi + 1}
              </span>
              <h2 className="cjk display" style={{ fontSize: isMobile ? 24 : 30, margin: 0, fontWeight: 900 }}>
                {g.service.name}
              </h2>
              <span className="cjk" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>· {g.service.duration} 分鐘</span>
              <span aria-hidden style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(2, 1fr)",
              gap: isMobile ? 14 : 20,
              alignItems: "start",
            }}>
              {g.packages.map((p, pi) => (
                <PackageCard
                  key={p.id}
                  pkg={p}
                  size={size}
                  /* expand the popular one in the first group, to show the inline form */
                  expanded={gi === 0 && p.popular}
                />
              ))}
            </div>
          </div>
        ))}

        {/* empty state */}
        <div style={{
          padding: isMobile ? "32px 20px" : 48,
          border: "1.5px dashed var(--border)", borderRadius: 18,
          textAlign: "center",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "var(--secondary)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--muted-foreground)",
          }}><Plus size={22} /></div>
          <h3 className="cjk display" style={{ fontSize: 18, margin: 0, fontWeight: 900 }}>還沒看到喜歡的方案？</h3>
          <p className="cjk" style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0, maxWidth: 380 }}>
            可以直接私訊教練詢問客製套裝。教練建立後會出現在這個頁面。
          </p>
        </div>
      </section>
    </Mockup>
  );
}

Object.assign(window, { PackagesPage, PackageCard });
