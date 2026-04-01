import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ═══════════════════════════════════════════════
// ЗАГРУЗКА ДАННЫХ ИЗ CMS
// ═══════════════════════════════════════════════
function useContent() {
  const [projects, setProjects] = useState([]);
  const [about, setAbout] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/content/projects.json").then((r) => r.json()).then((d) => d.projects || d),
      fetch("/content/about.json").then((r) => r.json()),
    ])
      .then(([p, a]) => {
        // только visible проекты
        setProjects(p.filter((proj) => proj.visible !== false));
        setAbout(a);
      })
      .catch((err) => console.error("Content load error:", err))
      .finally(() => setLoading(false));
  }, []);

  return { projects, about, loading };
}

// ═══════════════════════════════════════════════
// СОРТИРОВКИ
// ═══════════════════════════════════════════════
const SORT_MODES = [
  { id: "curated", label: "Curated" },
  { id: "recent", label: "Recent" },
  { id: "az", label: "A → Z" },
];

function sortProjects(projects, mode) {
  const arr = [...projects];
  switch (mode) {
    case "recent":
      return arr.sort((a, b) => (b.year || 0) - (a.year || 0));
    case "az":
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    case "curated":
    default:
      return arr.sort((a, b) => (a.order || 999) - (b.order || 999));
  }
}

// ═══════════════════════════════════════════════
// КОНФИГ
// ═══════════════════════════════════════════════
const SZ = 13;
const TH = {
  light: { "--bg": "#f2f1ee", "--fg": "#141414", "--bd": "#d0cec8", "--p": "#eae9e5" },
  dark: { "--bg": "#0e0e0e", "--fg": "#d9d9d9", "--bd": "#252525", "--p": "#141414" },
};
const applyTh = (t) =>
  Object.entries(TH[t]).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));

function useMobile() {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

export default function App() {
  const { projects: PROJECTS, about: ABOUT, loading } = useContent();

  const [theme, setTheme] = useState("dark");
  const [panels, setPanels] = useState([true, false, false]);
  const [activeId, setActiveId] = useState(null);
  const [hoverPreview, setHoverPreview] = useState(null);
  const [zoomState, setZoomState] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeTags, setActiveTags] = useState(new Set());
  const [sortMode, setSortMode] = useState("curated");
  const [contactOpen, setContactOpen] = useState(false);
  const mobile = useMobile();

  useEffect(() => applyTh(theme), [theme]);

  const ALL_TAGS = useMemo(
    () => [...new Set(PROJECTS.flatMap((p) => p.tags))].sort(),
    [PROJECTS]
  );

  const CONTACT_LINES = useMemo(
    () => ABOUT ? [ABOUT.email, ABOUT.instagram, ABOUT.github, ABOUT.location] : [],
    [ABOUT]
  );

  const project = PROJECTS.find((p) => p.id === activeId);

  const filtered = useMemo(() => {
    const base = activeTags.size === 0
      ? PROJECTS
      : PROJECTS.filter((p) => p.tags.some((t) => activeTags.has(t)));
    return sortProjects(base, sortMode);
  }, [PROJECTS, activeTags, sortMode]);

  const [gridOrder, setGridOrder] = useState([]);
  useEffect(() => {
    if (PROJECTS.length > 0 && gridOrder.length === 0) {
      setGridOrder(sortProjects([...PROJECTS], "curated").map((p) => p.id));
    }
  }, [PROJECTS, gridOrder.length]);

  // пересортировать грид при смене sortMode
  const gridProjects = useMemo(() => {
    if (sortMode === "curated" && gridOrder.length > 0) {
      return gridOrder.map((id) => filtered.find((p) => p.id === id)).filter(Boolean);
    }
    return filtered;
  }, [gridOrder, filtered, sortMode]);

  const pick = useCallback((id, keepPanels = false) => {
    setActiveId(id);
    setContactOpen(false);
    setZoomState(null);
    if (!keepPanels) setPanels([true, true, false]);
  }, []);

  const home = useCallback(() => {
    setActiveId(null);
    setContactOpen(false);
    setHoverPreview(null);
    setZoomState(null);
    setPanels([true, false, false]);
  }, []);

  const showContact = useCallback(() => {
    setActiveId(null);
    setContactOpen(true);
    setZoomState(null);
    setPanels([true, false, true]);
  }, []);

  const goPrev = useCallback(() => {
    if (!activeId || filtered.length === 0) return;
    const idx = filtered.findIndex((p) => p.id === activeId);
    const safeIdx = idx !== -1 ? idx : 0;
    pick(filtered[(safeIdx - 1 + filtered.length) % filtered.length].id, true);
  }, [activeId, filtered, pick]);

  const goNext = useCallback(() => {
    if (!activeId || filtered.length === 0) return;
    const idx = filtered.findIndex((p) => p.id === activeId);
    const safeIdx = idx !== -1 ? idx : 0;
    pick(filtered[(safeIdx + 1) % filtered.length].id, true);
  }, [activeId, filtered, pick]);

  const clickList = useCallback(() => {
    if (!activeId && !contactOpen) return;
    setPanels((prev) => {
      if (contactOpen) {
        if (prev[0] && prev[2]) return [true, false, false];
        if (prev[0] && !prev[2]) return [true, false, true];
        return [true, false, true];
      }
      if (prev[0] && prev[1] && prev[2]) return [true, true, false];
      if (prev[0] && prev[1] && !prev[2]) return [true, false, false];
      if (prev[0] && !prev[1] && !prev[2]) return [true, true, true];
      return [true, true, true];
    });
  }, [activeId, contactOpen]);

  const clickMedia = useCallback(() => {
    if (contactOpen) return;
    setPanels((prev) => {
      if (prev[0] && prev[1] && prev[2]) return [true, true, false];
      if (prev[0] && prev[1] && !prev[2]) return [false, true, false];
      if (!prev[0] && prev[1] && !prev[2]) return [true, true, true];
      if (!prev[0] && prev[1] && prev[2]) return [false, true, false];
      return [true, true, true];
    });
    setZoomState(null);
  }, [contactOpen]);

  const clickDesc = useCallback(() => {
    setPanels((prev) => {
      if (contactOpen) {
        if (prev[0] && prev[2]) return [false, false, true];
        if (!prev[0] && prev[2]) return [true, false, true];
        return [true, false, true];
      }
      if (prev[0] && prev[1] && prev[2]) return [false, true, true];
      if (!prev[0] && prev[1] && prev[2]) return [false, false, true];
      if (!prev[0] && !prev[1] && prev[2]) return [true, true, true];
      if (prev[0] && !prev[1] && prev[2]) return [false, false, true];
      return [true, true, true];
    });
  }, [contactOpen]);

  const dotClick = useCallback((i) => {
    if (!activeId && !contactOpen && i !== 0) return;
    setPanels((prev) => {
      const activeCount = prev.filter(Boolean).length;
      const isIsolated = activeCount === 1 && prev[i];
      if (isIsolated) {
        if (i === 0) return activeId ? [true, true, false] : [true, false, false];
        if (i === 1) return [true, true, false];
        if (i === 2) return contactOpen ? [true, false, true] : [true, true, true];
      } else {
        if (prev[i]) {
          const n = [false, false, false];
          n[i] = true;
          return n;
        } else {
          const n = [...prev];
          n[i] = true;
          return n;
        }
      }
      return prev;
    });
  }, [activeId, contactOpen]);

  const clickTag = useCallback((tag) => {
    setActiveTags((prev) => {
      const n = new Set(prev);
      n.has(tag) ? n.delete(tag) : n.add(tag);
      return n;
    });
    setFiltersOpen(true);
    setPanels((prev) => {
      if (window.innerWidth < 768) return [true, true, false];
      if (!prev[0]) return [true, true, true];
      return prev;
    });
  }, []);

  const toggleTag = useCallback((t) => {
    setActiveTags((prev) => {
      const n = new Set(prev);
      n.has(t) ? n.delete(t) : n.add(t);
      return n;
    });
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") {
        if (zoomState) { setZoomState(null); return; }
        setPanels((prev) => {
          if (prev[2] && !prev[0]) return [true, true, true];
          if (prev.filter(Boolean).length === 1 && prev[1]) return [true, true, false];
          if (prev[1] && !prev[2]) home();
          return prev;
        });
      }
      if (activeId && !contactOpen && filtered.length > 0) {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); goNext(); }
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [activeId, contactOpen, filtered, home, zoomState, goNext, goPrev]);

  const mediaUrl = hoverPreview || (project ? project.media : null);
  const related = project
    ? (project.related || []).map((id) => PROJECTS.find((p) => p.id === id)).filter(Boolean)
    : [];

  const activeCount = panels.filter(Boolean).length;
  const isGrid = !activeId && !contactOpen;

  const listW = panels[0]
    ? activeCount === 1
      ? "100%"
      : contactOpen
        ? "260px"
        : panels[2] && !panels[1]
          ? "calc(100% - 360px)"
          : panels[2] ? "200px" : "260px"
    : "0px";

  const descW = panels[2]
    ? activeCount === 1
      ? "100%"
      : contactOpen
        ? `calc(100% - ${panels[0] ? "260px" : "0px"})`
        : "360px"
    : "0px";

  // ─── loading ───
  if (loading) {
    return (
      <div style={{ ...rootStyle, alignItems: "center", justifyContent: "center" }}>
        <style>{CSS}</style>
      </div>
    );
  }

  // ═══ МОБИЛЬНАЯ ВЕРСИЯ ═══
  if (mobile) {
    return (
      <MobileApp
        theme={theme} setTheme={setTheme} panels={panels} dotClick={dotClick}
        activeId={activeId} project={project} filtered={filtered}
        gridProjects={gridProjects} pick={pick} home={home}
        showContact={showContact} filtersOpen={filtersOpen}
        setFiltersOpen={setFiltersOpen} activeTags={activeTags}
        toggleTag={toggleTag} setActiveTags={setActiveTags} contactOpen={contactOpen}
        related={related} mediaUrl={mediaUrl} isGrid={isGrid}
        clickList={clickList} clickMedia={clickMedia} clickDesc={clickDesc} clickTag={clickTag}
        goPrev={goPrev} goNext={goNext} activeCount={activeCount}
        ALL_TAGS={ALL_TAGS} ABOUT={ABOUT} CONTACT_LINES={CONTACT_LINES}
        sortMode={sortMode} setSortMode={setSortMode}
      />
    );
  }

  // ═══ ДЕСКТОПНАЯ ВЕРСИЯ ═══
  return (
    <div style={rootStyle}>
      <style>{CSS}</style>

      <header style={headerStyle}>
        <Btn onClick={home} bold>MARIA CHERNOBAI</Btn>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
          {!isGrid && <ThreeDots panels={panels} onClick={dotClick} />}
        </div>
        <Btn onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
          {theme === "dark" ? "Light" : "Dark"}
        </Btn>
      </header>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── 1-Й КОНТЕЙНЕР: СПИСОК / ГРИД ── */}
        <div onClick={clickList} style={{
          width: listW, minWidth: 0, flexShrink: 0, transition: TR,
          overflow: "hidden",
          borderRight: panels[0] && (panels[1] || panels[2]) ? "1px solid var(--bd)" : "none",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ display: "flex", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid var(--bd)", gap: 8, flexWrap: "wrap" }}>
            <Btn onClick={(e) => { e.stopPropagation(); setFiltersOpen((p) => !p); }} u={filtersOpen} dim={!filtersOpen && activeTags.size === 0}>
              Filter{activeTags.size > 0 ? ` (${activeTags.size})` : ""}
            </Btn>
            {activeTags.size > 0 && <Btn onClick={(e) => { e.stopPropagation(); setActiveTags(new Set()); }} dim>Clear</Btn>}
            <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
              {SORT_MODES.map((s) => (
                <Btn key={s.id} onClick={(e) => { e.stopPropagation(); setSortMode(s.id); }}
                  u={sortMode === s.id} dim={sortMode !== s.id}>{s.label}</Btn>
              ))}
            </div>
          </div>
          <div style={{ maxHeight: filtersOpen ? 180 : 0, overflow: "hidden", transition: "max-height 0.3s ease", borderBottom: filtersOpen ? "1px solid var(--bd)" : "none" }}>
            <div style={{ padding: "8px 20px 12px", display: "flex", flexWrap: "wrap", gap: 4 }}>
              {ALL_TAGS.map((t) => <Btn key={t} onClick={(e) => { e.stopPropagation(); toggleTag(t); }} u={activeTags.has(t)} dim={!activeTags.has(t)}>{t}</Btn>)}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <ListRow label="Contact" active={contactOpen} onClick={(e) => { e.stopPropagation(); showContact(); }} />
            {isGrid ? (
              <div className="main-grid" style={{ display: "grid", gap: 3, padding: 3 }}>
                {gridProjects.map((p, i) => <GridCard key={p.id} p={p} onClick={pick} i={i} />)}
              </div>
            ) : (
              filtered.map((p) => (
                <ListRow key={p.id} label={p.title} thumb={p.thumb}
                  active={activeId === p.id} onClick={(e) => { e.stopPropagation(); pick(p.id); }}
                  onHover={() => setHoverPreview(p.media)}
                  onLeave={() => setHoverPreview(null)} />
              ))
            )}
          </div>
        </div>

        {/* ── 2-Й КОНТЕЙНЕР: МЕДИА ── */}
        {panels[1] && !contactOpen && (
          <MediaPanel
            mediaUrl={mediaUrl}
            zoomState={zoomState}
            setZoomState={setZoomState}
            onClickCenter={clickMedia}
            onPrev={goPrev}
            onNext={goNext}
          />
        )}

        {/* ── 3-Й КОНТЕЙНЕР: ОПИСАНИЕ / КОНТАКТЫ ── */}
        <div onClick={panels[2] ? clickDesc : undefined} style={{
          width: descW, flexShrink: 0, transition: TR, overflow: "hidden",
          borderLeft: (panels[2] && (panels[0] || panels[1])) ? "1px solid var(--bd)" : "none",
        }}>
          {panels[2] && project && !contactOpen && (
            <DescPanel project={project} related={related} onRelatedClick={pick}
              isolated={activeCount === 1}
              onImgHover={(u) => { setHoverPreview(u); setZoomState(null); }}
              onImgLeave={() => setHoverPreview(null)}
              onRelatedHover={(u) => setHoverPreview(u)}
              onRelatedLeave={() => setHoverPreview(null)}
              onTagClick={clickTag}
              activeTags={activeTags}
              onImgToMedia={(url) => setZoomState({ url, mx: 0.5, my: 0.5 })}
            />
          )}
          {panels[2] && contactOpen && <ContactPanel isolated={activeCount === 1} about={ABOUT} contactLines={CONTACT_LINES} />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// МЕДИА ПАНЕЛЬ
// ═══════════════════════════════════════════════
function MediaPanel({ mediaUrl, zoomState, setZoomState, onClickCenter, onPrev, onNext }) {
  const ref = useRef(null);
  const [hoverZone, setHoverZone] = useState(null);

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (!zoomState) {
      if (x < rect.width * 0.25) setHoverZone("prev");
      else if (x > rect.width * 0.75) setHoverZone("next");
      else setHoverZone("center");
      return;
    }
    const mx = Math.max(0, Math.min(1, x / rect.width));
    const my = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setZoomState((prev) => prev ? { ...prev, mx, my } : null);
  };

  const handleLeave = () => {
    setHoverZone(null);
    if (zoomState) setZoomState(null);
  };

  const handleClick = (e) => {
    if (zoomState) { setZoomState(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.25) onPrev();
    else if (x > rect.width * 0.75) onNext();
    else onClickCenter();
  };

  const isZooming = zoomState && zoomState.url;
  const displayUrl = isZooming ? zoomState.url : mediaUrl;
  const scale = isZooming ? 2.5 : 1;
  const ox = isZooming ? `${zoomState.mx * 100}%` : "50%";
  const oy = isZooming ? `${zoomState.my * 100}%` : "50%";

  return (
    <div ref={ref} onClick={handleClick} onMouseMove={handleMove} onMouseLeave={handleLeave}
      style={{
        flex: 1, minWidth: 0, transition: TR, overflow: "hidden",
        background: "var(--p)", cursor: isZooming ? "zoom-out" : "pointer",
        position: "relative",
      }}>
      {displayUrl && (
        <img key={displayUrl} src={displayUrl} alt=""
          style={{
            width: "100%", height: "100%", objectFit: "cover", display: "block",
            transformOrigin: `${ox} ${oy}`,
            transform: `scale(${scale})`,
            transition: isZooming ? "transform-origin 0.05s linear" : "all 0.3s ease",
            animation: isZooming ? "none" : "fadeIn 0.25s ease both",
          }} />
      )}
      {!isZooming && hoverZone === "prev" && (
        <div style={{ position: "absolute", left: 24, top: "50%", transform: "translateY(-50%)", color: "white", textShadow: "0 1px 6px rgba(0,0,0,0.5)", fontSize: 24, pointerEvents: "none", animation: "fadeIn 0.15s" }}>←</div>
      )}
      {!isZooming && hoverZone === "next" && (
        <div style={{ position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)", color: "white", textShadow: "0 1px 6px rgba(0,0,0,0.5)", fontSize: 24, pointerEvents: "none", animation: "fadeIn 0.15s" }}>→</div>
      )}
      {isZooming && (
        <div style={{
          position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
          opacity: 0.4, pointerEvents: "none",
        }}>move to zoom · click to exit</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// ТРИ ТОЧКИ
// ═══════════════════════════════════════════════
function ThreeDots({ panels, onClick }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "6px 14px", userSelect: "none" }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: "flex", alignItems: "center" }}>
          <div onClick={(e) => { e.stopPropagation(); onClick(i); }} style={{
            width: 10, height: 10, borderRadius: "50%",
            background: panels[i] ? "var(--fg)" : "transparent",
            border: `1.5px solid ${panels[i] ? "var(--fg)" : "var(--bd)"}`,
            transition: "all 0.25s ease", cursor: "pointer",
          }} />
          {i < 2 && <div style={{
            width: 16, height: 1.5,
            background: (panels[i] && panels[i+1]) ? "var(--fg)" : "var(--bd)",
            transition: "background 0.25s ease",
          }} />}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════
// МОБИЛЬНАЯ ВЕРСИЯ
// ═══════════════════════════════════════════════
function MobileApp({
  theme, setTheme, panels, dotClick, activeId, project, filtered, gridProjects,
  pick, home, showContact, filtersOpen, setFiltersOpen, activeTags, toggleTag,
  setActiveTags, contactOpen, related, mediaUrl, isGrid, clickList, clickMedia, clickDesc,
  clickTag, goPrev, goNext, activeCount, ALL_TAGS, ABOUT, CONTACT_LINES,
  sortMode, setSortMode,
}) {
  const touchRef = useRef({ x: 0 });
  const handleTS = (e) => { touchRef.current.x = e.touches[0].clientX; };
  const handleTE = (e) => {
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    if (Math.abs(dx) > 60 && activeId && filtered.length > 0) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  const handleMediaTap = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.25) goPrev();
    else if (x > rect.width * 0.75) goNext();
    else clickMedia();
  };

  return (
    <div style={{ ...rootStyle, touchAction: "pan-y" }}>
      <style>{CSS}</style>
      <header style={headerStyle}>
        <Btn onClick={home} bold>MC</Btn>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
          {!isGrid && <ThreeDots panels={panels} onClick={dotClick} />}
        </div>
        <Btn onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
          {theme === "dark" ? "Light" : "Dark"}
        </Btn>
      </header>

      {panels[1] && !contactOpen && (
        <div onClick={handleMediaTap} onTouchStart={handleTS} onTouchEnd={handleTE}
          style={{
            height: activeCount === 1 ? "100vh" : panels[2] ? "38vh" : "45vh", flexShrink: 0,
            background: "var(--p)", overflow: "hidden",
            borderBottom: "1px solid var(--bd)", cursor: "pointer",
            transition: "height 0.3s ease",
          }}>
          {mediaUrl && <img key={mediaUrl} src={mediaUrl} alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", animation: "fadeIn 0.2s ease both" }} />}
        </div>
      )}

      <div onClick={clickList} style={{ flex: 1, overflowY: "auto" }}>
        {panels[2] && project && !contactOpen && (
          <div onClick={(e) => { e.stopPropagation(); clickDesc(); }} style={{ cursor: "pointer" }}>
            <DescPanel project={project} related={related} onRelatedClick={pick} isolated={activeCount === 1}
              onImgHover={() => {}} onImgLeave={() => {}}
              onRelatedHover={() => {}} onRelatedLeave={() => {}}
              onTagClick={clickTag} activeTags={activeTags}
              onImgToMedia={() => {}} />
          </div>
        )}

        {panels[0] && isGrid && (
          <>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--bd)", display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Btn onClick={(e) => { e.stopPropagation(); setFiltersOpen((p) => !p); }} u={filtersOpen} dim={!filtersOpen && activeTags.size === 0}>
                Filter{activeTags.size > 0 ? ` (${activeTags.size})` : ""}
              </Btn>
              {activeTags.size > 0 && <Btn onClick={(e) => { e.stopPropagation(); setActiveTags(new Set()); }} dim>Clear</Btn>}
              <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                {SORT_MODES.map((s) => (
                  <Btn key={s.id} onClick={(e) => { e.stopPropagation(); setSortMode(s.id); }}
                    u={sortMode === s.id} dim={sortMode !== s.id}>{s.label}</Btn>
                ))}
              </div>
            </div>
            {filtersOpen && (
              <div style={{ padding: "8px 16px 12px", display: "flex", flexWrap: "wrap", gap: 4, borderBottom: "1px solid var(--bd)" }}>
                {ALL_TAGS.map((t) => <Btn key={t} onClick={(e) => { e.stopPropagation(); toggleTag(t); }} u={activeTags.has(t)} dim={!activeTags.has(t)}>{t}</Btn>)}
              </div>
            )}
            <ListRow label="Contact" onClick={(e) => { e.stopPropagation(); showContact(); }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: 2 }}>
              {gridProjects.map((p, i) => <GridCard key={p.id} p={p} onClick={pick} i={i} full />)}
            </div>
          </>
        )}

        {panels[0] && !isGrid && !panels[2] && !contactOpen && (
          <>
            <ListRow label="Contact" onClick={(e) => { e.stopPropagation(); showContact(); }} />
            {filtered.map((p) => (
              <ListRow key={p.id} label={p.title} thumb={p.thumb}
                active={activeId === p.id} onClick={(e) => { e.stopPropagation(); pick(p.id); }} />
            ))}
          </>
        )}

        {panels[2] && contactOpen && (
          <div onClick={(e) => { e.stopPropagation(); clickDesc(); }} style={{ cursor: "pointer", height: "100%" }}>
            <ContactPanel isolated={activeCount === 1} about={ABOUT} contactLines={CONTACT_LINES} />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ПАНЕЛЬ ОПИСАНИЯ
// ═══════════════════════════════════════════════
function DescPanel({ project, related, onRelatedClick, onImgHover, onImgLeave, onRelatedHover, onRelatedLeave, onTagClick, activeTags, onImgToMedia, isolated }) {
  return (
    <div key={project.id} style={{
      padding: "20px 24px", height: "100%", overflowY: "auto",
      animation: "slideL 0.3s cubic-bezier(0.22,1,0.36,1) both",
    }}>
      <div style={{ maxWidth: isolated ? 600 : "none", margin: "0 auto" }}>
        <div style={{ marginBottom: 16 }}>{project.title}</div>
        <div style={{ marginBottom: 20, lineHeight: 1.7 }}>{project.description}</div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>
          {project.tags.map((t) => (
            <span key={t} onClick={(e) => { e.stopPropagation(); onTagClick(t); }}
              style={{
                cursor: "pointer",
                textDecoration: "underline", textUnderlineOffset: 3, textDecorationThickness: 1,
                opacity: activeTags.size > 0 && !activeTags.has(t) ? 0.35 : 1,
                transition: "opacity 0.15s",
              }}>{t}</span>
          ))}
        </div>

        {project.gallery && project.gallery.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ opacity: 0.4, marginBottom: 10, letterSpacing: "0.04em" }}>Gallery</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {project.gallery.map((url, i) => (
                <GalleryThumb key={i} url={url}
                  onHover={() => onImgHover(url)}
                  onLeave={onImgLeave}
                  onMouseToMedia={() => onImgToMedia(url)}
                />
              ))}
            </div>
          </div>
        )}

        {related.length > 0 && (
          <div>
            <div style={{ opacity: 0.4, marginBottom: 10, letterSpacing: "0.04em" }}>Related</div>
            {related.map((rp) => (
              <ListRow key={rp.id} label={rp.title} thumb={rp.thumb}
                onClick={(e) => { e.stopPropagation(); onRelatedClick(rp.id, true); }}
                onHover={() => onRelatedHover(rp.media)} onLeave={onRelatedLeave} compact />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryThumb({ url, onHover, onLeave, onMouseToMedia }) {
  const [h, setH] = useState(false);
  const ref = useRef(null);

  const handleLeave = (e) => {
    setH(false);
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      if (e.clientX < rect.left) onMouseToMedia();
    }
    onLeave();
  };

  return (
    <div ref={ref}
      onMouseEnter={() => { setH(true); onHover(); }}
      onMouseLeave={handleLeave}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "100%", overflow: "hidden", background: "var(--p)", cursor: "pointer",
        outline: h ? "1px solid var(--fg)" : "1px solid transparent", transition: "outline 0.15s",
      }}>
      <img src={url} alt="" loading="lazy" style={{ width: "100%", height: "auto", display: "block" }} />
    </div>
  );
}

// ═══════════════════════════════════════════════
// КОНТАКТЫ
// ═══════════════════════════════════════════════
function ContactPanel({ isolated, about, contactLines }) {
  if (!about) return null;
  return (
    <div style={{
      padding: "24px 24px", height: "100%", overflowY: "auto",
      animation: "fadeIn 0.3s ease both", display: "flex", flexDirection: "column",
      alignItems: isolated ? "center" : "flex-start", textAlign: isolated ? "center" : "left",
    }}>
      <div style={{ maxWidth: isolated ? 600 : "none", width: "100%", margin: isolated ? "auto" : "0" }}>
        <div style={{ marginBottom: 24 }}>{about.name}</div>
        <div style={{ marginBottom: 6 }}>{about.role}</div>
        <div style={{ marginBottom: 20 }}>{about.location}</div>
        <div style={{ marginBottom: 24, lineHeight: 1.7 }}>{about.practice}</div>
        <div style={{ marginBottom: 8, opacity: 0.4, letterSpacing: "0.04em" }}>Services</div>
        <div style={{ marginBottom: 24, lineHeight: 1.7 }}>{about.services}</div>
        <div style={{ marginBottom: 8, opacity: 0.4, letterSpacing: "0.04em" }}>Education</div>
        <div style={{ marginBottom: 24, lineHeight: 1.7 }}>{about.education}</div>
        <div style={{ marginBottom: 8, opacity: 0.4, letterSpacing: "0.04em" }}>Languages</div>
        <div style={{ marginBottom: 24 }}>{about.languages}</div>
        <div style={{ marginBottom: 8, opacity: 0.4, letterSpacing: "0.04em" }}>Contact</div>
        <div style={{ lineHeight: 2 }}>{contactLines.map((l, i) => <div key={i}>{l}</div>)}</div>
        <div style={{ marginTop: 32, opacity: 0.4 }}>{about.modeling}</div>
        <div style={{ marginTop: 12, opacity: 0.4 }}>{about.available}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ОБЩИЕ КОМПОНЕНТЫ
// ═══════════════════════════════════════════════
function Btn({ children, onClick, u, dim, bold, style: sx }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick && onClick(e); }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        background: "none", border: "none", color: "var(--fg)", cursor: "pointer",
        fontSize: SZ, fontFamily: "inherit", fontWeight: bold ? 500 : 400, padding: "4px 6px",
        opacity: dim ? 0.35 : h ? 0.7 : 1, textDecoration: u ? "underline" : "none",
        textUnderlineOffset: 3, textDecorationThickness: 1, transition: "opacity 0.12s",
        whiteSpace: "nowrap", letterSpacing: bold ? "0.06em" : "0.03em", ...sx,
      }}>{children}</button>
  );
}

function ListRow({ label, thumb, active, onClick, onHover, onLeave, compact }) {
  const [h, setH] = useState(false);
  return (
    <div onClick={(e) => { e.stopPropagation(); onClick && onClick(e); }}
      onMouseEnter={() => { setH(true); onHover && onHover(); }}
      onMouseLeave={() => { setH(false); onLeave && onLeave(); }}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: compact ? "8px 0" : "11px 20px", cursor: "pointer",
        borderBottom: compact ? "none" : "1px solid var(--bd)",
        background: active ? "rgba(128,128,128,0.08)" : h ? "rgba(128,128,128,0.04)" : "transparent",
        transition: "background 0.12s",
      }}>
      {thumb && (
        <div style={{ width: compact ? 40 : 52, height: compact ? 26 : 34, flexShrink: 0, overflow: "hidden", background: "var(--p)" }}>
          <img src={thumb} alt="" loading="lazy" style={{
            width: "115%", height: "115%", objectFit: "cover", display: "block",
            transition: "transform 1.4s cubic-bezier(0.22,1,0.36,1)",
            transform: h ? "scale(1.1) translate(-3%,-3%)" : "scale(1.03)",
          }} />
        </div>
      )}
      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
    </div>
  );
}

function GridCard({ p, onClick, i, full }) {
  const [h, setH] = useState(false);
  return (
    <div onClick={(e) => { e.stopPropagation(); onClick(p.id); }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        cursor: "pointer", overflow: "hidden", position: "relative",
        aspectRatio: full ? "16/9" : "4/3", background: "var(--p)",
        animation: `fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) ${i * 40}ms both`,
      }}>
      <img src={p.thumb} alt={p.title} loading="lazy" style={{
        width: "100%", height: "100%", objectFit: "cover", display: "block",
        transition: "opacity 0.25s ease",
        opacity: h ? 0.85 : 1,
      }} />
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", padding: 16,
        opacity: h ? 1 : 0, transition: "opacity 0.2s ease",
        background: "linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 40%)",
      }}><span style={{ color: "white", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>{p.title}</span></div>
    </div>
  );
}

const TR = "all 0.5s cubic-bezier(0.22,1,0.36,1)";
const rootStyle = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  fontSize: SZ, fontWeight: 400, color: "var(--fg)", background: "var(--bg)",
  height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", lineHeight: 1.55,
};
const headerStyle = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "12px 16px", borderBottom: "1px solid var(--bd)", flexShrink: 0, position: "relative",
};
const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 0; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes slideL { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
  .main-grid {
    grid-template-columns: repeat(1, 1fr);
  }
  @media (min-width: 700px) {
    .main-grid { grid-template-columns: repeat(2, 1fr) !important; }
  }
  @media (min-width: 1100px) {
    .main-grid { grid-template-columns: repeat(3, 1fr) !important; }
  }
`;
