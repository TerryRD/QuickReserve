// coach/page-rules.jsx — /calendar/rules

const RULES = [
  {
    id: "r1", title: "每週二、四 19:00 一對一", type: "weekly", weekdays: [2, 4], time: "19:00",
    endKind: "until", end: "2026-12-31", appliedCount: 38, hasConflict: false,
  },
  {
    id: "r2", title: "每天 14:00 體態評估", type: "daily", time: "14:00",
    endKind: "count", count: 20, appliedCount: 14, hasConflict: true, conflicts: 2,
  },
  {
    id: "r3", title: "每月第 1 個週六晨間團班", type: "monthly", nth: 1, weekday: 6, time: "08:00",
    endKind: "infinite", appliedCount: 6, hasConflict: false,
  },
  {
    id: "r4", title: "每 3 天輪休（不開放）", type: "every-n", n: 3, time: "—",
    endKind: "infinite", appliedCount: 12, hasConflict: false, isOff: true,
  },
];

function RuleRow({ r, expanded, size }) {
  const isMobile = size === "mobile";
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 16, overflow: "hidden",
      ...(expanded ? { borderColor: "var(--foreground)", boxShadow: "0 0 0 2px var(--foreground), 0 12px 32px -16px rgba(0,0,0,.22)" } : {}),
    }}>
      <div style={{
        padding: isMobile ? "16px 18px" : "20px 22px",
        display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap",
      }}>
        <span style={{
          width: 44, height: 44, borderRadius: 12,
          background: r.isOff ? "var(--muted)" : "var(--secondary)",
          color: r.isOff ? "var(--muted-foreground)" : "var(--foreground)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {r.type === "daily"   && <Sparkle size={18} />}
          {r.type === "weekly"  && <Calendar size={18} />}
          {r.type === "monthly" && <Star size={18} />}
          {r.type === "every-n" && <Hash size={18} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span className="cjk display" style={{ fontSize: 16, fontWeight: 900 }}>{r.title}</span>
            {r.isOff && (
              <Pill variant="outline">不開放</Pill>
            )}
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 4, letterSpacing: ".06em" }}>
            {r.type === "daily"   && `每天 · ${r.time}`}
            {r.type === "weekly"  && `每週 · ${r.weekdays.map(w => ["", "一","二","三","四","五","六","日"][w]).join("、")} · ${r.time}`}
            {r.type === "monthly" && `每月第 ${r.nth} 個 週${["", "一","二","三","四","五","六","日"][r.weekday]} · ${r.time}`}
            {r.type === "every-n" && `每 ${r.n} 天 · ${r.time}`}
            {" · "}
            {r.endKind === "until" && `至 ${r.end}`}
            {r.endKind === "count" && `共 ${r.count} 次`}
            {r.endKind === "infinite" && `持續展開`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Pill variant="outline" icon={<Calendar size={11} />}>已展開 {r.appliedCount} 堂</Pill>
          {r.hasConflict && (
            <button style={{
              ...BTN_BASE,
              height: 26, padding: "0 10px", borderRadius: 999, gap: 6,
              background: "color-mix(in oklab, var(--destructive) 14%, var(--card))",
              color: "var(--destructive)",
              border: "1px solid color-mix(in oklab, var(--destructive) 28%, var(--border))",
              fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em",
            }} title="點擊跳到衝突">
              <Alert size={11} sw={2.5} /> {r.conflicts} 衝突
            </button>
          )}
          <Btn variant="secondary" size="sm"><Edit size={13}/> 編輯</Btn>
          <Btn variant="ghost" size="sm" style={{ color: "var(--muted-foreground)" }}><MoreV size={14}/></Btn>
        </div>
      </div>

      {expanded && (
        <div style={{
          background: "var(--muted)",
          padding: isMobile ? "20px" : "24px 26px",
          borderTop: "1px solid var(--border)",
          display: "flex", flexDirection: "column", gap: 18,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "var(--accent)", color: "var(--accent-foreground)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}><Edit size={11} /></span>
            <span className="cjk display" style={{ fontSize: 16, fontWeight: 900 }}>編輯規則</span>
          </div>

          <Field label="規則名稱"><TextInput value={r.title} /></Field>

          {/* repeat type radio (segmented) */}
          <div>
            <div className="cjk" style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>重複類型</div>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
              gap: 8,
            }}>
              {[
                { id: "daily",   label: "每天",        sub: "no params" },
                { id: "weekly",  label: "每週",        sub: "選週幾" },
                { id: "monthly", label: "每月第 N 個", sub: "選週次 + 週幾" },
                { id: "every-n", label: "每 N 天",     sub: "選 N" },
              ].map((opt) => {
                const on = opt.id === "daily";
                return (
                  <button key={opt.id} style={{
                    ...BTN_BASE,
                    height: "auto", padding: "12px 14px", borderRadius: 14,
                    flexDirection: "column", alignItems: "flex-start", gap: 4,
                    background: on ? "var(--background)" : "var(--card)",
                    color: "var(--foreground)",
                    border: on ? "1.5px solid var(--foreground)" : "1px solid var(--border)",
                    boxShadow: on ? "0 0 0 2px var(--foreground), 0 8px 24px -18px rgba(0,0,0,.18)" : "none",
                  }}>
                    <span className="cjk" style={{ fontSize: 13.5, fontWeight: 600 }}>{opt.label}</span>
                    <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-foreground)", letterSpacing: ".08em" }}>{opt.sub.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* dynamic params depending on type */}
          <div style={{
            padding: 16, borderRadius: 14,
            background: "var(--background)", border: "1.5px dashed var(--border)",
          }}>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".15em", color: "var(--muted-foreground)", marginBottom: 10 }}>
              PARAMS · 每天規則
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 12,
            }}>
              <Field label="開始時間"><TextInput value="14:00" /></Field>
              <Field label="每堂時長"><TextInput value="90 分鐘" suffix={<Arrow size={13}/>} /></Field>
              <Field label="套用服務"><TextInput value="體態評估與諮詢" suffix={<Arrow size={13}/>} /></Field>
              <Field label="套用助教"><TextInput value="陳柏宇（自己）" suffix={<Arrow size={13}/>} /></Field>
            </div>
          </div>

          {/* end condition */}
          <div>
            <div className="cjk" style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>結束條件</div>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
              gap: 8,
            }}>
              {[
                { id: "count",   label: "重複 N 次",  param: <TextInput value="20" /> },
                { id: "until",   label: "至指定日期", param: <TextInput value="2026-12-31" /> },
                { id: "infinite",label: "無限制",     param: <span className="mono" style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>持續展開未來 4 週</span> },
              ].map((opt) => {
                const on = opt.id === "count";
                return (
                  <div key={opt.id} style={{
                    padding: 14, borderRadius: 14,
                    background: on ? "var(--background)" : "var(--card)",
                    border: on ? "1.5px solid var(--foreground)" : "1px solid var(--border)",
                    boxShadow: on ? "0 0 0 1.5px var(--foreground)" : "none",
                    display: "flex", flexDirection: "column", gap: 8,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: "50%",
                        border: "1.5px solid var(--foreground)",
                        background: on ? "var(--foreground)" : "transparent",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {on && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />}
                      </span>
                      <span className="cjk" style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</span>
                    </div>
                    <div style={{ paddingLeft: 24 }}>{opt.param}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* conflict preview */}
          {r.hasConflict && (
            <div style={{
              padding: "14px 16px", borderRadius: 12,
              background: "color-mix(in oklab, var(--destructive) 10%, var(--card))",
              border: "1px solid color-mix(in oklab, var(--destructive) 28%, var(--border))",
              display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <span style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: "color-mix(in oklab, var(--destructive) 20%, var(--card))",
                color: "var(--destructive)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><Alert size={14} sw={2.5} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cjk" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--foreground)" }}>
                  本規則展開時與 {r.conflicts} 個既有時段衝突
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {[
                    "9/3 (三) 14:00 · 與「9/3 上午 進修課程」延續到 14:00",
                    "10/10 (五) 14:00 · 與既有 預約 b32 (李雅文)",
                  ].map((c, i) => (
                    <a key={i} href="#" className="cjk" style={{
                      fontSize: 12, color: "var(--foreground)",
                      padding: "6px 10px", borderRadius: 8,
                      background: "var(--background)",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      textDecoration: "none", gap: 8,
                    }}>
                      <span>{c}</span>
                      <Arrow size={12} />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <Btn variant="ghost" size="md" style={{ color: "var(--destructive)" }}><Trash size={13}/> 刪除規則</Btn>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="ghost" size="md">取消</Btn>
              <PrimaryCta size="md">儲存並展開</PrimaryCta>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RulesPage({ size = "desktop" }) {
  const isMobile = size === "mobile";
  return (
    <AppShell active="settings" size={size} title="重複規則">
      <PageHeader
        kicker="CALENDAR · 重複規則"
        title="重複規則"
        eng="RULES"
        hint="比作息模板更彈性的時段定義 — 適合一次性或不定期重複的安排（每月第 N 個、每 N 天等）。展開後可即時偵測與既有時段的衝突。"
        size={size}
        action={!isMobile && <PrimaryCta size="md"><Plus size={14}/> 新增規則</PrimaryCta>}
      />
      <SettingsTabs active="rules" size={size} />

      <div style={{ maxWidth: 1080, display: "flex", flexDirection: "column", gap: 12 }}>
        {RULES.map((r, i) => (
          <RuleRow key={r.id} r={r} size={size} expanded={i === 1} />
        ))}
      </div>

      {/* empty state preview */}
      <div style={{
        marginTop: 28, maxWidth: 1080,
        padding: isMobile ? "28px 18px" : 40,
        border: "1.5px dashed var(--border)", borderRadius: 18,
        display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap",
      }}>
        <span style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "var(--secondary)", color: "var(--muted-foreground)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><Sparkle size={24} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="cjk display" style={{ fontSize: 18, margin: 0, fontWeight: 900 }}>還沒設定任何規則？</h3>
          <p className="cjk" style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "6px 0 0", maxWidth: 540, lineHeight: 1.6 }}>
            若你的時段相對固定，先用「作息模板」就好；規則適合一次性或不定期重複的情境（例如每月第一個週六的活動課）。
          </p>
        </div>
        <Btn variant="secondary" size="md">查看作息模板 <Arrow size={13}/></Btn>
      </div>
    </AppShell>
  );
}

Object.assign(window, { RulesPage });
