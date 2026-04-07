export const ADMIN_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Nunito:wght@400;500;600;700&display=swap');

  .admin-shell,
  .admin-shell * {
    box-sizing: border-box;
  }

  .admin-shell {
    --bg:         #FAF8F5;
    --bg2:        #FFFFFF;
    --bg3:        #EDE8E1;
    --border:     #D5CEC4;
    --text:       #1A1212;
    --text2:      #4A3F3F;
    --text3:      #6B6060;

    --maroon:        #6B1E2E;
    --maroon-light:  #8A3145;
    --gold:          #F0B429;
    --gold-dark:     #B58316;
    --green:         #3A8D5D;
    --amber:         #E7B44C;
    --blue:          #5A8DEE;
    --red:           #D16B5B;

    --maroon-bg:     #F5E8EB;
    --maroon-txt:    #6B1E2E;
    --gold-bg:       #FDF6E3;
    --gold-txt:      #6B4D0A;
    --green-bg:      #E3F3EA;
    --green-txt:     #145A3C;
    --amber-bg:      #FEF6E0;
    --amber-txt:     #6B4D0A;
    --blue-bg:       #E5EDFC;
    --blue-txt:      #153D7A;
    --red-bg:        #FDECEB;
    --red-txt:       #8B2020;
  }

  .admin-shell input,
  .admin-shell select,
  .admin-shell textarea {
    background: #FFFFFF;
    border: 1px solid #D5CEC4;
    color: #1A1212;
    min-height: 40px;
    width: 100%;
    padding: 10px 12px;
    border-radius: 10px;
    font-weight: 500;
    font-family: 'Nunito', sans-serif;
    font-size: 14px;
    line-height: 1.2;
  }

  .admin-shell input:focus,
  .admin-shell select:focus,
  .admin-shell textarea:focus {
    border-color: var(--gold);
    box-shadow: 0 0 0 3px rgba(240, 180, 41, 0.15);
  }

  .admin-shell input::placeholder { color: #B8ADA0; }

  .admin-shell button,
  .admin-shell select,
  .admin-shell input,
  .admin-shell textarea {
    transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease, color 0.16s ease, transform 0.16s ease;
  }

  .admin-shell button:hover {
    transform: translateY(-1px);
  }

  .ag-card { transition: border-color 0.15s, box-shadow 0.15s; }
  .ag-card:hover { border-color: var(--gold) !important; box-shadow: 0 6px 20px rgba(107,30,46,0.08); }

  .sess-card { transition: border-color 0.15s; }
  .sess-card:hover { border-color: var(--gold-dark); }

  @keyframes livePulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.4; transform: scale(0.85); }
  }
  .live-dot { animation: livePulse 1.8s ease-in-out infinite; }

  @keyframes liveGlow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(58, 141, 93, 0.25); }
    50%       { box-shadow: 0 0 0 6px rgba(58, 141, 93, 0); }
  }
  .live-card { animation: liveGlow 2.4s ease-in-out infinite; }
`;

export const SB = {
  sidebar: {
    width: 230,
    flexShrink: 0,
    background: '#4A1320',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflowY: 'auto',
  },
  logoBlock: {
    padding: '20px 16px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  logoImg: { width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gold)', flexShrink: 0 },
  logoName: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: '#F0B429', letterSpacing: '0.05em' },
  logoSub: { fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em', marginTop: 2 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: 'rgba(255,255,255,0.3)',
    padding: '16px 16px 6px',
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: 'calc(100% - 20px)',
    margin: '2px 10px',
    padding: '10px 12px',
    background: 'none',
    border: 'none',
    borderRadius: 8,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.12s, color 0.12s',
  },
  navBtnActive: {
    background: 'rgba(240,180,41,0.15)',
    color: '#F0B429',
  },
  navIcon: { width: 18, textAlign: 'center', fontSize: 14, flexShrink: 0, color: '#F0B429' },
  userBlock: {
    padding: '14px 14px 18px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#F0B429',
    color: '#4A1320',
    fontSize: 11,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userName: { fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRole: { fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'capitalize' },
  signOutBtn: { background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: 'rgba(255,255,255,0.5)', fontSize: 13, padding: '4px 8px', cursor: 'pointer', flexShrink: 0 },
};

export const A = {
  shell: { display: 'flex', minHeight: '100vh', fontFamily: "'Nunito', sans-serif", background: 'var(--bg)' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  topbar: {
    background: '#FFFFFF',
    borderBottom: '1px solid var(--border)',
    padding: '14px 28px',
    minHeight: 72,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    boxShadow: '0 4px 18px rgba(26,18,18,0.05)',
  },
  topbarLeft: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flexWrap: 'wrap' },
  topbarRight: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' },
  pageTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: '#2D1F1F', letterSpacing: '0.03em' },
  backLink: { background: 'none', border: 'none', color: 'var(--maroon)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  toolbarSelect: {
    minWidth: 240,
    width: 'auto',
    height: 40,
    padding: '0 40px 0 12px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    background: '#fff',
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 700,
    outline: 'none',
    fontFamily: 'inherit',
  },
  eventPill: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 40,
    fontSize: 11,
    fontWeight: 700,
    background: '#FDF6E3',
    border: '1.5px solid var(--gold-dark)',
    borderRadius: 999,
    padding: '0 14px',
    color: '#6B1E2E',
  },
  contentArea: { flex: 1, padding: '28px 28px 72px', overflowY: 'auto' },
  muted: { fontSize: 13, color: 'var(--text3)', padding: '8px 0', fontWeight: 500 },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    padding: '0 16px',
    background: 'var(--maroon)',
    border: '1px solid var(--maroon-light)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
    boxShadow: '0 6px 16px rgba(107,30,46,0.14)',
  },
  ghostBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    padding: '0 14px',
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 10,
    color: 'var(--text2)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  saveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    padding: '0 20px',
    background: 'var(--maroon)',
    border: '1px solid var(--maroon-light)',
    borderRadius: 10,
    color: '#fff',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 17,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.04em',
    boxShadow: '0 8px 20px rgba(107,30,46,0.16)',
  },
  iconBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 10,
    fontSize: 15,
    cursor: 'pointer',
    padding: 0,
    color: 'var(--text3)',
    lineHeight: 1,
    fontFamily: 'inherit',
  },
  sectionHdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel: { fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6B1E2E' },
  stackedSection: { display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 },
  sectionIntro: { fontSize: 13, color: 'var(--text3)', lineHeight: 1.5, maxWidth: 760 },
  actionRow: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  splitLayout: { display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)', gap: 16, alignItems: 'start' },
  sidePanel: { background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 16, padding: '18px', boxShadow: '0 10px 30px rgba(26,18,18,0.05)', position: 'sticky', top: 92 },
  sidePanelTitle: { fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--maroon)', marginBottom: 12 },
  sidePanelText: { fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 },
  quickNavList: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 },
  quickNavBtn: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minHeight: 46, padding: '0 14px', borderRadius: 12, border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' },
  quickNavMeta: { fontSize: 11, color: 'var(--text3)', fontWeight: 600 },
  contentStack: { display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 },
  statStrip: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 },
  statTile: { background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', boxShadow: '0 6px 20px rgba(26,18,18,0.04)' },
  statTileValue: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700, color: 'var(--maroon)', lineHeight: 1 },
  statTileLabel: { fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 6, fontWeight: 700 },
  metricGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 24 },
  metricCard: { background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 18px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  metricVal: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 40, fontWeight: 700, lineHeight: 1.1, color: '#6B1E2E' },
  metricLabel: { fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 6, fontWeight: 600 },
  ageGroupGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 24 },
  agCard: { background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 12, padding: '18px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  agName: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: '#2D1F1F', marginBottom: 14 },
  agStats: { display: 'flex', gap: 20, marginBottom: 14 },
  agStatVal: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: '#6B1E2E' },
  agStatLabel: { fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 },
  agFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' },
  agLink: { fontSize: 13, color: 'var(--maroon)', fontWeight: 600 },
  agRankBtn: { background: 'none', border: 'none', fontSize: 13, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 },
  progressTrack: { height: 5, background: '#F0ECE6', borderRadius: 3, overflow: 'hidden', marginBottom: 2 },
  progressFill: { height: 5, background: 'var(--maroon)', borderRadius: 3, transition: 'width 0.4s' },
  dateFilterRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 },
  dateChip: { padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, color: 'var(--text2)', cursor: 'pointer', background: '#fff', fontFamily: 'inherit' },
  dateChipActive: { background: 'var(--maroon)', borderColor: 'var(--maroon)', color: '#fff' },
  sessCard: { background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
  sessTagRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  typeTag: { fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em' },
  rangeTag: { fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: '#F0ECE6', color: 'var(--text2)', border: '1px solid var(--border)' },
  ageTag: { fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: '#F5E8EB', color: '#6B1E2E', border: '1px solid #D4A0AC' },
  sessMain: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  sessName: { fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 3 },
  sessMeta: { fontSize: 13, color: 'var(--text2)', fontWeight: 500 },
  sessActions: { display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' },
  statusSelect: { minHeight: 36, width: 'auto', fontSize: 12, padding: '0 28px 0 10px', borderRadius: 10, cursor: 'pointer', outline: 'none', fontFamily: 'inherit', fontWeight: 700 },
  scorerRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  scorerRowLabel: { fontSize: 13, color: 'var(--text2)', marginRight: 2, fontWeight: 600 },
  scorerChip: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6B5314', background: '#FDF6E3', border: '1px solid var(--gold-dark)', borderRadius: 20, padding: '2px 10px' },
  chipX: { background: 'none', border: 'none', color: 'var(--gold-dark)', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1, fontFamily: 'inherit' },
  addScorerBtn: { display: 'inline-flex', alignItems: 'center', minHeight: 30, background: 'none', border: '1px dashed var(--gold-dark)', borderRadius: 20, color: 'var(--gold-dark)', fontSize: 11, padding: '0 10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 },
  wizardTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 14, letterSpacing: '0.03em' },
  typeCard: { flex: 1, padding: '10px 14px', borderRadius: 8, cursor: 'pointer', transition: 'border-color 0.12s, background 0.12s' },
  splitBtn: { padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', transition: 'all 0.1s' },
  card: { background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 16, padding: '20px', marginBottom: 12, boxShadow: '0 10px 30px rgba(26,18,18,0.05)' },
  formRow: { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' },
  fieldLabel: { display: 'block', fontSize: 13, color: 'var(--text)', marginBottom: 6, fontWeight: 700 },
  selectInput: { background: '#fff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 13, padding: '7px 10px', outline: 'none', fontFamily: 'inherit', width: '100%' },
  emptyCard: { background: '#FFFFFF', border: '1.5px dashed var(--border)', borderRadius: 10, padding: '24px', color: 'var(--text2)', fontSize: 14, fontWeight: 500, textAlign: 'center', marginBottom: 8 },
  playerTable: { background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
  playerTableHdr: { display: 'flex', alignItems: 'center', padding: '10px 14px', background: '#4A1320', fontSize: 10, fontWeight: 700, color: '#F7CC6A', textTransform: 'uppercase', letterSpacing: '0.06em', gap: 8 },
  playerRow: { display: 'flex', alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--border)', gap: 8 },
  pJersey: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: '#6B1E2E', width: 50, flexShrink: 0 },
  pName: { fontSize: 14, color: 'var(--text)', flex: 1, fontWeight: 500 },
  errorBox: { marginTop: 10, padding: '9px 14px', background: '#FDECEB', border: '1px solid var(--red)', borderRadius: 8, color: '#9B2C2C', fontSize: 13 },
  successBox: { marginTop: 10, padding: '9px 14px', background: '#E8F5EE', border: '1px solid var(--green)', borderRadius: 8, color: '#1A6B4A', fontSize: 13 },
  roleBadge: { display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 20 },
  rankRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
  rankBadge: { width: 28, height: 28, borderRadius: '50%', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
};
