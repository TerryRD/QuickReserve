// student/page-public.jsx — /<tenantSlug> full public coach page
// hero · 改期 banner · bio · video · gallery · services · slot picker

function PublicCoachPage({ size = "desktop", reschedule = false }) {
  const isMobile = size === "mobile";
  const isTablet = size === "tablet";
  const padX = isMobile ? 20 : isTablet ? 40 : 72;
  const avatarSize = isMobile ? 76 : 104;
  const titleSize = isMobile ? 60 : isTablet ? 92 : 128;

  // selected service for demo state
  const selectedServiceId = "s1";

  return (
    <Mockup>
      <TopBar variant="public-out" size={size} crumb={"/" + COACH.slug} />

      {/* HERO */}
      <section style={{ padding: `${isMobile ? 32 : 56}px ${padX}px ${isMobile ? 36 : 56}px` }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: isMobile ? 24 : 32 }}>
          <Pill variant="yellow" icon={<Star size={11} />}>STRENGTH COACH</Pill>
          <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".12em" }}>
            EST 2018 · {COACH.yearsExp} YRS · TAIPEI 內湖
          </span>
        </div>

        <h1 className="display" style={{
          fontSize: titleSize, lineHeight: 0.9, margin: 0, fontWeight: 400,
          letterSpacing: "-0.01em", textTransform: "uppercase", color: "var(--foreground)",
        }}>
          PO-YU
          <br />
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 12 }}>
            CHEN
            <span aria-hidden style={{
              display: "inline-block",
              width: isMobile ? 10 : 16, height: isMobile ? 10 : 16,
              borderRadius: "50%", background: "var(--accent)",
              transform: "translateY(-10%)",
            }} />
          </span>
        </h1>

        <div className="display cjk" style={{
          fontSize: isMobile ? 22 : 28, fontWeight: 900,
          marginTop: isMobile ? 10 : 14, display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap",
        }}>
          {COACH.name}
          <span className="mono" style={{ fontSize: isMobile ? 11 : 13, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: ".15em" }}>
            —— 教練 / COACH
          </span>
        </div>

        {/* avatar + subtitle */}
        <div style={{
          display: "flex", flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? 20 : 28, alignItems: isMobile ? "flex-start" : "center",
          marginTop: isMobile ? 28 : 40, maxWidth: 880,
        }}>
          <Avatar size={avatarSize} initial="陳" verified />
          <p className="cjk" style={{
            fontSize: isMobile ? 16 : 19, lineHeight: 1.55, margin: 0,
            color: "var(--foreground)", fontWeight: 500,
          }}>{COACH.subtitle}</p>
        </div>

        {/* contact pills */}
        <div style={{ marginTop: isMobile ? 24 : 32, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            [<Mail size={12} />, COACH.email],
            [<Phone size={12} />, COACH.phone],
            [<Chat size={12} />, "LINE " + COACH.line],
            [<Pin size={12} />, COACH.city],
          ].map(([ico, txt], i) => (
            <span key={i} className="cjk" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 14px", borderRadius: "999px",
              background: "var(--secondary)",
              fontSize: 12.5, color: "var(--foreground)",
              fontFamily: "var(--font-mono)", fontWeight: 500,
            }}>
              <span style={{ color: "var(--foreground)" }}>{ico}</span>
              {txt}
            </span>
          ))}
        </div>

        {/* AuthCta */}
        <div style={{ marginTop: isMobile ? 28 : 36, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <PrimaryCta size="lg">登入預約</PrimaryCta>
          <Btn variant="secondary" size="lg">建立帳號</Btn>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-foreground)", letterSpacing: ".12em", marginLeft: 4 }}>
            訪客可瀏覽 · 預約需登入
          </span>
        </div>
      </section>

      {/* RESCHEDULE BANNER (only when ?reschedule=) */}
      {reschedule && (
        <section style={{ padding: `0 ${padX}px ${isMobile ? 20 : 24}px` }}>
          <Banner
            variant="warning"
            icon={<Calendar size={20} sw={2}/>}
            title="改期模式 · 選擇新時段後原預約自動取消"
            body={<>正在改期：8/19 (二) 16:00 · 一對一肌力訓練。選擇新時段送出後，原預約 <strong>b1</strong> 會自動取消、堂數退回套裝。</>}
            action={!isMobile && <Btn variant="ghost" size="sm">退出改期模式 ✕</Btn>}
          />
        </section>
      )}

      {/* BIO — rich text block */}
      <section style={{
        padding: `${isMobile ? 28 : 56}px ${padX}px ${isMobile ? 28 : 48}px`,
        borderTop: "1px solid var(--border)",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 280px) minmax(0, 1fr)",
          gap: isMobile ? 20 : 48,
          alignItems: "start",
          maxWidth: 1120,
        }}>
          <SectionHead kicker="ABOUT · 關於" title="關於我" eng="ABOUT" />
          <article className="cjk" style={{ maxWidth: 640 }}>
            <p style={{ fontSize: isMobile ? 15 : 17, lineHeight: 1.8, margin: "0 0 18px" }}>
              我是 <strong>柏宇</strong>，從事一對一肌力訓練教學已邁入第七年。我相信運動的核心不在於追求短期成果、而是讓你<em>長期、規律</em>地把訓練放進日常生活裡。
            </p>
            <p style={{ fontSize: isMobile ? 15 : 17, lineHeight: 1.8, margin: "0 0 24px", color: "var(--muted-foreground)" }}>
              訓練前先評估、再設計動作組合；過程中以姿勢與技術為優先、循序加重。
            </p>
            <h3 className="display" style={{ fontSize: isMobile ? 20 : 24, margin: "32px 0 14px", fontWeight: 900 }}>
              適合下列族群
            </h3>
            <ul style={{ margin: 0, paddingLeft: 22, fontSize: isMobile ? 14.5 : 16, lineHeight: 1.85 }}>
              <li>過去自己練、但姿勢不確定、想被人盯動作的人</li>
              <li>產後或久坐族、想從基礎重新建立運動習慣</li>
              <li>追求中長期肌力進步、不滿足於單堂體驗的學員</li>
            </ul>
            <p style={{ fontSize: isMobile ? 13.5 : 15, lineHeight: 1.7, marginTop: 28, color: "var(--muted-foreground)" }}>
              更多訓練紀錄與學員回饋，請見 <a href="#" style={{ color: "var(--foreground)", textDecorationThickness: 2, textUnderlineOffset: 4 }}>我的 Instagram</a>。
            </p>
          </article>
        </div>
      </section>

      {/* VIDEO */}
      <section style={{ padding: `${isMobile ? 16 : 32}px ${padX}px ${isMobile ? 28 : 48}px` }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 280px) minmax(0, 1fr)",
          gap: isMobile ? 20 : 48,
          alignItems: "start",
        }}>
          <SectionHead kicker="VIDEO · 介紹影片" title="介紹影片" eng="" hint="3 分鐘了解我的訓練風格" />
          <div style={{ maxWidth: 720 }}>
            <div style={{
              aspectRatio: "16 / 9", width: "100%",
              borderRadius: 16,
              background: "var(--primary)", color: "var(--primary-foreground)",
              position: "relative", overflow: "hidden",
              border: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{
                width: 76, height: 76, borderRadius: "50%",
                background: "var(--accent)", color: "var(--accent-foreground)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><Play size={28} /></span>
              <span className="mono" style={{
                position: "absolute", bottom: 14, left: 18,
                fontSize: 10.5, letterSpacing: ".15em", opacity: 0.7,
              }}>YOUTUBE · 03:42</span>
              <span className="mono" style={{
                position: "absolute", top: 14, right: 18,
                fontSize: 10.5, letterSpacing: ".15em", opacity: 0.7,
              }}>16 : 9</span>
            </div>
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <section style={{ padding: `${isMobile ? 16 : 32}px ${padX}px ${isMobile ? 28 : 56}px` }}>
        <SectionHead kicker="SPACE · 環境照片" title="環境" eng="SPACE" hint="台北內湖工作室・採預約制" />
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(3, 1fr)",
          gap: isMobile ? 14 : 16,
        }}>
          {[
            { label: "/photos/space-01.jpg", caption: "深蹲架與槓鈴區" },
            { label: "/photos/space-02.jpg", caption: "啞鈴與壺鈴" },
            { label: "/photos/space-03.jpg", caption: "暖身與滾筒區" },
            { label: "/photos/space-04.jpg", caption: "TRX 與懸吊訓練" },
            { label: "/photos/space-05.jpg", caption: "更衣間與淋浴" },
            { label: "/photos/space-06.jpg", caption: "捷運出口導引" },
          ].map((p, i) => (
            <figure key={i} style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <ImgSlot label={p.label} ratio="4 / 3" />
              <figcaption className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".05em" }}>
                {String(i + 1).padStart(2, "0")} — {p.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" style={{
        padding: `${isMobile ? 36 : 64}px ${padX}px ${isMobile ? 32 : 48}px`,
        background: "var(--muted)", borderTop: "1px solid var(--border)",
      }}>
        <SectionHead kicker="SECTION / 03" title="服務" eng="SERVICES"
          hint="選一個服務、再挑選時段。實際扣費透過套裝、單堂購買請洽教練。"
          right={<span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".1em" }}>
            03 ITEMS · 已選擇 1
          </span>}
        />
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "repeat(3, 1fr)",
          gap: isMobile ? 14 : 18,
        }}>
          {SERVICES.map((s, i) => (
            <ServiceCard key={s.id} s={s} index={i} selected={s.id === selectedServiceId} />
          ))}
        </div>
      </section>

      {/* SLOT PICKER */}
      <section style={{
        padding: `${isMobile ? 32 : 56}px ${padX}px ${isMobile ? 48 : 80}px`,
        background: "var(--muted)",
      }}>
        <SectionHead kicker="SECTION / 04" title="時段" eng="SLOTS"
          hint={"目前服務：一對一肌力訓練 · 60 分鐘 · NT$ 2,000"}
          right={
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" size="sm"><ArrowL size={12}/></Btn>
              <Btn variant="ghost" size="sm">今天</Btn>
              <Btn variant="secondary" size="sm"><Arrow size={12}/></Btn>
            </div>
          }
        />

        {/* week label */}
        <div className="mono" style={{
          marginBottom: 12, fontSize: 11, letterSpacing: ".15em",
          color: "var(--muted-foreground)",
        }}>WEEK · 2026.08.16 — 08.22</div>

        <Card style={{ padding: isMobile ? 18 : 26 }}>
          <SlotPicker size={size} selectedDate={3} />
        </Card>

        {/* selected slot recap */}
        <div style={{
          marginTop: 18,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: isMobile ? "14px 16px" : "16px 22px",
          background: "var(--primary)", color: "var(--primary-foreground)",
          borderRadius: 14, gap: 14, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, minWidth: 0 }}>
            <span className="display" style={{ fontSize: isMobile ? 26 : 32, fontWeight: 400 }}>8/19 · 16:00</span>
            <span className="cjk" style={{ fontSize: 13, opacity: 0.7 }}>· 一對一肌力訓練 · 60 分鐘</span>
          </div>
          <PrimaryCta size="md">{reschedule ? "改期到此時段" : "前往預約"}</PrimaryCta>
        </div>
      </section>

      {/* footer note */}
      <section style={{
        padding: `${isMobile ? 28 : 40}px ${padX}px ${isMobile ? 40 : 56}px`,
        borderTop: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <QRMark size={28} />
          <div className="mono" style={{ fontSize: 11, letterSpacing: ".1em", color: "var(--muted-foreground)" }}>
            QUICKRESERVE · 由 {COACH.name} 教練建立 · 2026
          </div>
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          <a href="#" className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".08em" }}>套裝</a>
          <a href="#" className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".08em" }}>我的預約</a>
          <a href="#" className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", letterSpacing: ".08em" }}>登入</a>
        </div>
      </section>
    </Mockup>
  );
}

Object.assign(window, { PublicCoachPage });
