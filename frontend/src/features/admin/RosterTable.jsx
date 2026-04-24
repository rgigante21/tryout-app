import { useState, useMemo } from 'react';
import { A } from './styles';

function getBorn(p) {
  if (p.date_of_birth) return new Date(p.date_of_birth + 'T12:00:00').getFullYear();
  return p.birth_year ?? null;
}

const POS_LABELS = { skater: 'Skater', goalie: 'Goalie', defense: 'Defense', forward: 'Forward' };

const filterSelectStyle = {
  height: 32,
  minWidth: 0,
  padding: '0 8px',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--text2)',
  background: '#fff',
  fontFamily: "'Nunito', sans-serif",
  cursor: 'pointer',
  outline: 'none',
  fontWeight: 600,
};

function SortHdr({ field, sortBy, sortDir, onSort, style, children }) {
  const active = sortBy === field;
  return (
    <button
      onClick={() => onSort(field)}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 10,
        fontWeight: 700,
        color: active ? '#F0B429' : '#F7CC6A',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        ...style,
      }}
    >
      {children}
      <span style={{ opacity: active ? 1 : 0.3, fontSize: 9 }}>
        {active && sortDir === 'desc' ? '▼' : '▲'}
      </span>
    </button>
  );
}

export default function RosterTable({ players, onRemovePlayer }) {
  const [sortBy, setSortBy] = useState('jersey');
  const [sortDir, setSortDir] = useState('asc');
  const [filterPosition, setFilterPosition] = useState('');
  const [filterShot, setFilterShot] = useState('');
  const [filterBirthYear, setFilterBirthYear] = useState('');

  const birthYears = useMemo(() => {
    const years = new Set(players.map(getBorn).filter(Boolean));
    return Array.from(years).sort((a, b) => a - b);
  }, [players]);

  function handleSort(field) {
    if (sortBy === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  }

  const displayed = useMemo(() => {
    let list = [...players];
    if (filterPosition) list = list.filter(p => p.position === filterPosition);
    if (filterShot) list = list.filter(p => p.shot === filterShot);
    if (filterBirthYear) list = list.filter(p => getBorn(p) === parseInt(filterBirthYear, 10));

    list.sort((a, b) => {
      let va, vb;
      if (sortBy === 'jersey') {
        va = a.jersey_number ?? 999;
        vb = b.jersey_number ?? 999;
      } else if (sortBy === 'name') {
        va = (a.last_name + a.first_name).toLowerCase();
        vb = (b.last_name + b.first_name).toLowerCase();
      } else if (sortBy === 'born') {
        va = getBorn(a) ?? 9999;
        vb = getBorn(b) ?? 9999;
      } else if (sortBy === 'position') {
        va = a.position ?? '';
        vb = b.position ?? '';
      } else if (sortBy === 'shot') {
        va = a.shot ?? '';
        vb = b.shot ?? '';
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [players, sortBy, sortDir, filterPosition, filterShot, filterBirthYear]);

  const hasFilters = filterPosition || filterShot || filterBirthYear;
  const hdrProps = { sortBy, sortDir, onSort: handleSort };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        <select value={filterPosition} onChange={e => setFilterPosition(e.target.value)} style={filterSelectStyle}>
          <option value="">All positions</option>
          <option value="skater">Skater</option>
          <option value="goalie">Goalie</option>
          <option value="defense">Defense</option>
          <option value="forward">Forward</option>
        </select>
        <select value={filterShot} onChange={e => setFilterShot(e.target.value)} style={filterSelectStyle}>
          <option value="">All shots</option>
          <option value="L">Left</option>
          <option value="R">Right</option>
        </select>
        {birthYears.length > 0 && (
          <select value={filterBirthYear} onChange={e => setFilterBirthYear(e.target.value)} style={filterSelectStyle}>
            <option value="">All years</option>
            {birthYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}
        {hasFilters && (
          <>
            <button
              onClick={() => { setFilterPosition(''); setFilterShot(''); setFilterBirthYear(''); }}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text3)', padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Clear
            </button>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              {displayed.length} of {players.length}
            </span>
          </>
        )}
      </div>

      <div style={A.playerTable}>
        <div style={{ ...A.playerTableHdr, gap: 8 }}>
          <SortHdr field="jersey" {...hdrProps} style={{ width: 50, flexShrink: 0 }}>#</SortHdr>
          <SortHdr field="name" {...hdrProps} style={{ flex: 1 }}>Name</SortHdr>
          <SortHdr field="born" {...hdrProps} style={{ width: 52, justifyContent: 'flex-end' }}>Born</SortHdr>
          <SortHdr field="position" {...hdrProps} style={{ width: 68 }}>Pos</SortHdr>
          <SortHdr field="shot" {...hdrProps} style={{ width: 44 }}>Shot</SortHdr>
          <span style={{ width: 36 }} />
        </div>

        {displayed.length === 0 && (
          <div style={{ padding: '16px 14px', fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>
            No players match the current filters.
          </div>
        )}

        {displayed.map((p) => {
          const born = getBorn(p);
          return (
            <div key={p.id} style={{ ...A.playerRow, gap: 8 }}>
              <span style={A.pJersey}>#{p.jersey_number}</span>
              <span style={A.pName}>{p.first_name} {p.last_name}</span>
              <span style={{ width: 52, textAlign: 'right', fontSize: 12, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {born ?? '—'}
              </span>
              <span style={{ width: 68, fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>
                {POS_LABELS[p.position] ?? '—'}
              </span>
              <span style={{ width: 44, fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>
                {p.shot ?? '—'}
              </span>
              <button
                onClick={() => onRemovePlayer(p.id)}
                style={{ ...A.iconBtn, color: 'var(--red-txt)' }}
                title="Remove"
              >×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
