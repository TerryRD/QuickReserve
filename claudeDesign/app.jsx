// app.jsx — wires DesignCanvas with the 3 directions.

const DIR_A_FONTS = { display: "Newsreader", sans: "IBM Plex Sans", cjk: "Noto Serif TC", mono: "JetBrains Mono" };
const DIR_B_FONTS = { display: "IBM Plex Sans", sans: "IBM Plex Sans", cjk: "Noto Sans TC", mono: "IBM Plex Mono" };
const DIR_C_FONTS = { display: "Anton", sans: "Space Grotesk", cjk: "Noto Sans TC 900", mono: "Space Mono" };

const DIR_A_BODY =
  "適合內容厚實、有故事性、會持續更新部落格或長文的教練。整體像一份慢讀的編輯特刊：襯線顯示字、舒適的行距、寬鬆的留白。" +
  "Avatar 與標題置中，把焦點放在「人」而非介面。深褐紅作為點綴，沉穩不喧嘩。Dark mode 將墨色降到暗灰、強調字仍保留可讀對比。";

const DIR_B_BODY =
  "適合追求效率、講求數據與時段的器材館 / 連鎖工作室。資訊集中靠左、卡片網格密度高、橫向 metric grid 強調可掃描性。" +
  "中性灰階為主、單一藍作為操作色；mono 字型強化「系統感」。Dark mode 走深藍灰、primary 提升亮度以維持對比。";

const DIR_C_BODY =
  "以「黑 / 白 / 黃」三色為骨架、另加透明度調出的中間灰階。Light theme 以白為主、Dark theme 翻轉為黑為主；黃只在必要的點綠出現——badge、価格下畫線、CTA 內的點、QR mark 裡的 wedge、服務卡右上圈。" +
  "條件式 Anton display 撐大招牌、CJK 用 Noto Sans TC 900 接氣。全部圓角：card 走 18px、button 走 999px pill、avatar 與 stamp 走圓形。QuickReserve 自家 QR mark 頻道顯著、light/dark 都能讀出來。";

// Hero+section heights — generous so content isn't clipped.
const H = { a: { d: 1700, t: 1900, m: 2100 }, b: { d: 1380, t: 1560, m: 1880 }, c: { d: 1400, t: 1620, m: 1900 } };

function DirectionMockup({ dirClass, mode = "light", size, Comp }) {
  const cls = `${dirClass}${mode === "dark" ? " dark" : ""}`;
  return (
    <div className={cls} style={{ width: "100%", height: "100%" }}>
      <Comp size={size} />
    </div>
  );
}

function App() {
  return (
    <DesignCanvas>
      {/* ============ INTRO ============ */}
      <DCSection id="intro" title="QuickReserve · Anchor" subtitle="3 directions × shadcn tokens × light + dark · 公開頁 /<slug> hero + 一個 section">
        <DCArtboard id="intro-card" label="Brief 摘要" width={460} height={560}>
          <div className="dir-a">
            <div className="meta-card" style={{ padding: 32, gap: 18 }}>
              <div className="mono muted" style={{ letterSpacing: ".2em", textTransform: "uppercase" }}>S6 · Anchor</div>
              <h3 className="display cjk" style={{ fontSize: 30, lineHeight: 1.15, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
                3 個視覺方向<br/>挑一組延伸到全站
              </h3>
              <p className="cjk" style={{ fontSize: 13.5, lineHeight: 1.7, margin: 0, color: "var(--muted-foreground)" }}>
                每組 direction 含完整 shadcn token 集合（light + dark）、Google Fonts 字型搭配、與公開頁 hero + 一個 section 的三斷點呈現。
                所有 token 名稱都遵循 shadcn 標準。
              </p>
              <ul className="cjk" style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8, color: "var(--foreground)" }}>
                <li><strong>A · 靜謐編輯系</strong>　— 襯線、置中、Bio 為主</li>
                <li><strong>B · 現代極簡</strong>　— 無襯線、密度高、Services 網格</li>
                <li><strong>C · 圓潤運動</strong>　— 黑白黃 + 透明度灰、圓角 pill、自家 QR mark</li>
              </ul>
              <div style={{ marginTop: "auto" }} className="mono muted">
                每個 direction 旁列：philosophy → palette (light + dark) → type → mockup (desktop / tablet / mobile / desktop-dark)
              </div>
            </div>
          </div>
        </DCArtboard>
      </DCSection>

      {/* ============ DIRECTION A ============ */}
      <DCSection id="dir-a" title="A · 靜謐編輯系 / Quiet Editorial" subtitle="Newsreader + Noto Serif TC · 暖墨紅 · 編輯氣質">
        <DCArtboard id="a-philo" label="Philosophy" width={420} height={520}>
          <PhilosophyCard
            dirClass="dir-a"
            label="靜謐編輯系"
            mood="Editorial · Warm · Calm"
            body={DIR_A_BODY}
            tags={["Serif display", "Centered", "Generous whitespace", "Warm bone + ink", "Terracotta accent"]}
          />
        </DCArtboard>
        <DCArtboard id="a-pal-l" label="Palette · Light" width={420} height={560}>
          <PaletteCard dirClass="dir-a" label="Palette" mode="light" />
        </DCArtboard>
        <DCArtboard id="a-pal-d" label="Palette · Dark" width={420} height={560}>
          <PaletteCard dirClass="dir-a" label="Palette" mode="dark" />
        </DCArtboard>
        <DCArtboard id="a-type" label="Typography" width={460} height={560}>
          <TypeCard dirClass="dir-a" fonts={DIR_A_FONTS} />
        </DCArtboard>
        <DCArtboard id="a-desk" label="Desktop · 1280" width={1280} height={H.a.d}>
          <DirectionMockup dirClass="dir-a" size="desktop" Comp={MockA} />
        </DCArtboard>
        <DCArtboard id="a-tab" label="Tablet · 768" width={768} height={H.a.t}>
          <DirectionMockup dirClass="dir-a" size="tablet" Comp={MockA} />
        </DCArtboard>
        <DCArtboard id="a-mob" label="Mobile · 375" width={375} height={H.a.m}>
          <DirectionMockup dirClass="dir-a" size="mobile" Comp={MockA} />
        </DCArtboard>
        <DCArtboard id="a-desk-d" label="Desktop · Dark" width={1280} height={H.a.d}>
          <DirectionMockup dirClass="dir-a" mode="dark" size="desktop" Comp={MockA} />
        </DCArtboard>
      </DCSection>

      {/* ============ DIRECTION B ============ */}
      <DCSection id="dir-b" title="B · 現代極簡 / Modern Minimal" subtitle="IBM Plex Sans + Noto Sans TC · 冷中性灰 · 系統感">
        <DCArtboard id="b-philo" label="Philosophy" width={420} height={520}>
          <PhilosophyCard
            dirClass="dir-b"
            label="現代極簡"
            mood="System · Cool · Efficient"
            body={DIR_B_BODY}
            tags={["Sans-only", "Left-aligned", "Data-dense", "Cobalt accent", "Mono labels"]}
          />
        </DCArtboard>
        <DCArtboard id="b-pal-l" label="Palette · Light" width={420} height={560}>
          <PaletteCard dirClass="dir-b" label="Palette" mode="light" />
        </DCArtboard>
        <DCArtboard id="b-pal-d" label="Palette · Dark" width={420} height={560}>
          <PaletteCard dirClass="dir-b" label="Palette" mode="dark" />
        </DCArtboard>
        <DCArtboard id="b-type" label="Typography" width={460} height={560}>
          <TypeCard dirClass="dir-b" fonts={DIR_B_FONTS} />
        </DCArtboard>
        <DCArtboard id="b-desk" label="Desktop · 1280" width={1280} height={H.b.d}>
          <DirectionMockup dirClass="dir-b" size="desktop" Comp={MockB} />
        </DCArtboard>
        <DCArtboard id="b-tab" label="Tablet · 768" width={768} height={H.b.t}>
          <DirectionMockup dirClass="dir-b" size="tablet" Comp={MockB} />
        </DCArtboard>
        <DCArtboard id="b-mob" label="Mobile · 375" width={375} height={H.b.m}>
          <DirectionMockup dirClass="dir-b" size="mobile" Comp={MockB} />
        </DCArtboard>
        <DCArtboard id="b-desk-d" label="Desktop · Dark" width={1280} height={H.b.d}>
          <DirectionMockup dirClass="dir-b" mode="dark" size="desktop" Comp={MockB} />
        </DCArtboard>
      </DCSection>

      {/* ============ DIRECTION C ============ */}
      <DCSection id="dir-c" title="C · 圓潤運動 / Bold Round" subtitle="Anton + Noto Sans TC 900 · 黑白黃 + 透明度灰階 · 圓角包复拉柔 · 自家 QR mark">
        <DCArtboard id="c-philo" label="Philosophy" width={420} height={520}>
          <PhilosophyCard
            dirClass="dir-c"
            label="圓潤運動"
            mood="Bold · Soft · Friendly"
            body={DIR_C_BODY}
            tags={["Black + white + yellow", "Light-dominant / dark inverts", "Yellow as punctuation", "Rounded pills & cards", "Custom QR mark"]}
          />
        </DCArtboard>
        <DCArtboard id="c-pal-l" label="Palette · Light" width={420} height={560}>
          <PaletteCard dirClass="dir-c" label="Palette" mode="light" />
        </DCArtboard>
        <DCArtboard id="c-pal-d" label="Palette · Dark" width={420} height={560}>
          <PaletteCard dirClass="dir-c" label="Palette" mode="dark" />
        </DCArtboard>
        <DCArtboard id="c-type" label="Typography" width={460} height={560}>
          <TypeCard dirClass="dir-c" fonts={DIR_C_FONTS} />
        </DCArtboard>
        <DCArtboard id="c-desk" label="Desktop · 1280" width={1280} height={H.c.d}>
          <DirectionMockup dirClass="dir-c" size="desktop" Comp={MockC} />
        </DCArtboard>
        <DCArtboard id="c-tab" label="Tablet · 768" width={768} height={H.c.t}>
          <DirectionMockup dirClass="dir-c" size="tablet" Comp={MockC} />
        </DCArtboard>
        <DCArtboard id="c-mob" label="Mobile · 375" width={375} height={H.c.m}>
          <DirectionMockup dirClass="dir-c" size="mobile" Comp={MockC} />
        </DCArtboard>
        <DCArtboard id="c-desk-d" label="Desktop · Dark" width={1280} height={H.c.d}>
          <DirectionMockup dirClass="dir-c" mode="dark" size="desktop" Comp={MockC} />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
