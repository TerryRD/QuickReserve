// coach/page-calendar.jsx — /calendar (week / list / month views + slot popover)

// ─── mock slot grid (Mon 8/18 → Sun 8/24) ─────────────────────
// Each slot belongs to ONE coach. Multiple coaches CAN occupy the
// same (day, hour) — the week grid splits the cell into lanes.
const WEEK_DAYS = [
  { d: 18, w: "一", date: "8/18 一" },
  { d: 19, w: "二", date: "8/19 二", isToday: true },
  { d: 20, w: "三", date: "8/20 三" },
  { d: 21, w: "四", date: "8/21 四" },
  { d: 22, w: "五", date: "8/22 五" },
  { d: 23, w: "六", date: "8/23 六" },
  { d: 24, w: "日", date: "8/24 日" },
];
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
// dayIdx × hour × coach → slot. `duration` defaults to 60 min; bigger values
// make the chip visually taller (Google Calendar style).
const WEEK_SLOTS = [
  // Mon 8/18
  { day: 0, hour: 10, coach: "chen",  student: "張采妮", service: "肌力" },
  { day: 0, hour: 14, coach: "chen",  student: "陳威翰", service: "肌力" },
  { day: 0, hour: 16, coach: "chen",  student: "李雅文", service: "肌力" },
  // Tue 8/19 — today; 10:00 has BOTH coaches teaching in parallel
  { day: 1, hour: 9,  coach: "chen",  student: "張采妮", service: "肌力" },
  { day: 1, hour: 10, coach: "chen",  student: "林書豪", service: "體態", duration: 90 },
  { day: 1, hour: 10, coach: "huang", student: "周宇翔", service: "肌力" },
  { day: 1, hour: 14, coach: "chen",  group: { f: 2, c: 4 }, student: "雙人 / 王怡靜 + 陳威翰", service: "雙人" },
  { day: 1, hour: 16, coach: "chen",  student: "李雅文", service: "肌力", selected: true },
  { day: 1, hour: 19, coach: "huang", student: "吳哲銘", service: "肌力" },
  // Wed 8/20
  { day: 2, hour: 10, coach: "chen",  student: "張采妮", service: "肌力" },
  { day: 2, hour: 14, coach: "chen",  student: "王怡靜", service: "肌力" },
  // Thu 8/21 — 11:00 chen has a personal-event clash; 17:00 has both coaches
  { day: 3, hour: 9,  coach: "chen",  student: "周宇翔", service: "肌力" },
  { day: 3, hour: 11, coach: "chen",  student: "蔡淑芬", service: "體態", duration: 90, conflict: "個人事務" },
  { day: 3, hour: 17, coach: "chen",  student: "王怡靜", service: "肌力" },
  { day: 3, hour: 17, coach: "huang", student: "吳哲銘", service: "肌力" },
  // Fri 8/22
  { day: 4, hour: 10, coach: "chen",  student: "林書豪", service: "肌力" },
  { day: 4, hour: 15, coach: "chen",  student: "張采妮", service: "肌力" },
  { day: 4, hour: 17, coach: "chen",  student: "李雅文", service: "肌力" },
  // Sun 8/24 — 10:00 two parallel team班; 11:00 full
  { day: 6, hour: 10, coach: "chen",  group: { f: 3, c: 4 }, student: "晨間團班", service: "團班", duration: 75 },
  { day: 6, hour: 10, coach: "huang", group: { f: 1, c: 3 }, student: "新手團班", service: "團班", duration: 75 },
  { day: 6, hour: 11, coach: "chen",  group: { f: 4, c: 4 }, student: "進階團班", service: "團班", full: true },
];

const COACH_FILTERS = [
  { id: "chen",  name: COACH.name, initial: "陳", on: true },
  { id: "huang", name: ASSISTANT.name, initial: "黃", on: true },
];

// ─── Calendar header (date range + nav + view toggle + filters) ──
function CalendarHeader({ view, size }) {
  const isMobile = size === "mobile";
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 8 }}>
            WEEK · 2026.08.18 — 08.24
          </div>
          <h1 className="display" style={{
            fontSize: isMobile ? 36 : 56, lineHeight: 0.95, margin: 0, fontWeight: 400,
            textTransform: "uppercase", letterSpacing: "-0.01em",
            display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap",
          }}>
            <span className="cjk">行事曆</span>
            <span style={{ position: "relative", display: "inline-block" }}>
              CALENDAR
              <span aria-hidden style={{
                position: "absolute", left: 0, right: 0, bottom: -2,
                height: 5, background: "var(--accent)", borderRadius: 6,
              }} />
            </span>
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4, padding: 3, background: "var(--secondary)", borderRadius: 999 }}>
            <Btn variant="ghost" size="sm" style={{ width: 32, padding: 0 }}><ArrowL size={12}/></Btn>
            <Btn variant="ghost" size="sm">今天</Btn>
            <Btn variant="ghost" size="sm" style={{ width: 32, padding: 0 }}><Arrow size={12}/></Btn>
          </div>
          {/* view toggle */}
          <div style={{ display: "flex", padding: 3, background: "var(--secondary)", borderRadius: 999, gap: 2 }}>
            {[
              { id: "week",  label: "週" },
              { id: "list",  label: "列表" },
              { id: "month", label: "月" },
            ].map((v) => {
              const on = v.id === view;
              return (
                <button key={v.id} style={{
                  ...BTN_BASE,
                  height: 32, padding: "0 14px", borderRadius: 999, fontSize: 12.5,
                  background: on ? "var(--background)" : "transparent",
                  color: on ? "var(--foreground)" : "var(--muted-foreground)",
                  fontWeight: on ? 600 : 500,
                  boxShadow: on ? "0 1px 2px rgba(0,0,0,.08)" : "none",
                }}>{v.label}</button>
              );
            })}
          </div>
          {!isMobile && (
            <PrimaryCta size="md"><Plus size={13}/> 新增時段</PrimaryCta>
          )}
        </div>
      </div>

      {/* filter chips row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 18 }}>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".15em" }}>FILTER · 顯示</span>
        {COACH_FILTERS.map((c) => {
          const cc = COACH_COLORS[c.id] || COACH_COLORS.chen;
          return (
            <button key={c.id} style={{
              ...BTN_BASE,
              height: 30, padding: "0 12px 0 4px", borderRadius: 999,
              background: c.on ? "var(--foreground)" : "var(--card)",
              color: c.on ? "var(--background)" : "var(--foreground)",
              border: c.on ? "1.5px solid var(--foreground)" : "1px solid var(--border)",
              fontSize: 11.5, fontWeight: 500, gap: 6,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: "50%",
                background: cc.badgeBg, color: cc.badgeFg,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
              }}>{c.initial}</span>
              {c.name}
            </button>
          );
        })}
        <Pill icon={<Box size={11} />}>所有服務</Pill>
        <span aria-hidden style={{ flex: 1 }} />
        {!isMobile && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".1em" }}>
              本週共 {WEEK_SLOTS.length} 堂
            </span>
            <span style={{ width: 1, height: 12, background: "var(--border)" }} />
            <button style={{
              ...BTN_BASE,
              height: 26, padding: "0 10px", borderRadius: 999, gap: 6,
              background: "color-mix(in oklab, var(--destructive) 14%, var(--card))",
              color: "var(--destructive)",
              border: "1px solid color-mix(in oklab, var(--destructive) 28%, var(--border))",
              fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em",
            }} title="點擊跳到衝突的時段">
              <Alert size={11} sw={2.5} />
              {WEEK_SLOTS.filter(s => s.conflict).length} 衝突
            </button>
            <span style={{ width: 1, height: 12, background: "var(--border)" }} />
            <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".1em" }}>
              {WEEK_SLOTS.filter(s => s.full).length} 滿團
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Each coach gets a low-saturation hue. Body tint is very subtle (kept
// near-neutral); the left stripe + coach-initial badge are saturated so
// you can scan the calendar at a glance.
const COACH_COLORS = {
  chen: {
    base: "oklch(0.50 0.12 240)",        // cool blue (Owner)
    bodyTint: "color-mix(in oklab, oklch(0.50 0.12 240) 10%, var(--card))",
    bodyTintHeavy: "color-mix(in oklab, oklch(0.50 0.12 240) 32%, var(--card))",
    border: "color-mix(in oklab, oklch(0.50 0.12 240) 32%, var(--border))",
    badgeBg: "oklch(0.50 0.12 240)",
    badgeFg: "#FFFFFF",
  },
  huang: {
    base: "oklch(0.58 0.13 25)",         // warm orange/clay (Staff)
    bodyTint: "color-mix(in oklab, oklch(0.58 0.13 25) 10%, var(--card))",
    bodyTintHeavy: "color-mix(in oklab, oklch(0.58 0.13 25) 32%, var(--card))",
    border: "color-mix(in oklab, oklch(0.58 0.13 25) 32%, var(--border))",
    badgeBg: "oklch(0.58 0.13 25)",
    badgeFg: "#FFFFFF",
  },
};

// ─── Slot card (small, used in week grid) ─────────────────────
// Body color ALWAYS reflects the coach so a glance at the grid tells you
// who's teaching.  Status (selected / full / conflict) is conveyed by
// border treatment + inline label, not by repainting the chip.
function SlotChip({ s, size, compact }) {
  const cc = COACH_COLORS[s.coach] || COACH_COLORS.chen;
  const coachChar = s.coach === "huang" ? "黃" : "陳";

  let bg = cc.bodyTint;
  let stripe = cc.base;
  let border = cc.border;
  let borderW = 1;
  let ring = "none";

  // Selected is the only state that visually re-skins the chip body.
  // Full / conflict are conveyed by the ratio number (4/4) and the
  // inline alert icon respectively, not by repainting the chip.
  if (s.selected) { bg = cc.bodyTintHeavy; border = cc.base; borderW = 2; ring = `0 0 0 1.5px ${cc.base}`; }

  return (
    <div style={{
      height: "100%",
      borderRadius: 8,
      background: bg,
      color: "var(--foreground)",
      padding: "4px 6px 4px 10px",
      position: "relative",
      overflow: "hidden",
      display: "flex", flexDirection: "column", justifyContent: "center", gap: 1,
      border: `${borderW}px solid ${border}`,
      boxShadow: ring,
      fontSize: compact ? 10.5 : 11.5,
    }}>
      <span aria-hidden style={{
        position: "absolute", left: 0, top: 4, bottom: 4, width: 4,
        background: stripe, borderRadius: 999,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
        <span className="mono" style={{ fontSize: 9.5, opacity: 0.75, fontVariantNumeric: "tabular-nums", letterSpacing: ".02em" }}>
          {String(s.hour).padStart(2, "0")}:00
        </span>
        {s.conflict && (
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 14, height: 14, borderRadius: 4,
            background: "color-mix(in oklab, var(--destructive) 20%, var(--card))",
            color: "var(--destructive)",
            flexShrink: 0,
          }} title={`衝突 · ${typeof s.conflict === "string" ? s.conflict : "不可用事件"}`}>
            <Alert size={9} sw={2.8} />
          </span>
        )}
        {s.selected && (
          <span className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".06em", color: cc.base }}>SELECTED</span>
        )}
        <span style={{
          marginLeft: "auto",
          flexShrink: 0,
          width: 16, height: 16, borderRadius: "50%",
          background: cc.badgeBg, color: cc.badgeFg,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 800,
          fontFamily: "var(--font-display), var(--font-cjk)",
        }}>{coachChar}</span>
      </div>
      <div className="cjk" style={{
        fontWeight: 600, lineHeight: 1.15,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{s.student}</div>
      {/* group capacity — full / not-full share the same pill style; the
          number itself (e.g. 4/4 vs 3/4) communicates full state */}
      {s.group && (
        <span className="mono" style={{
          alignSelf: "flex-start", marginTop: 1,
          fontSize: 9, fontWeight: 700, padding: "0 6px", borderRadius: 999,
          background: "color-mix(in oklab, " + cc.base + " 35%, var(--card))",
          color: "var(--foreground)",
          letterSpacing: ".08em",
        }}>{s.group.f}/{s.group.c}</span>
      )}
    </div>
  );
}

// ─── Slot popover (shown for selected slot) ───────────────────
function SlotPopover() {
  return (
    <div style={{
      position: "absolute", zIndex: 5,
      top: 360, left: "50%", transform: "translateX(-30%)",
      width: 340,
      background: "var(--card)",
      borderRadius: 16,
      border: "1px solid var(--border)",
      boxShadow: "0 20px 60px -20px rgba(0,0,0,.35), 0 0 0 1px var(--border)",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "18px 20px",
        background: "var(--primary)", color: "var(--primary-foreground)",
        position: "relative",
      }}>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".15em", opacity: 0.7 }}>
          SLOT · 8/19 (二)
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
          <span className="display" style={{ fontSize: 36, lineHeight: 1, fontWeight: 400 }}>16:00</span>
          <span className="cjk" style={{ fontSize: 12, opacity: 0.7 }}>· 60 分鐘 · 一對一肌力</span>
        </div>
      </div>
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: ".15em", color: "var(--muted-foreground)" }}>
          ATTENDEES · 1 PERSON
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar size={36} initial="李" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cjk" style={{ fontSize: 13.5, fontWeight: 600 }}>李雅文</div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>10 堂套裝・剩 5 堂</div>
          </div>
          <StatusBadge status="confirmed" />
        </div>
        <div style={{
          padding: "10px 12px", borderRadius: 10, background: "var(--muted)",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
        }}>
          <div className="cjk" style={{ fontSize: 12 }}>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginRight: 6 }}>COACH</span>
            {COACH.name}
          </div>
          <div className="cjk" style={{ fontSize: 12 }}>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginRight: 6 }}>LOCATION</span>
            內湖工作室
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          <Btn variant="primary" size="sm"><Calendar size={12}/> 改期</Btn>
          <Btn variant="secondary" size="sm">看完整詳情</Btn>
          <Btn variant="ghost" size="sm" style={{ color: "var(--destructive)", marginLeft: "auto" }}><X size={12}/> 取消</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Week view grid ───────────────────────────────────────────
// Day columns are absolute-positioned containers. Each event chip sits
// at (top = (hour - firstHour) * cellH, height = duration / 60 * cellH).
// When events share time inside a column, lanes overlap with a horizontal
// stagger (Google Calendar style) so each chip keeps most of its width.
function WeekView({ size, popoverOpen }) {
  const isMobile = size === "mobile";
  const cellH = isMobile ? 56 : 64;
  const timeColW = isMobile ? 52 : 64;
  const firstHour = HOURS[0];

  // Detect overlapping slots in a single day and assign lane indexes.
  // Simple model: same `hour` → overlap.  (Real impl would use start+end.)
  function assignLanes(daySlots) {
    const byHour = {};
    daySlots.forEach((s) => {
      const k = s.hour;
      if (!byHour[k]) byHour[k] = [];
      byHour[k].push(s);
    });
    const out = daySlots.map((s) => {
      const peers = byHour[s.hour];
      const idx = peers.indexOf(s);
      return { s, laneIdx: idx, laneCount: peers.length };
    });
    return out;
  }

  // Lane geometry → equal-width split.  Same-time events sit side-by-side
  // inside the time box (no overlap stagger).  Different durations still
  // produce different chip heights via top/height absolute positioning.
  function laneGeom(laneIdx, laneCount) {
    if (laneCount <= 1) return { widthPct: 100, leftPct: 0 };
    const widthPct = 100 / laneCount;
    return { widthPct, leftPct: laneIdx * widthPct };
  }

  return (
    <div style={{ position: "relative" }}>
      <Card padded={false} style={{ overflow: "hidden" }}>
        {/* day header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `${timeColW}px repeat(7, 1fr)`,
          borderBottom: "1px solid var(--border)",
          background: "var(--muted)",
        }}>
          <div></div>
          {WEEK_DAYS.map((d, i) => (
            <div key={i} style={{
              padding: "10px 8px",
              borderLeft: "1px solid var(--border)",
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
            }}>
              <span className="mono" style={{
                fontSize: 10, letterSpacing: ".12em",
                color: i === 5 || i === 6 ? "var(--muted-foreground)" : "var(--foreground)",
              }}>週{d.w}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {d.isToday ? (
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 26, height: 26, borderRadius: "50%",
                    background: "var(--accent)", color: "var(--accent-foreground)",
                  }}>
                    <span className="display" style={{ fontSize: 14, fontWeight: 700 }}>{d.d}</span>
                  </span>
                ) : (
                  <span className="display" style={{ fontSize: 18, fontWeight: 400 }}>{d.d}</span>
                )}
              </span>
            </div>
          ))}
        </div>

        {/* body — single grid; columns positioned relative so events can be absolutely placed */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `${timeColW}px repeat(7, 1fr)`,
          height: HOURS.length * cellH,
        }}>
          {/* time labels column */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {HOURS.map((h) => (
              <div key={h} style={{
                height: cellH,
                padding: "6px 8px",
                fontFamily: "var(--font-mono)", fontSize: 10.5,
                color: "var(--muted-foreground)", letterSpacing: ".05em",
                fontVariantNumeric: "tabular-nums",
              }}>{String(h).padStart(2, "0")}:00</div>
            ))}
          </div>
          {/* day columns */}
          {WEEK_DAYS.map((d, di) => {
            const isOff = di === 5;
            const daySlots = WEEK_SLOTS.filter((s) => s.day === di);
            const lanes = assignLanes(daySlots);
            return (
              <div key={di} style={{
                position: "relative",
                borderLeft: "1px solid var(--border)",
                background: isOff ? "var(--muted)" : "transparent",
              }}>
                {/* hour grid lines (background, non-interactive) */}
                {HOURS.map((h, hi) => {
                  const isLunch = h === 12;
                  return (
                    <div key={h} style={{
                      height: cellH,
                      borderBottom: hi < HOURS.length - 1 ? "1px solid var(--border)" : "none",
                      background: isLunch ? "var(--muted)" : "transparent",
                    }} />
                  );
                })}
                {/* events overlaid */}
                {lanes.map(({ s, laneIdx, laneCount }, j) => {
                  const dur = s.duration || 60;
                  const top = (s.hour - firstHour) * cellH + 3;
                  const height = (dur / 60) * cellH - 6;
                  const { widthPct, leftPct } = laneGeom(laneIdx, laneCount);
                  return (
                    <div key={j} style={{
                      position: "absolute",
                      top, height,
                      left: `calc(${leftPct}% + 3px)`,
                      width: `calc(${widthPct}% - 6px)`,
                    }}>
                      <SlotChip s={s} size={size} compact />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Card>

      {popoverOpen && <SlotPopover />}
    </div>
  );
}

// ─── List view ────────────────────────────────────────────────
function ListView({ size }) {
  const isMobile = size === "mobile";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {WEEK_DAYS.map((d, di) => {
        const slots = WEEK_SLOTS.filter((s) => s.day === di);
        if (!slots.length) {
          // off-day stub
          return (
            <div key={di} style={{ opacity: 0.55 }}>
              <DayHeader d={d} count={0} />
              <div style={{
                padding: 18, border: "1.5px dashed var(--border)", borderRadius: 12,
                color: "var(--muted-foreground)", textAlign: "center",
              }}>
                <span className="cjk" style={{ fontSize: 13 }}>休息日 · 沒有開設時段</span>
              </div>
            </div>
          );
        }
        return (
          <div key={di}>
            <DayHeader d={d} count={slots.length} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {slots.map((s, i) => <ListRow key={i} s={s} size={size} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
function DayHeader({ d, count }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 12 }}>
      {d.isToday ? (
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 32, height: 32, borderRadius: "50%",
          background: "var(--accent)", color: "var(--accent-foreground)",
        }}>
          <span className="display" style={{ fontSize: 16, fontWeight: 700 }}>{d.d}</span>
        </span>
      ) : (
        <span className="display" style={{ fontSize: 22, fontWeight: 400 }}>{d.d}</span>
      )}
      <span className="cjk display" style={{ fontSize: 16, fontWeight: 900 }}>週{d.w}</span>
      <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".1em" }}>
        {count > 0 ? `${count} 個時段` : "OFF"}
      </span>
      <span aria-hidden style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}
function ListRow({ s, size }) {
  const isMobile = size === "mobile";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: isMobile ? "12px 14px" : "14px 18px",
      borderRadius: 12, border: "1px solid var(--border)",
      background: s.selected ? "var(--secondary)" : "var(--card)",
      ...(s.conflict ? { borderColor: "var(--destructive)" } : {}),
    }}>
      <div className="display" style={{
        fontSize: 22, lineHeight: 1, width: 64, fontWeight: 400,
        fontVariantNumeric: "tabular-nums", letterSpacing: ".02em",
      }}>
        {String(s.hour).padStart(2, "0")}:00
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="cjk" style={{ fontSize: 14, fontWeight: 600 }}>{s.student}</div>
        <div className="cjk" style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
          {s.service} · {s.coach === "chen" ? COACH.name : ASSISTANT.name}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {s.group && (
          <span className="mono" style={{
            padding: "3px 8px", borderRadius: 999,
            background: s.full
              ? "color-mix(in oklab, var(--accent) 45%, var(--card))"
              : "color-mix(in oklab, var(--accent) 22%, var(--card))",
            color: "var(--foreground)",
            border: `1px solid color-mix(in oklab, var(--accent) ${s.full ? 60 : 38}%, var(--border))`,
            fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
          }}>{s.group.f}/{s.group.c}{s.full ? " FULL" : ""}</span>
        )}
        {s.conflict && (
          <span className="mono" style={{
            padding: "3px 8px", borderRadius: 999,
            background: "color-mix(in oklab, var(--destructive) 14%, var(--card))",
            color: "var(--destructive)",
            border: "1px solid color-mix(in oklab, var(--destructive) 38%, var(--border))",
            fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
            display: "inline-flex", gap: 4, alignItems: "center",
          }}><Alert size={10} sw={2.5} />衝突 · {typeof s.conflict === "string" ? s.conflict : "個人事務"}</span>
        )}
        <StatusBadge status="confirmed" />
        {!isMobile && <MoreV size={14} />}
      </div>
    </div>
  );
}

// ─── Month view (coach perspective) ───────────────────────────
const COACH_MONTH = [
  // row 1: 7/27 (Sun) → 8/2 (Sat) — wait Aug 1 = Sat, so Sunday-start grid: 7/27 = Sun
  { d: 27, slots: 0, isOther: true }, { d: 28, slots: 0, isOther: true },
  { d: 29, slots: 0, isOther: true }, { d: 30, slots: 0, isOther: true },
  { d: 31, slots: 0, isOther: true }, { d: 1,  slots: 0 }, { d: 2, slots: 0 },
  // row 2
  { d: 3,  slots: 5 }, { d: 4, slots: 6 }, { d: 5, slots: 5 },
  { d: 6,  slots: 6 }, { d: 7, slots: 4 }, { d: 8, slots: 0 }, { d: 9, slots: 0 },
  // row 3
  { d: 10, slots: 5 }, { d: 11, slots: 5 }, { d: 12, slots: 6 },
  { d: 13, slots: 5 }, { d: 14, slots: 4 }, { d: 15, slots: 0 }, { d: 16, slots: 0 },
  // row 4 — selected week
  { d: 17, slots: 5 }, { d: 18, slots: 5, hasConflict: false }, { d: 19, slots: 5, isToday: true, isSelected: true },
  { d: 20, slots: 3 }, { d: 21, slots: 6, hasConflict: true }, { d: 22, slots: 4 }, { d: 23, slots: 0 },
  // row 5
  { d: 24, slots: 4 }, { d: 25, slots: 5 }, { d: 26, slots: 6 },
  { d: 27, slots: 5 }, { d: 28, slots: 4 }, { d: 29, slots: 0 }, { d: 30, slots: 0 },
  // row 6
  { d: 31, slots: 5 }, { d: 1, slots: 0, isOther: true }, { d: 2, slots: 0, isOther: true },
  { d: 3, slots: 0, isOther: true }, { d: 4, slots: 0, isOther: true }, { d: 5, slots: 0, isOther: true }, { d: 6, slots: 0, isOther: true },
];

function MonthView({ size }) {
  const isMobile = size === "mobile";
  const cellH = isMobile ? 76 : 108;
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return (
    <Card padded={false} style={{ overflow: "hidden" }}>
      {/* header */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        background: "var(--muted)",
        borderBottom: "1px solid var(--border)",
      }}>
        {weekdays.map((w, i) => (
          <div key={w} className="mono" style={{
            padding: "10px 12px",
            fontSize: 10.5, letterSpacing: ".15em",
            color: i === 0 || i === 6 ? "var(--muted-foreground)" : "var(--foreground)",
            borderRight: i < 6 ? "1px solid var(--border)" : "none",
            fontWeight: 600,
          }}>{w}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {COACH_MONTH.map((c, i) => {
          const dow = i % 7;
          const row = Math.floor(i / 7);
          const isLastRow = row === 5;
          return (
            <div key={i} style={{
              position: "relative",
              minHeight: cellH,
              borderRight: dow < 6 ? "1px solid var(--border)" : "none",
              borderBottom: isLastRow ? "none" : "1px solid var(--border)",
              padding: isMobile ? "6px 8px" : "10px 12px",
              background: c.isSelected ? "var(--foreground)" : c.isOther ? "var(--muted)" : "transparent",
              color: c.isSelected ? "var(--background)" : c.isOther ? "var(--muted-foreground)" : "var(--foreground)",
              opacity: c.isOther ? 0.45 : 1,
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              {/* date row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                {c.isToday ? (
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 26, height: 26, borderRadius: "50%",
                    background: "var(--accent)", color: "var(--accent-foreground)",
                  }}>
                    <span className="display" style={{ fontSize: 14, fontWeight: 700 }}>{c.d}</span>
                  </span>
                ) : (
                  <span className="display" style={{ fontSize: isMobile ? 14 : 16, fontWeight: 400 }}>{c.d}</span>
                )}
                {c.hasConflict && (
                  <Alert size={11} sw={2.5} style={{ color: c.isSelected ? "var(--background)" : "var(--destructive)" }} />
                )}
              </div>
              {/* slot indicators — small bars */}
              {!c.isOther && c.slots > 0 && !isMobile && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {Array.from({ length: Math.min(c.slots, 3) }).map((_, j) => (
                    <div key={j} style={{
                      height: 4, borderRadius: 2,
                      background: c.isSelected ? "var(--accent)" : (j === 0 ? "var(--foreground)" : "var(--muted-foreground)"),
                      opacity: c.isSelected ? 1 : (j === 0 ? 0.9 : 0.4),
                    }} />
                  ))}
                  {c.slots > 3 && (
                    <span className="mono" style={{ fontSize: 9, color: c.isSelected ? "var(--background)" : "var(--muted-foreground)", letterSpacing: ".05em" }}>
                      +{c.slots - 3}
                    </span>
                  )}
                </div>
              )}
              {/* count label */}
              {!c.isOther && (
                <span className="mono" style={{
                  marginTop: "auto", fontSize: isMobile ? 9 : 10, letterSpacing: ".05em",
                  color: c.isSelected ? "var(--background)" : "var(--muted-foreground)",
                  opacity: c.isSelected ? 0.85 : 1,
                }}>
                  {c.slots > 0 ? `${c.slots} 堂` : "—"}
                </span>
              )}
              {c.isSelected && (
                <span aria-hidden style={{
                  position: "absolute", left: 0, right: 0, bottom: 0,
                  height: 3, background: "var(--accent)",
                }} />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── CalendarPage ──────────────────────────────────────────────
function CalendarPage({ size = "desktop", view = "week", popoverOpen = false }) {
  return (
    <AppShell active="calendar" size={size} title="行事曆" fullBleed>
      <div style={{ padding: size === "mobile" ? "20px" : "32px 40px", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <CalendarHeader view={view} size={size} />
        {view === "week"  && <WeekView size={size} popoverOpen={popoverOpen} />}
        {view === "list"  && <ListView size={size} />}
        {view === "month" && <MonthView size={size} />}
      </div>
    </AppShell>
  );
}

Object.assign(window, { CalendarPage, WeekView, ListView, MonthView, SlotPopover });
