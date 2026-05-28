// meta.jsx — palette swatches + type sample + philosophy cards.

const TOKEN_GROUPS = [
  { title: "Surface", keys: ["background", "foreground", "card", "popover", "muted", "muted-foreground"] },
  { title: "Brand",   keys: ["primary", "primary-foreground", "secondary", "accent", "destructive"] },
  { title: "Lines",   keys: ["border", "input", "ring"] },
];

function readVar(node, name) {
  if (!node) return "";
  const v = getComputedStyle(node).getPropertyValue("--" + name).trim();
  return v;
}

function PaletteCard({ dirClass, label, mode = "light" }) {
  const ref = React.useRef(null);
  const [vals, setVals] = React.useState({});
  React.useEffect(() => {
    if (!ref.current) return;
    const out = {};
    TOKEN_GROUPS.forEach((g) => g.keys.forEach((k) => { out[k] = readVar(ref.current, k); }));
    setVals(out);
  }, [dirClass, mode]);
  const cls = `${dirClass}${mode === "dark" ? " dark" : ""}`;
  return (
    <div ref={ref} className={cls}>
      <div className="meta-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3>{label}</h3>
          <span className="mono muted" style={{ textTransform: "uppercase", letterSpacing: ".15em" }}>{mode}</span>
        </div>
        {TOKEN_GROUPS.map((g) => (
          <div key={g.title} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="mono muted" style={{ letterSpacing: ".1em", textTransform: "uppercase" }}>{g.title}</div>
            <div className="swatches">
              {g.keys.map((k) => (
                <div className="swatch" key={k}>
                  <div className="chip" style={{ background: `var(--${k})` }} />
                  <div style={{ minWidth: 0, overflow: "hidden" }}>
                    <div className="name">--{k}</div>
                    <div className="val" style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {vals[k] || "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "var(--font-mono)" }} className="muted">
          <span>--radius {readVar(ref.current, "radius")}</span>
          <span>AA contrast ✓</span>
        </div>
      </div>
    </div>
  );
}

function TypeCard({ dirClass, fonts, mode = "light" }) {
  const cls = `${dirClass}${mode === "dark" ? " dark" : ""}`;
  return (
    <div className={cls}>
      <div className="meta-card">
        <h3>Typography</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* display */}
          <div>
            <div className="mono muted" style={{ marginBottom: 6, letterSpacing: ".1em", textTransform: "uppercase" }}>
              DISPLAY · {fonts.display}
            </div>
            <div className="display cjk" style={{ fontSize: 38, lineHeight: 1.05, fontWeight: 600, letterSpacing: "-0.015em" }}>
              預約教練 Aa
            </div>
            <div className="display" style={{ fontSize: 18, fontStyle: "italic", marginTop: 4, opacity: 0.7 }}>
              The quick reserve.
            </div>
          </div>

          {/* sans */}
          <div style={{ paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <div className="mono muted" style={{ marginBottom: 6, letterSpacing: ".1em", textTransform: "uppercase" }}>
              BODY · {fonts.sans}
            </div>
            <p className="cjk" style={{ fontSize: 14.5, lineHeight: 1.65, margin: 0 }}>
              我相信運動的核心不在於追求短期成果，而是讓你長期、規律地把訓練放進日常裡。
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.6, margin: "6px 0 0", color: "var(--muted-foreground)" }}>
              I believe consistency beats intensity. Train weekly, train forever.
            </p>
          </div>

          {/* cjk */}
          <div style={{ paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <div className="mono muted" style={{ marginBottom: 6, letterSpacing: ".1em", textTransform: "uppercase" }}>
              CJK · {fonts.cjk}
            </div>
            <div className="cjk" style={{ fontSize: 22, lineHeight: 1.4 }}>
              字型搭配自然・中英混排不跳體
            </div>
            <div className="mono" style={{ fontSize: 12, marginTop: 10, color: "var(--muted-foreground)" }}>
              {fonts.mono} · 1234567890
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhilosophyCard({ dirClass, label, mood, body, tags }) {
  return (
    <div className={dirClass}>
      <div className="meta-card" style={{ padding: 32 }}>
        <div className="mono muted" style={{ letterSpacing: ".2em", textTransform: "uppercase" }}>
          Direction
        </div>
        <h3 className="display cjk" style={{ fontSize: 32, lineHeight: 1.15, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>
          {label}
        </h3>
        <div className="cjk" style={{ fontSize: 13, color: "var(--primary)", fontWeight: 500, marginTop: -8 }}>
          {mood}
        </div>
        <p className="cjk" style={{ fontSize: 14, lineHeight: 1.75, margin: 0, color: "var(--foreground)" }}>
          {body}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: "auto" }}>
          {tags.map((t) => (
            <span key={t} className="mono" style={{
              fontSize: 10.5, padding: "4px 10px",
              border: "1px solid var(--border)",
              borderRadius: 999, color: "var(--muted-foreground)",
              letterSpacing: ".06em",
            }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PaletteCard, TypeCard, PhilosophyCard });
