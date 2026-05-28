// coach/page-availability.jsx — /calendar/availability

const AVAIL_TEMPLATES = [
  {
    id: "t1", name: "工作日標準時段", scope: "一對一肌力訓練 · 雙人課程",
    weekdays: [1, 3, 5], summary: "週一三五 · 09:00–12:00 / 14:00–18:00",
    blocks: [
      { start: "09:00", end: "12:00", note: "上午" },
      { start: "14:00", end: "18:00", note: "下午" },
    ],
    active: 38, slotMins: 60,
  },
  {
    id: "t2", name: "週六晨間團班", scope: "團班・週末晨間",
    weekdays: [6], summary: "週六 · 08:00–10:30",
    blocks: [{ start: "08:00", end: "10:30", note: "晨間連續 2 場" }],
    active: 6, slotMins: 75,
  },
  {
    id: "t3", name: "晚間 - 黃彥君代班", scope: "一對一肌力訓練", staff: "黃彥君",
    weekdays: [2, 4], summary: "週二四 · 19:00–21:00",
    blocks: [{ start: "19:00", end: "21:00", note: "" }],
    active: 8, slotMins: 60,
  },
];

const UNAVAIL_EVENTS = [
  { id: "u1", title: "8/30 (六) 國慶連假",       reason: "holiday",  range: "全天",   color: "var(--destructive)" },
  { id: "u2", title: "9/3 (三) 上午 進修課程",   reason: "personal", range: "09:00–12:00", color: "var(--accent-foreground)" },
  { id: "u3", title: "9/8–9/12 出差 / 請假",     reason: "leave",    range: "5 天",   color: "var(--muted-foreground)" },
];

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

// preview slots (materialize result of selected template)
const PREVIEW_DAYS = [
  { d: 18, label: "8/18 一", count: 4, slots: ["09:00", "10:00", "11:00", "14:00"] },
  { d: 20, label: "8/20 三", count: 4, slots: ["09:00", "10:00", "11:00", "14:00"] },
  { d: 22, label: "8/22 五", count: 4, slots: ["09:00", "10:00", "11:00", "14:00"] },
  { d: 25, label: "8/25 一", count: 4, slots: ["09:00", "10:00", "11:00", "14:00"] },
  { d: 27, label: "8/27 三", count: 4, slots: ["09:00", "10:00", "11:00", "14:00"] },
  { d: 29, label: "8/29 五", count: 4, slots: ["09:00", "10:00", "11:00", "14:00"] },
];

function TemplateRow({ t, expanded, size }) {
  const isMobile = size === "mobile";
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 16, overflow: "hidden",
      ...(expanded ? { borderColor: "var(--foreground)", boxShadow: "0 0 0 2px var(--foreground), 0 12px 32px -16px rgba(0,0,0,.22)" } : {}),
    }}>
      <div style={{ padding: isMobile ? "16px 18px" : "20px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0 }}>
          <div style={{
            display: "flex", gap: 3,
            padding: 4, background: "var(--secondary)", borderRadius: 10,
          }}>
            {WEEKDAYS.map((w, i) => {
              const on = t.weekdays.includes(i + 1);
              return (
                <span key={i} style={{
                  width: 22, height: 22, borderRadius: 5,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: on ? "var(--foreground)" : "transparent",
                  color: on ? "var(--background)" : "var(--muted-foreground)",
                  fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700,
                }}>{w}</span>
              );
            })}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span className="cjk display" style={{ fontSize: 16, fontWeight: 900 }}>{t.name}</span>
              {t.staff && (
                <span className="mono" style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 700, letterSpacing: ".08em" }}>
                  STAFF · {t.staff}
                </span>
              )}
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4, letterSpacing: ".06em" }}>
              {t.summary} · {t.slotMins} 分/堂
            </div>
            <div className="cjk" style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
              {t.scope} · 已展開 {t.active} 堂
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
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
            <span className="cjk display" style={{ fontSize: 16, fontWeight: 900 }}>編輯模板</span>
          </div>
          <Field label="模板名稱"><TextInput value={t.name} /></Field>
          <Field label="套用週幾" hint="點擊切換、可複選">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {WEEKDAYS.map((w, i) => {
                const on = t.weekdays.includes(i + 1);
                const isWk = i >= 5;
                return (
                  <button key={i} style={{
                    ...BTN_BASE,
                    height: 38, width: 50, padding: 0, borderRadius: 999,
                    background: on ? "var(--foreground)" : "var(--card)",
                    color: on ? "var(--background)" : isWk ? "var(--muted-foreground)" : "var(--foreground)",
                    border: on ? "1.5px solid var(--foreground)" : "1px solid var(--border)",
                    fontSize: 13, fontWeight: 600,
                  }}>{w}</button>
                );
              })}
            </div>
          </Field>

          {/* time blocks */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="cjk" style={{ fontSize: 13, fontWeight: 600 }}>時段範圍</div>
              <Btn variant="secondary" size="sm"><Plus size={13}/> 新增時段</Btn>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {t.blocks.map((b, i) => (
                <div key={i} style={{
                  display: "flex", gap: 10, alignItems: "center",
                  padding: "12px 14px", borderRadius: 12,
                  background: "var(--background)", border: "1px solid var(--border)",
                }}>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".08em", width: 24 }}>
                    {String.fromCharCode(0x4e00 + i)}
                  </span>
                  <input defaultValue={b.start} className="mono" style={{ width: 80, height: 38, padding: "0 10px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--background)", textAlign: "center", fontSize: 13.5, outline: "none" }} />
                  <span className="mono" style={{ color: "var(--muted-foreground)" }}>—</span>
                  <input defaultValue={b.end} className="mono" style={{ width: 80, height: 38, padding: "0 10px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--background)", textAlign: "center", fontSize: 13.5, outline: "none" }} />
                  <input defaultValue={b.note} placeholder="備註（可選）" className="cjk" style={{ flex: 1, height: 38, padding: "0 12px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--background)", fontSize: 13, outline: "none" }} />
                  <Btn variant="ghost" size="sm" style={{ color: "var(--muted-foreground)", width: 32, padding: 0 }}><Trash size={13}/></Btn>
                </div>
              ))}
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 8, letterSpacing: ".05em" }}>
              每堂 60 分鐘、本模板會展開為 4 個時段（09:00 / 10:00 / 11:00 / 14:00…）
            </div>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr",
            gap: 14,
          }}>
            <Field label="套用服務">
              <TextInput value="一對一肌力 · 雙人課程" suffix={<Arrow size={13}/>} />
            </Field>
            <Field label="套用助教">
              <TextInput value="陳柏宇（自己）" suffix={<Arrow size={13}/>} />
            </Field>
            <Field label="每堂時長">
              <TextInput value="60 分鐘" suffix={<Arrow size={13}/>} />
            </Field>
            <Field label="開始日期"><TextInput value="2026-08-18" /></Field>
            <Field label="結束條件" hint="無限：持續展開未來四週">
              <TextInput value="2026-12-31" />
            </Field>
            <Field label="衝突處理" hint="與既有不可用事件同時段時">
              <TextInput value="略過該時段" suffix={<Arrow size={13}/>} />
            </Field>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <Btn variant="ghost" size="md" style={{ color: "var(--destructive)" }}>
              <Trash size={13}/> 刪除模板
            </Btn>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="ghost" size="md">取消</Btn>
              <PrimaryCta size="md">儲存並展開時段</PrimaryCta>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AvailabilityPage({ size = "desktop" }) {
  const isMobile = size === "mobile";
  return (
    <AppShell active="settings" size={size} title="作息模板">
      <PageHeader
        kicker="CALENDAR · 作息模板"
        title="作息模板"
        eng="AVAILABILITY"
        hint="設定每週可用時段、系統會自動展開為具體 slot。模板異動後需重新展開（已預約的時段不會被刪除）。"
        size={size}
        action={!isMobile && <PrimaryCta size="md"><Plus size={14}/> 新增模板</PrimaryCta>}
      />
      <SettingsTabs active="availability" size={size} />

      {/* Templates list */}
      <div style={{ maxWidth: 1080, display: "flex", flexDirection: "column", gap: 12 }}>
        {AVAIL_TEMPLATES.map((t, i) => (
          <TemplateRow key={t.id} t={t} size={size} expanded={i === 0} />
        ))}
      </div>

      {/* Unavailable events */}
      <div style={{ maxWidth: 1080, marginTop: 36 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".18em", color: "var(--muted-foreground)", marginBottom: 8 }}>
              UNAVAILABLE · 不可用事件
            </div>
            <h2 className="cjk display" style={{ fontSize: 22, margin: 0, fontWeight: 900 }}>請假 · 個人事務 · 國定假日</h2>
            <p className="cjk" style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "8px 0 0", maxWidth: 540 }}>
              新增後、模板展開時會自動避開這些時段；既有預約會在行事曆顯示衝突 badge。
            </p>
          </div>
          <Btn variant="secondary" size="md"><Plus size={13}/> 新增事件</Btn>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {UNAVAIL_EVENTS.map((u) => (
            <div key={u.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", borderRadius: 12,
              background: "var(--card)", border: "1px solid var(--border)",
            }}>
              <span style={{ width: 4, height: 36, borderRadius: 999, background: u.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cjk" style={{ fontSize: 14, fontWeight: 600 }}>{u.title}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 3, letterSpacing: ".05em" }}>
                  REASON · {u.reason.toUpperCase()} · {u.range}
                </div>
              </div>
              <Btn variant="ghost" size="sm" style={{ color: "var(--muted-foreground)" }}><Edit size={13}/></Btn>
              <Btn variant="ghost" size="sm" style={{ color: "var(--destructive)" }}><Trash size={13}/></Btn>
            </div>
          ))}
        </div>
      </div>

      {/* Materialize preview */}
      <div style={{ maxWidth: 1080, marginTop: 36 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".18em", color: "var(--muted-foreground)", marginBottom: 8 }}>
              MATERIALIZE · 預覽展開結果
            </div>
            <h2 className="cjk display" style={{ fontSize: 22, margin: 0, fontWeight: 900 }}>套用「工作日標準時段」會展開為這些時段</h2>
            <p className="cjk" style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "8px 0 0" }}>
              範圍：8/18 → 8/29（共 6 天）· 每天 4 堂 · 總計 24 堂
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Pill variant="outline" icon={<Calendar size={11} />}>展開到 8/29</Pill>
            <Btn variant="secondary" size="sm">展開更多</Btn>
          </div>
        </div>

        <Card padded={false}>
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(6, 1fr)",
            gap: 1, background: "var(--border)",
          }}>
            {PREVIEW_DAYS.map((d, i) => (
              <div key={i} style={{ background: "var(--card)", padding: "14px 16px" }}>
                <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".12em", color: "var(--muted-foreground)" }}>
                  {d.label.toUpperCase()}
                </div>
                <div className="display" style={{ fontSize: 22, marginTop: 4, fontWeight: 400 }}>{d.count} 堂</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
                  {d.slots.map((s, j) => (
                    <div key={j} className="mono" style={{
                      fontSize: 11, padding: "4px 8px", borderRadius: 6,
                      background: "color-mix(in oklab, oklch(0.50 0.12 240) 12%, var(--card))",
                      border: "1px solid color-mix(in oklab, oklch(0.50 0.12 240) 32%, var(--border))",
                      color: "var(--foreground)", letterSpacing: ".05em",
                    }}>{s}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)", background: "var(--muted)",
            display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
          }}>
            <div className="cjk" style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>
              <Alert size={12} style={{ verticalAlign: "middle", marginRight: 6, color: "var(--destructive)" }} />
              8/30 (六) 國慶連假與本模板不衝突（週六本不開課）
            </div>
            <PrimaryCta size="md"><Check size={13} sw={2.5}/> 確認並展開到行事曆</PrimaryCta>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

Object.assign(window, { AvailabilityPage });
