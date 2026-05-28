// coach/page-settings-profile.jsx — /settings/profile

const SETTINGS_TABS = [
  { id: "profile",       label: "公開頁資料", eng: "PROFILE",      path: "/settings/profile" },
  { id: "notifications", label: "通知偏好",   eng: "NOTIFICATIONS", path: "/settings/notifications" },
  { id: "availability",  label: "作息模板",   eng: "AVAILABILITY", path: "/calendar/availability" },
  { id: "rules",         label: "重複規則",   eng: "RULES",        path: "/calendar/rules" },
];

function SettingsTabs({ active, size = "desktop" }) {
  return (
    <div style={{
      display: "flex", gap: 2, marginBottom: 28,
      borderBottom: "1px solid var(--border)",
      overflowX: "auto",
    }}>
      {SETTINGS_TABS.map((t) => {
        const on = t.id === active;
        return (
          <button key={t.id} style={{
            ...BTN_BASE,
            height: 40, padding: "0 18px", borderRadius: 0,
            background: "transparent",
            color: on ? "var(--foreground)" : "var(--muted-foreground)",
            fontWeight: on ? 600 : 500, fontSize: 13.5,
            position: "relative",
            flexShrink: 0,
          }}>
            <span className="cjk">{t.label}</span>
            <span className="mono" style={{ fontSize: 9.5, marginLeft: 6, opacity: 0.7, letterSpacing: ".1em" }}>{t.eng}</span>
            {on && (
              <span aria-hidden style={{
                position: "absolute", bottom: -1, left: 12, right: 12, height: 3,
                background: "var(--accent)", borderRadius: 999,
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Reusable section shell with visual rhythm options.
//   layout = "split": label column on left, form column on right (desktop only)
//   layout = "stacked": label on top, form below
//   accent: pin the big section number on left in accent color
function SettingsSection({ num, kicker, title, desc, layout = "split", action, children, last, size = "desktop" }) {
  const isMobile = size === "mobile";
  const useSplit = layout === "split" && !isMobile;
  return (
    <section style={{
      padding: "36px 0",
      borderBottom: last ? "none" : "1px solid var(--border)",
    }}>
      {useSplit ? (
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 48, alignItems: "start" }}>
          <SectionHead num={num} kicker={kicker} title={title} desc={desc} action={action} />
          <div style={{ minWidth: 0 }}>{children}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 20 }}>
          <SectionHead num={num} kicker={kicker} title={title} desc={desc} action={action} inline />
          <div>{children}</div>
        </div>
      )}
    </section>
  );
}
function SectionHead({ num, kicker, title, desc, action, inline }) {
  return (
    <div style={{
      display: inline ? "flex" : "block",
      alignItems: "flex-end", justifyContent: "space-between", gap: 16,
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
          <span className="display" style={{
            fontSize: 36, fontWeight: 400, color: "var(--accent-foreground)",
            background: "var(--accent)", padding: "0 10px", borderRadius: 8, lineHeight: 1,
          }}>{num}</span>
          <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".18em", color: "var(--muted-foreground)" }}>{kicker}</span>
        </div>
        <h2 className="cjk display" style={{ fontSize: 22, margin: 0, fontWeight: 900 }}>{title}</h2>
        {desc && <p className="cjk" style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "8px 0 0", lineHeight: 1.6, maxWidth: 320 }}>{desc}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Profile page ─────────────────────────────────────────────
function SettingsProfilePage({ size = "desktop" }) {
  const isMobile = size === "mobile";
  return (
    <AppShell active="settings" size={size} title="設定">
      <PageHeader
        kicker="SETTINGS · 公開頁資料"
        title="設定"
        eng="SETTINGS"
        hint="維護學員看到的公開頁內容。本頁變更會即時反映到 /<slug> 上、儲存後生效。"
        size={size}
      />
      <SettingsTabs active="profile" size={size} />

      <div style={{ maxWidth: 1080 }}>
        {/* SECTION 01 — Basic info */}
        <SettingsSection
          num="01"
          kicker="BASIC · 基本資料"
          title="租戶名稱與一句介紹"
          desc="這兩段文字會出現在 hero 的最上方、是學員第一眼看到的資訊。"
          size={size}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="教練名稱" hint="可包含中文與英文、最多 24 字">
              <TextInput value="陳柏宇" />
            </Field>
            <Field label="一句介紹（subtitle）" hint="現於 hero 中段、保持簡短有力。最多 60 字。">
              <TextInput value="專注一對一肌力訓練・幫助你建立可持續的運動習慣" />
            </Field>
            <Field label="連結代號（slug）" hint="公開頁網址 quickreserve.app/<slug>，建立後不建議變更。">
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", background: "var(--muted)", borderRadius: 12, padding: "0 14px", border: "1px solid var(--border)" }}>
                  <span className="mono" style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>quickreserve.app/</span>
                  <input defaultValue="coach-poyu" className="mono" style={{ border: 0, background: "transparent", flex: 1, padding: "14px 8px", fontSize: 14, outline: "none" }} />
                </div>
                <Btn variant="secondary" size="md"><Sparkle size={13}/> 自動產生</Btn>
              </div>
            </Field>
          </div>
        </SettingsSection>

        {/* SECTION 02 — Avatar uploader (full-bleed card) */}
        <SettingsSection
          num="02"
          kicker="AVATAR · 大頭照"
          title="Hero 大頭照"
          desc="顯示為圓形 80×80 / desktop · 學員第一眼看到的人像。JPEG / PNG / WebP、≤ 5 MB。"
          layout="stacked"
          size={size}
          action={!isMobile && (
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" size="sm" style={{ color: "var(--destructive)" }}><Trash size={13}/> 移除</Btn>
            </div>
          )}
        >
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18,
            padding: isMobile ? 20 : 28,
            display: "grid", gridTemplateColumns: isMobile ? "1fr" : "auto 1fr", gap: isMobile ? 20 : 32,
            alignItems: "center",
          }}>
            {/* preview */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <Avatar size={140} initial="陳" verified />
              <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".1em" }}>PREVIEW · 240×240px</div>
            </div>
            {/* dropzone */}
            <div style={{
              border: "1.5px dashed var(--border)", borderRadius: 14,
              padding: isMobile ? "24px 18px" : 32,
              background: "var(--muted)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center",
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "var(--accent)", color: "var(--accent-foreground)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><Plus size={22} /></div>
              <div className="cjk display" style={{ fontSize: 16, fontWeight: 900 }}>拖曳或點擊更換大頭照</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".05em" }}>
                JPG · PNG · WEBP　·　建議方型 240×240 以上　·　≤ 5 MB
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <Btn variant="primary" size="sm"><Plus size={13}/> 選擇檔案</Btn>
                <Btn variant="ghost" size="sm" style={{ color: "var(--muted-foreground)" }}>從相簿拖入</Btn>
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* SECTION 03 — Bio (TipTap editor) */}
        <SettingsSection
          num="03"
          kicker="BIO · 完整介紹"
          title="完整介紹 (Bio)"
          desc="出現在 hero 下方的 prose 區。可使用粗體、斜體、標題、清單、連結。"
          layout="stacked"
          size={size}
        >
          <div style={{
            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden",
          }}>
            {/* toolbar — 6 buttons per brief */}
            <div style={{
              display: "flex", gap: 2, padding: 8,
              background: "var(--muted)",
              borderBottom: "1px solid var(--border)",
              alignItems: "center",
            }}>
              {[
                { id: "h", label: "H", title: "標題", weight: 700 },
                { id: "b", label: "B", title: "粗體", weight: 800 },
                { id: "i", label: "I", title: "斜體", italic: true },
                { id: "ul", icon: <Hash size={14} sw={2}/>, title: "清單" },
                { id: "link", label: "↗", title: "加入連結" },
                { id: "unlink", label: "✕", title: "移除連結" },
              ].map((b, i) => (
                <button key={b.id} title={b.title} style={{
                  ...BTN_BASE,
                  width: 32, height: 32, borderRadius: 8,
                  background: i === 1 ? "var(--background)" : "transparent",
                  color: i === 1 ? "var(--foreground)" : "var(--muted-foreground)",
                  border: i === 1 ? "1px solid var(--border)" : "1px solid transparent",
                  fontSize: 13, fontWeight: b.weight, fontStyle: b.italic ? "italic" : "normal",
                  fontFamily: "var(--font-display), var(--font-sans)",
                }}>{b.icon || b.label}</button>
              ))}
              <div style={{ width: 1, height: 18, background: "var(--border)", margin: "0 6px" }} />
              <span className="mono" style={{ fontSize: 10, color: "var(--muted-foreground)", letterSpacing: ".08em" }}>
                Markdown 快捷鍵 · **bold** · *italic* · # title
              </span>
              <div style={{ marginLeft: "auto" }}>
                <Btn variant="ghost" size="sm" style={{ color: "var(--muted-foreground)", fontSize: 11.5 }}>
                  <Eye size={13}/> 預覽
                </Btn>
              </div>
            </div>
            {/* editor body */}
            <div className="cjk" contentEditable suppressContentEditableWarning style={{
              padding: "20px 24px",
              fontSize: 15, lineHeight: 1.8, color: "var(--foreground)",
              outline: "none", minHeight: 240,
            }}>
              <p style={{ margin: "0 0 14px" }}>
                我是 <strong>柏宇</strong>，從事一對一肌力訓練教學已邁入第七年。我相信運動的核心不在於追求短期成果、而是讓你<em>長期、規律</em>地把訓練放進日常生活裡。
              </p>
              <p style={{ margin: "0 0 14px", color: "var(--muted-foreground)" }}>
                訓練前先評估、再設計動作組合；過程中以姿勢與技術為優先、循序加重。
              </p>
              <h3 className="display" style={{ fontSize: 19, fontWeight: 900, margin: "24px 0 10px" }}>適合下列族群</h3>
              <ul style={{ margin: 0, paddingLeft: 22, fontSize: 14.5 }}>
                <li>過去自己練、但姿勢不確定、想被人盯動作的人</li>
                <li>產後或久坐族、想從基礎重新建立運動習慣</li>
                <li>追求中長期肌力進步、不滿足於單堂體驗的學員</li>
              </ul>
              <p style={{ margin: "20px 0 0", color: "var(--muted-foreground)", fontSize: 14 }}>
                更多訓練紀錄與學員回饋，請見 <a href="#" style={{ color: "var(--foreground)", textDecorationThickness: 2 }}>我的 Instagram</a>。
              </p>
            </div>
            <div style={{
              padding: "8px 16px",
              borderTop: "1px solid var(--border)",
              background: "var(--muted)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".08em" }}>
                312 字 · 5 段落 · 1 連結
              </span>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".08em" }}>
                已儲存 2 分鐘前
              </span>
            </div>
          </div>
        </SettingsSection>

        {/* SECTION 04 — Intro video */}
        <SettingsSection
          num="04"
          kicker="VIDEO · 介紹影片"
          title="介紹影片"
          desc="支援 YouTube、Vimeo 公開連結。輸入後右側會即時預覽。"
          size={size}
        >
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1.2fr)",
            gap: 18, alignItems: "start",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="影片連結（URL）" hint="允許網域：youtube.com / youtu.be / vimeo.com">
                <TextInput value="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />
              </Field>
              <Field label="影片標題（選填）"><TextInput placeholder="3 分鐘了解我的訓練風格" /></Field>
              <div style={{ display: "flex", gap: 8 }}>
                <Pill variant="outline" icon={<Check size={11} sw={2.5} />}>已驗證 · YouTube</Pill>
                <Pill variant="mutedOutline">embed · 16:9</Pill>
              </div>
            </div>
            {/* preview */}
            <div style={{
              aspectRatio: "16 / 9",
              borderRadius: 14, overflow: "hidden", background: "var(--primary)",
              color: "var(--primary-foreground)",
              border: "1px solid var(--border)",
              position: "relative",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "var(--accent)", color: "var(--accent-foreground)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><Play size={24} /></span>
              <span className="mono" style={{ position: "absolute", bottom: 12, left: 16, fontSize: 10.5, opacity: 0.7, letterSpacing: ".15em" }}>
                PREVIEW · YOUTUBE 03:42
              </span>
            </div>
          </div>
        </SettingsSection>

        {/* SECTION 05 — Photos */}
        <SettingsSection
          num="05"
          kicker="PHOTOS · 環境照片"
          title="環境照片 Gallery"
          desc="最多 10 張、可拖曳排序、可加 caption。學員可在公開頁上點放大。"
          layout="stacked"
          size={size}
          action={!isMobile && (
            <Pill variant="outline" icon={<Hash size={11} />}>6 / 10 張</Pill>
          )}
        >
          {/* dropzone */}
          <div style={{
            marginBottom: 16,
            border: "1.5px dashed var(--border)", borderRadius: 14,
            padding: isMobile ? "20px 18px" : "24px 28px",
            display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between",
            background: "var(--muted)", flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0 }}>
              <span style={{
                width: 44, height: 44, borderRadius: 12,
                background: "var(--accent)", color: "var(--accent-foreground)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><Plus size={20}/></span>
              <div>
                <div className="cjk" style={{ fontSize: 14, fontWeight: 600 }}>拖曳照片到這裡、或選擇檔案</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 4, letterSpacing: ".05em" }}>
                  JPG · PNG · WEBP　·　≤ 8 MB 每張　·　還可上傳 4 張
                </div>
              </div>
            </div>
            <Btn variant="primary" size="sm">選擇檔案</Btn>
          </div>
          {/* grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
            gap: 12,
          }}>
            {[
              "/photos/space-01.jpg", "/photos/space-02.jpg", "/photos/space-03.jpg",
              "/photos/space-04.jpg", "/photos/space-05.jpg", "/photos/space-06.jpg",
            ].map((p, i) => (
              <div key={i} style={{
                background: "var(--card)", borderRadius: 12, overflow: "hidden",
                border: "1px solid var(--border)",
                display: "flex", flexDirection: "column",
              }}>
                <div style={{ position: "relative" }}>
                  <ImgSlot label={p} ratio="4 / 3" radius="0" />
                  {/* actions overlay */}
                  <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
                    <button style={{
                      ...BTN_BASE, width: 28, height: 28, borderRadius: 8,
                      background: "rgba(255,255,255,0.92)", color: "var(--foreground)",
                      border: "1px solid var(--border)",
                    }} title="拖曳排序"><Hash size={13} /></button>
                    <button style={{
                      ...BTN_BASE, width: 28, height: 28, borderRadius: 8,
                      background: "rgba(255,255,255,0.92)", color: "var(--destructive)",
                      border: "1px solid var(--border)",
                    }} title="刪除"><Trash size={13} /></button>
                  </div>
                  {/* order pill */}
                  <span style={{
                    position: "absolute", top: 8, left: 8,
                    background: "var(--primary)", color: "var(--primary-foreground)",
                    fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                    padding: "2px 8px", borderRadius: 999, letterSpacing: ".08em",
                  }}>{String(i + 1).padStart(2, "0")}</span>
                </div>
                <input defaultValue={["深蹲架與槓鈴區", "啞鈴與壺鈴", "暖身與滾筒區", "TRX 與懸吊訓練", "更衣間與淋浴", "捷運出口導引"][i]} className="cjk" style={{
                  border: 0, padding: "8px 12px", fontSize: 12.5,
                  background: "transparent", color: "var(--foreground)", outline: "none",
                  borderTop: "1px solid var(--border)",
                  fontFamily: "var(--font-sans), var(--font-cjk)",
                }} />
              </div>
            ))}
            {/* empty add slots */}
            {[0, 1, 2, 3].slice(0, isMobile ? 2 : 3).map((i) => (
              <button key={"e" + i} style={{
                ...BTN_BASE,
                borderRadius: 12, border: "1.5px dashed var(--border)",
                background: "transparent", color: "var(--muted-foreground)",
                aspectRatio: "4 / 3", height: "auto", padding: 16,
                flexDirection: "column", gap: 6,
              }}>
                <Plus size={20}/>
                <span className="cjk" style={{ fontSize: 11.5 }}>新增照片</span>
              </button>
            ))}
          </div>
        </SettingsSection>

        {/* SECTION 06 — Contact */}
        <SettingsSection
          num="06"
          kicker="CONTACT · 聯絡方式"
          title="聯絡方式"
          desc="會以 icon + 文字並排顯示於 hero。Email 不會公開、只用於系統通知。"
          size={size}
          last
        >
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: 14,
          }}>
            <Field label={<><Mail size={12} style={{ marginRight: 4 }} /> Email</>} hint="必填、用於系統通知">
              <TextInput type="email" value={COACH.email} />
            </Field>
            <Field label={<><Phone size={12} style={{ marginRight: 4 }} /> 電話</>} hint="會顯示於公開頁">
              <TextInput value={COACH.phone} />
            </Field>
            <Field label={<><Chat size={12} style={{ marginRight: 4 }} /> LINE ID</>} hint="會顯示為 @line-id 連結">
              <TextInput value={COACH.line} />
            </Field>
            <Field label="備註" hint="例：地點、停車、預約須知">
              <TextInput value="台北・內湖工作室" />
            </Field>
          </div>
        </SettingsSection>
      </div>

      {/* sticky save bar */}
      <div style={{
        position: "sticky", bottom: 0, marginTop: 20,
        marginLeft: isMobile ? -20 : -40, marginRight: isMobile ? -20 : -40,
        padding: isMobile ? "14px 20px" : "16px 40px",
        background: "color-mix(in oklab, var(--background) 92%, transparent)",
        backdropFilter: "blur(8px)",
        borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap",
        zIndex: 5,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: "var(--accent)",
          }} aria-hidden />
          <div>
            <div className="cjk" style={{ fontSize: 13, fontWeight: 600 }}>有未儲存的變更</div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".05em", marginTop: 2 }}>
              section 01 (名稱) · section 05 (1 張新增)
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" size="md">復原</Btn>
          <PrimaryCta size="md">儲存所有變更</PrimaryCta>
        </div>
      </div>
    </AppShell>
  );
}

Object.assign(window, { SettingsProfilePage, SettingsTabs, SettingsSection, SETTINGS_TABS });
