import { useEffect, useMemo, useState } from 'react';
import RosterTable from '../RosterTable';
import { A } from '../styles';
import { api } from '../../../utils/api';

const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEARS = Array.from({ length: 20 }, (_, i) => CURRENT_YEAR - 5 - i);
const VALID_VARIANTS = new Set(['A', 'B', 'C']);
const POS_LABELS = { skater: 'Skater', goalie: 'Goalie', defense: 'Defense', forward: 'Forward' };
const POS_ORDER = ['goalie', 'defense', 'forward', 'skater', 'unknown'];

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 300,
  background: 'rgba(26,18,18,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16,
};
const cardStyle = {
  background: '#fff', borderRadius: 18, border: '1px solid var(--border)',
  boxShadow: '0 20px 48px rgba(0,0,0,0.18)',
  width: '100%', maxWidth: 440, padding: '28px 28px 24px',
};
const fieldGroupStyle = { marginBottom: 16 };
const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  height: 40, padding: '0 12px',
  border: '1px solid var(--border)', borderRadius: 10,
  fontSize: 14, fontFamily: 'inherit', color: 'var(--text)',
  background: '#fff', outline: 'none',
};
const selectStyle = { ...inputStyle, cursor: 'pointer' };
const modalTitle = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: 22, fontWeight: 700, color: '#4A1320',
  letterSpacing: '0.02em', marginBottom: 20,
};
const footerRow = { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 };

function getSeasonYear(event) {
  const fromDate = event?.start_date || event?.startDate;
  const parsed = fromDate ? new Date(fromDate).getFullYear() : null;
  if (parsed && !Number.isNaN(parsed)) return parsed;
  const seasonMatch = String(event?.season || '').match(/\d{4}/);
  return seasonMatch ? Number(seasonMatch[0]) : CURRENT_YEAR;
}

function getBirthYearRule(activeGroup, activeEvent) {
  if (!activeGroup) return null;
  const maxAge = Number(activeGroup.max_age);
  if (maxAge) {
    const seasonYear = getSeasonYear(activeEvent);
    return {
      min: seasonYear - maxAge,
      max: seasonYear - maxAge + 1,
      label: `${activeGroup.name} accepts birth years ${seasonYear - maxAge}–${seasonYear - maxAge + 1}`,
    };
  }

  const min = Number(activeGroup.birth_year_min);
  const max = Number(activeGroup.birth_year_max);
  if (min && max) {
    return {
      min,
      max,
      label: `${activeGroup.name} accepts birth years ${min}–${max}`,
    };
  }

  return null;
}

function isBirthYearValidForRule(birthYear, rule) {
  if (!birthYear || !rule) return true;
  const year = Number(birthYear);
  return year >= rule.min && year <= rule.max;
}

function getBirthYearOptions(rule) {
  if (!rule) return BIRTH_YEARS;
  return Array.from({ length: rule.max - rule.min + 1 }, (_, i) => rule.min + i).sort((a, b) => b - a);
}

function getBorn(player) {
  if (player.date_of_birth) return parseInt(player.date_of_birth, 10) || null;
  return player.birth_year ?? null;
}

function sortPlayers(players) {
  return [...players].sort((a, b) => {
    const ja = a.jersey_number ?? 999;
    const jb = b.jersey_number ?? 999;
    if (ja !== jb) return ja - jb;
    return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
  });
}

function rosterStats(players) {
  const years = new Set();
  const counts = players.reduce((acc, p) => {
    const pos = p.position || 'unknown';
    acc[pos] = (acc[pos] || 0) + 1;
    const born = getBorn(p);
    if (born) years.add(born);
    return acc;
  }, {});
  return {
    total: players.length,
    goalies: counts.goalie || 0,
    defense: counts.defense || 0,
    forwards: counts.forward || 0,
    skaters: counts.skater || 0,
    years: Array.from(years).sort((a, b) => a - b),
  };
}

function PrototypeSwitcher({ activeVariant, onVariantChange }) {
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 20,
        transform: 'translateX(-50%)',
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: 6,
        borderRadius: 12,
        border: '1px solid rgba(74,19,32,0.22)',
        background: 'rgba(255,255,255,0.96)',
        boxShadow: '0 14px 36px rgba(26,18,18,0.16)',
      }}
    >
      <span style={{ padding: '0 8px', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text3)', textTransform: 'uppercase' }}>
        Prototype
      </span>
      {['A', 'B', 'C'].map((variant) => (
        <button
          key={variant}
          type="button"
          onClick={() => onVariantChange?.(variant)}
          data-testid={`roster-prototype-switch-${variant}`}
          aria-label={`Switch to roster prototype variant ${variant}`}
          style={{
            minWidth: 36,
            height: 34,
            borderRadius: 9,
            border: activeVariant === variant ? '1px solid var(--maroon)' : '1px solid var(--border)',
            background: activeVariant === variant ? 'var(--maroon)' : '#fff',
            color: activeVariant === variant ? '#fff' : 'var(--text2)',
            fontFamily: 'inherit',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {variant}
        </button>
      ))}
    </div>
  );
}

function PrototypeLauncher({ onVariantChange }) {
  if (!onVariantChange) return null;
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text3)', textTransform: 'uppercase' }}>
        Variants
      </span>
      {['A', 'B', 'C'].map((variant) => (
        <button
          key={variant}
          type="button"
          onClick={() => onVariantChange(variant)}
          data-testid={`roster-prototype-launch-${variant}`}
          aria-label={`Open roster prototype variant ${variant}`}
          style={{
            minWidth: 30,
            height: 30,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: '#fff',
            color: 'var(--text2)',
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
          }}
          title={`Open roster prototype variant ${variant}`}
        >
          {variant}
        </button>
      ))}
    </div>
  );
}

function RosterStatStrip({ stats }) {
  const items = [
    ['Players', stats.total],
    ['Goalies', stats.goalies],
    ['Defense', stats.defense],
    ['Forwards', stats.forwards],
    ['Birth years', stats.years.length],
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 14 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 25, fontWeight: 700, color: 'var(--maroon)', lineHeight: 1 }}>{value}</div>
          <div style={{ marginTop: 5, fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function PlayerActionButtons({ player, canEdit, onEdit, onRemove }) {
  if (!canEdit) return null;
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
      {onEdit && <button type="button" style={A.iconBtn} title="Edit" onClick={(e) => { e.stopPropagation(); onEdit(player); }}>✎</button>}
      {onRemove && <button type="button" style={{ ...A.iconBtn, color: 'var(--red-txt)' }} title="Remove / Move" onClick={(e) => { e.stopPropagation(); onRemove(player); }}>×</button>}
    </div>
  );
}

function EmptyRosterPrototype({ activeGroup, canAdd, onAdd }) {
  return (
    <div style={{ ...A.emptyCard, minHeight: 160, display: 'grid', placeItems: 'center' }}>
      <div>
        <div>No players registered for {activeGroup.name}.</div>
        {canAdd && (
          <button type="button" style={{ ...A.primaryBtn, marginTop: 12 }} onClick={onAdd}>
            + Add Player
          </button>
        )}
      </div>
    </div>
  );
}

function DetailModal({ player, activeGroup, birthYearRule, canEdit, onEdit, onRemove, onClose }) {
  const birthYear = getBorn(player);
  const validBirthYear = isBirthYearValidForRule(birthYear, birthYearRule);
  const detailRows = [
    ['Jersey', `#${player.jersey_number}`],
    ['Position', POS_LABELS[player.position] || 'Unassigned'],
    ['Shot', player.shot || '—'],
    ['Birth year', birthYear || '—'],
    ['Age group', activeGroup?.name || '—'],
    ['Registration', player.id],
  ];

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...cardStyle, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 42, lineHeight: 1, fontWeight: 700, color: 'var(--maroon)' }}>
              #{player.jersey_number}
            </div>
            <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
              {player.first_name} {player.last_name}
            </div>
          </div>
          <button type="button" style={A.iconBtn} onClick={onClose} title="Close" aria-label="Close player details">×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 10 }}>
          {detailRows.map(([label, value]) => (
            <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '11px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text3)', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ marginTop: 5, fontSize: 15, color: 'var(--text)', fontWeight: 800 }}>{value}</div>
            </div>
          ))}
        </div>

        {birthYearRule && (
          <div style={{
            marginTop: 14,
            padding: '10px 12px',
            borderRadius: 8,
            border: validBirthYear ? '1px solid var(--border)' : '1px solid var(--red)',
            background: validBirthYear ? 'var(--bg3)' : '#FDECEB',
            color: validBirthYear ? 'var(--text2)' : 'var(--red-txt)',
            fontSize: 13,
            fontWeight: 700,
          }}>
            {birthYear ? (validBirthYear ? birthYearRule.label : `${birthYear} is outside ${birthYearRule.label}.`) : birthYearRule.label}
          </div>
        )}

        {canEdit && (
          <div style={{ ...footerRow, marginTop: 18 }}>
            {onRemove && <button type="button" style={A.ghostBtn} onClick={() => onRemove(player)}>Move / Remove</button>}
            {onEdit && <button type="button" style={A.primaryBtn} onClick={() => onEdit(player)}>Edit Player</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function VariantA({ players, stats, activeGroup, canEdit, canAdd, onAdd, onEdit, onRemove, onSelect }) {
  return (
    <div>
      <RosterStatStrip stats={stats} />
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 74 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
              {activeGroup.name} Roster
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Tryout day roster</div>
          </div>
          {canAdd && <button type="button" style={A.primaryBtn} onClick={onAdd}>+ Add Player</button>}
        </div>
        {players.length === 0 ? (
          <EmptyRosterPrototype activeGroup={activeGroup} canAdd={canAdd} onAdd={onAdd} />
        ) : (
          <RosterTable
            players={players}
            onEditPlayer={canEdit ? onEdit : undefined}
            onRemovePlayer={canEdit ? onRemove : undefined}
            onSelectPlayer={onSelect}
          />
        )}
      </div>
    </div>
  );
}

function VariantB({ players, stats, activeGroup, canEdit, canAdd, onAdd, onEdit, onRemove, onSelect }) {
  const groups = POS_ORDER.map((pos) => ({
    pos,
    label: POS_LABELS[pos] || 'Unassigned',
    players: sortPlayers(players.filter((p) => (p.position || 'unknown') === pos)),
  })).filter((group) => group.players.length || group.pos === 'goalie');

  return (
    <div style={{ marginBottom: 74 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 700, color: 'var(--text)' }}>
            {activeGroup.name} Position Board
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            {stats.total} players across {groups.filter((g) => g.players.length).length} position groups
          </div>
        </div>
        {canAdd && <button type="button" style={A.primaryBtn} onClick={onAdd}>+ Add Player</button>}
      </div>

      {players.length === 0 ? (
        <EmptyRosterPrototype activeGroup={activeGroup} canAdd={canAdd} onAdd={onAdd} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
          {groups.map((group) => (
            <section key={group.pos} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', minHeight: 160 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#4A1320', color: '#fff' }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{group.label}</div>
                <div style={{ fontSize: 12, color: '#F7CC6A', fontWeight: 800 }}>{group.players.length}</div>
              </div>
              {group.players.length === 0 ? (
                <div style={{ padding: 14, color: 'var(--text3)', fontSize: 13 }}>No players assigned.</div>
              ) : group.players.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onSelect(p)}
                  role="button"
                  tabIndex={0}
                  data-testid={`roster-player-card-${p.id}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(p);
                    }
                  }}
                  style={{ display: 'grid', gridTemplateColumns: '54px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: '11px 14px', borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, color: 'var(--maroon)', fontWeight: 700 }}>#{p.jersey_number}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.first_name} {p.last_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {getBorn(p) || 'No birth year'} · Shot {p.shot || '—'}
                    </div>
                  </div>
                  <PlayerActionButtons player={p} canEdit={canEdit} onEdit={onEdit} onRemove={onRemove} />
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function VariantC({ players, stats, activeGroup, canEdit, canAdd, onAdd, onEdit, onRemove, onSelect, birthYearRule }) {
  const sorted = useMemo(() => sortPlayers(players), [players]);
  const [selectedId, setSelectedId] = useState(() => sorted[0]?.id ?? null);
  const selected = sorted.find((p) => p.id === selectedId) || sorted[0] || null;

  return (
    <div style={{ marginBottom: 74 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 14, alignItems: 'start' }}>
        <aside style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: 'var(--text)' }}>
              {activeGroup.name}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text3)' }}>{stats.total} rostered players</div>
            {canAdd && <button type="button" style={{ ...A.primaryBtn, width: '100%', marginTop: 12 }} onClick={onAdd}>+ Add Player</button>}
          </div>

          {sorted.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--text3)' }}>No players registered.</div>
          ) : sorted.map((p) => {
            const selectedRow = selected?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '46px minmax(0, 1fr)',
                  gap: 10,
                  width: '100%',
                  padding: '11px 14px',
                  border: 'none',
                  borderTop: '1px solid var(--border)',
                  background: selectedRow ? '#F5E8EB' : '#fff',
                  color: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: 'var(--maroon)' }}>#{p.jersey_number}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {p.first_name} {p.last_name}
                  </span>
                  <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--text3)' }}>
                    {POS_LABELS[p.position] || 'Unassigned'} · {getBorn(p) || 'No birth year'}
                  </span>
                </span>
              </button>
            );
          })}
        </aside>

        <section style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, minHeight: 360, padding: 18 }}>
          {!selected ? (
            <EmptyRosterPrototype activeGroup={activeGroup} canAdd={canAdd} onAdd={onAdd} />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 48, lineHeight: 1, fontWeight: 700, color: 'var(--maroon)' }}>
                    #{selected.jersey_number}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>
                    {selected.first_name} {selected.last_name}
                  </div>
                </div>
                <PlayerActionButtons player={selected} canEdit={canEdit} onEdit={onEdit} onRemove={onRemove} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 18 }}>
                {[
                  ['Position', POS_LABELS[selected.position] || 'Unassigned'],
                  ['Shot', selected.shot || '—'],
                  ['Birth year', getBorn(selected) || '—'],
                  ['Registration', selected.id],
                ].map(([label, value]) => (
                  <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text3)', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ marginTop: 5, fontSize: 16, color: 'var(--text)', fontWeight: 800 }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ ...A.sectionLabel, marginBottom: 8 }}>Roster Details</div>
                <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
                  Current event registration for {activeGroup.name}.
                </div>
                {birthYearRule && (
                  <div style={{ marginTop: 8, fontSize: 13, color: isBirthYearValidForRule(getBorn(selected), birthYearRule) ? 'var(--text3)' : 'var(--red-txt)', fontWeight: 700 }}>
                    {birthYearRule.label}
                  </div>
                )}
                <button type="button" style={{ ...A.ghostBtn, marginTop: 12 }} onClick={() => onSelect(selected)}>
                  View Details
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function CommandDeskRoster({
  players,
  stats,
  activeEvent,
  activeGroup,
  birthYearRule,
  canEdit,
  canAdd,
  onAdd,
  onEdit,
  onRemove,
  onSelect,
  error,
}) {
  const [query, setQuery] = useState('');
  const [preset, setPreset] = useState('all');
  const [sort, setSort] = useState({ field: 'jersey', dir: 'asc' });
  const [visibleFields, setVisibleFields] = useState({
    jersey: true,
    position: true,
    shot: true,
    year: true,
    ageGroup: true,
    status: true,
    eligibility: true,
  });

  const invalidBirthYears = useMemo(
    () => players.filter((p) => !isBirthYearValidForRule(getBorn(p), birthYearRule)),
    [players, birthYearRule]
  );
  const missingBirthYears = useMemo(() => players.filter((p) => !getBorn(p)), [players]);

  const filteredPlayers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = players.filter((player) => {
      const born = getBorn(player);
      const searchable = [
        player.first_name,
        player.last_name,
        player.jersey_number != null ? `#${player.jersey_number}` : '',
        player.jersey_number,
        player.position,
        player.shot,
        born,
        player.outcome,
      ].filter(Boolean).join(' ').toLowerCase();

      if (needle && !searchable.includes(needle)) return false;
      if (preset === 'goalies' && player.position !== 'goalie') return false;
      if (preset === 'missing_year' && born) return false;
      if (preset === 'invalid_year' && isBirthYearValidForRule(born, birthYearRule)) return false;
      if (preset === 'shortlist' && !player.outcome) return false;
      return true;
    });

    return list.sort((a, b) => {
      let av;
      let bv;
      if (sort.field === 'position') {
        av = POS_LABELS[a.position] || '';
        bv = POS_LABELS[b.position] || '';
      } else if (sort.field === 'status') {
        av = a.outcome || 'Registered';
        bv = b.outcome || 'Registered';
      } else if (sort.field === 'shot') {
        av = a.shot || '';
        bv = b.shot || '';
      } else if (sort.field === 'year') {
        av = getBorn(a) || 9999;
        bv = getBorn(b) || 9999;
      } else if (sort.field === 'ageGroup') {
        av = activeGroup.name || '';
        bv = activeGroup.name || '';
      } else if (sort.field === 'eligibility') {
        av = isBirthYearValidForRule(getBorn(a), birthYearRule) ? 'OK' : 'Review';
        bv = isBirthYearValidForRule(getBorn(b), birthYearRule) ? 'OK' : 'Review';
      } else if (sort.field === 'name') {
        av = `${a.last_name} ${a.first_name}`.toLowerCase();
        bv = `${b.last_name} ${b.first_name}`.toLowerCase();
      } else {
        av = a.jersey_number ?? 999;
        bv = b.jersey_number ?? 999;
      }

      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return (a.jersey_number ?? 999) - (b.jersey_number ?? 999);
    });
  }, [players, query, preset, birthYearRule, sort, activeGroup.name]);

  const fieldDefs = [
    ['jersey', '#'],
    ['position', 'Pos'],
    ['status', 'Status'],
    ['shot', 'Shot'],
    ['year', 'Year'],
    ['ageGroup', 'Age Group'],
    ['eligibility', 'Eligibility'],
  ];

  const presets = [
    ['all', 'All Players'],
    ['goalies', 'Goalies'],
    ['missing_year', 'Missing Year'],
    ['invalid_year', 'Needs Review'],
    ['shortlist', 'Shortlist'],
  ];

  const toggleField = (field) => {
    setVisibleFields((current) => ({ ...current, [field]: !current[field] }));
  };

  const resetFields = () => {
    setVisibleFields({
      jersey: true,
      position: true,
      shot: true,
      year: true,
      ageGroup: true,
      status: true,
      eligibility: true,
    });
  };

  const setSortOrder = (field, dir) => {
    setSort({ field, dir });
  };

  const SortButtons = ({ field }) => (
    <span style={{ display: 'inline-flex', gap: 2, marginLeft: 5, verticalAlign: 'middle' }}>
      {['asc', 'desc'].map((dir) => {
        const active = sort.field === field && sort.dir === dir;
        return (
          <button
            key={dir}
            type="button"
            onClick={(e) => { e.stopPropagation(); setSortOrder(field, dir); }}
            aria-label={`Sort ${field} ${dir === 'asc' ? 'ascending' : 'descending'}`}
            title={dir === 'asc' ? 'Ascending' : 'Descending'}
            style={{
              width: 18,
              height: 18,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 5,
              border: `1px solid ${active ? activeChipBorder : line}`,
              background: active ? activeChipBg : surface,
              color: active ? accent : muted,
              fontSize: 9,
              lineHeight: 1,
              padding: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 900,
            }}
          >
            {dir === 'asc' ? '▲' : '▼'}
          </button>
        );
      })}
    </span>
  );

  const surface = '#FFFFFF';
  const panel = '#FFFFFF';
  const line = 'var(--border)';
  const muted = 'var(--text3)';
  const text = 'var(--text)';
  const accent = 'var(--maroon)';
  const activeChipBg = '#F5E8EB';
  const activeChipBorder = '#D4A0AC';
  const chipBase = {
    border: `1px solid ${line}`,
    background: surface,
    color: muted,
    borderRadius: 20,
    minHeight: 36,
    padding: '0 14px',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  };
  const visibleFieldCount = fieldDefs.filter(([field]) => visibleFields[field]).length;
  const rosterGridColumns = `minmax(180px, 2fr) repeat(${visibleFieldCount}, minmax(92px, 1fr)) ${canEdit ? '86px' : ''}`;

  return (
    <div style={{ background: surface, border: `1px solid ${line}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 10px 30px rgba(26,18,18,0.05)', marginBottom: 18 }}>
      <div style={{ padding: 16, borderBottom: `1px solid ${line}` }}>
        <div style={{ fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>Quick Presets</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) auto', gap: 12, marginBottom: 12, alignItems: 'center' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search player, jersey, note, or tag"
            style={{ height: 44, minWidth: 0, borderRadius: 10, border: `1px solid ${line}`, background: '#fff', color: 'var(--text)', padding: '0 16px', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, outline: 'none' }}
          />
          {canAdd && (
            <button type="button" style={{ ...A.primaryBtn, minHeight: 44, whiteSpace: 'nowrap' }} onClick={onAdd}>
              + Add Player
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {presets.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPreset(id)}
              style={{
                ...chipBase,
                background: preset === id ? activeChipBg : surface,
                borderColor: preset === id ? activeChipBorder : line,
                color: preset === id ? accent : muted,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <section style={{ border: `1px solid ${line}`, borderRadius: 16, background: panel, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, padding: '18px 22px', borderBottom: `1px solid ${line}` }}>
            <div>
              <div style={{ color: text, fontSize: 22, fontWeight: 900 }}>Table-first command desk</div>
              <div style={{ marginTop: 6, color: muted, fontSize: 14 }}>
                Scan rows, sort hard, and open any player box for details.
              </div>
            </div>
            <div style={{ color: muted, border: `1px solid ${line}`, borderRadius: 18, padding: '7px 12px', fontWeight: 900, fontSize: 12, whiteSpace: 'nowrap' }}>
              {filteredPlayers.length} showing
            </div>
          </div>

          <div style={{ padding: '18px 22px', borderBottom: `1px solid ${line}` }}>
            <div style={{ fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>Visible Table Fields</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {fieldDefs.map(([field, label]) => (
                <button
                  key={field}
                  type="button"
                  onClick={() => toggleField(field)}
                  style={{
                    ...chipBase,
                background: visibleFields[field] ? activeChipBg : surface,
                borderColor: visibleFields[field] ? activeChipBorder : line,
                color: visibleFields[field] ? accent : muted,
                  }}
                >
                  {label}
                </button>
              ))}
              <button type="button" style={chipBase} onClick={resetFields}>Reset</button>
            </div>
          </div>

          {error && <div style={{ margin: 16, ...A.errorBox }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 22px', borderBottom: `1px solid ${line}`, color: muted, fontSize: 12, fontWeight: 700 }}>
            <span>{birthYearRule?.label || 'No birth-year rule configured.'}</span>
            <span>{missingBirthYears.length} missing birth year · {invalidBirthYears.length} need review</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 760 }}>
              <div style={{ display: 'grid', gridTemplateColumns: rosterGridColumns, alignItems: 'center' }}>
                <div style={{ padding: '14px 22px', color: muted, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 900 }}>Player <SortButtons field="name" /></div>
                {visibleFields.jersey && <div style={{ padding: '14px 12px', color: muted, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 900 }}># <SortButtons field="jersey" /></div>}
                {visibleFields.position && <div style={{ padding: '14px 12px', color: muted, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 900 }}>Pos <SortButtons field="position" /></div>}
                {visibleFields.status && <div style={{ padding: '14px 12px', color: muted, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 900 }}>Status <SortButtons field="status" /></div>}
                {visibleFields.shot && <div style={{ padding: '14px 12px', color: muted, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 900 }}>Shot <SortButtons field="shot" /></div>}
                {visibleFields.year && <div style={{ padding: '14px 12px', color: muted, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 900 }}>Year <SortButtons field="year" /></div>}
                {visibleFields.ageGroup && <div style={{ padding: '14px 12px', color: muted, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 900 }}>Age Group <SortButtons field="ageGroup" /></div>}
                {visibleFields.eligibility && <div style={{ padding: '14px 12px', color: muted, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 900 }}>Eligibility <SortButtons field="eligibility" /></div>}
                {canEdit && <div />}
              </div>

              {filteredPlayers.length === 0 ? (
                <div style={{ padding: '24px 22px', color: muted, borderTop: `1px solid ${line}` }}>
                  No players match the current roster filters.
                </div>
              ) : filteredPlayers.map((player) => {
                const born = getBorn(player);
                const valid = isBirthYearValidForRule(born, birthYearRule);
                const cellStyle = { padding: '14px 12px', color: muted, minWidth: 0 };
                return (
                  <div
                    key={player.id}
                    onClick={() => onSelect(player)}
                    role="button"
                    tabIndex={0}
                    data-testid={`current-roster-player-${player.id}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(player);
                      }
                    }}
                    style={{ display: 'grid', gridTemplateColumns: rosterGridColumns, alignItems: 'center', borderTop: `1px solid ${line}`, cursor: 'pointer' }}
                  >
                    <div style={{ padding: '14px 22px', color: text, fontWeight: 900, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {player.first_name} {player.last_name}
                    </div>
                    {visibleFields.jersey && <div style={{ ...cellStyle, color: text, fontWeight: 900 }}>#{player.jersey_number}</div>}
                    {visibleFields.position && <div style={cellStyle}>{POS_LABELS[player.position] || '—'}</div>}
                    {visibleFields.status && <div style={cellStyle}>{player.outcome || 'Registered'}</div>}
                    {visibleFields.shot && <div style={cellStyle}>{player.shot || '—'}</div>}
                    {visibleFields.year && <div style={{ ...cellStyle, color: valid ? muted : 'var(--red-txt)', fontWeight: valid ? 700 : 900 }}>{born || '—'}</div>}
                    {visibleFields.ageGroup && <div style={cellStyle}>{activeGroup.name}</div>}
                    {visibleFields.eligibility && (
                      <div style={{ ...cellStyle, color: valid ? 'var(--green)' : 'var(--red-txt)', fontWeight: 900 }}>
                        {valid ? 'OK' : 'Review'}
                      </div>
                    )}
                    {canEdit && (
                      <div style={{ padding: '14px 16px' }}>
                        <PlayerActionButtons player={player} canEdit={canEdit} onEdit={onEdit} onRemove={onRemove} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function teamNameForIndex(activeGroup, index) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return `${activeGroup?.name || 'Roster'} Team ${letters[index] || index + 1}`;
}

function makeTeamSplit(players, targetTeamSize, names = [], activeGroup = null) {
  const skaters = sortPlayers(players.filter((p) => p.will_tryout !== false && p.position !== 'goalie'));
  const safeSize = Math.max(1, Math.min(skaters.length || 1, Number(targetTeamSize) || 1));
  const teams = [];
  for (let start = 0; start < skaters.length; start += safeSize) {
    const index = teams.length;
    teams.push({
      name: names[index] || teamNameForIndex(activeGroup, index),
      players: skaters.slice(start, start + safeSize),
    });
  }
  return teams.length ? teams : [{ name: names[0] || teamNameForIndex(activeGroup, 0), players: [] }];
}

function moveDraggedPlayer(teams, dragged, targetTeamIndex, targetPlayerId = null) {
  if (!dragged || targetTeamIndex == null) return teams;
  const movingPlayer = teams[dragged.teamIndex]?.players?.find((p) => p.id === dragged.playerId);
  if (!movingPlayer) return teams;

  const next = teams.map((team) => ({
    ...team,
    players: team.players.filter((p) => p.id !== dragged.playerId),
  }));
  const targetPlayers = [...next[targetTeamIndex].players];
  const insertAt = targetPlayerId
    ? Math.max(0, targetPlayers.findIndex((p) => p.id === targetPlayerId))
    : targetPlayers.length;
  targetPlayers.splice(insertAt === -1 ? targetPlayers.length : insertAt, 0, movingPlayer);
  next[targetTeamIndex] = { ...next[targetTeamIndex], players: targetPlayers };
  return next;
}

function RosterBuilder({ activeEvent, activeGroup, players, canEdit }) {
  const eligibleSkaters = useMemo(
    () => sortPlayers(players.filter((p) => p.will_tryout !== false && p.position !== 'goalie')),
    [players]
  );
  const defaultTeamSize = Math.max(1, Math.min(12, eligibleSkaters.length || 12));
  const [teamSize, setTeamSize] = useState(() => defaultTeamSize);
  const [teams, setTeams] = useState(() => makeTeamSplit(players, defaultTeamSize, [], activeGroup));
  const [saved, setSaved] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [dragged, setDragged] = useState(null);

  useEffect(() => {
    if (!activeEvent?.id || !activeGroup?.id) return;
    let ignore = false;
    setLoadingPlan(true);
    setMessage(null);
    api.rosterPlan(activeEvent.id, activeGroup.id)
      .then((data) => {
        if (ignore) return;
        const savedTeams = data.teams || [];
        if (savedTeams.length >= 2) {
          const normalized = savedTeams.map((team, index) => ({
            name: team.name || teamNameForIndex(activeGroup, index),
            players: team.players || [],
          }));
          setTeams(normalized);
          setTeamSize(Math.max(1, normalized[0]?.players.length || defaultTeamSize));
          setSaved(true);
        } else {
          const split = makeTeamSplit(players, defaultTeamSize, [], activeGroup);
          setTeams(split);
          setTeamSize(defaultTeamSize);
          setSaved(false);
        }
      })
      .catch((err) => {
        if (!ignore) setMessage({ type: 'error', text: err.message || 'Could not load saved roster.' });
      })
      .finally(() => {
        if (!ignore) setLoadingPlan(false);
      });
    return () => { ignore = true; };
  }, [activeEvent?.id, activeGroup?.id, players, eligibleSkaters.length, defaultTeamSize]);

  const applyTeamSize = (value) => {
    const nextSize = Math.max(1, Math.min(eligibleSkaters.length, Number(value) || 1));
    setTeamSize(nextSize);
    setTeams(makeTeamSplit(players, nextSize, teams.map((team) => team.name), activeGroup));
    setSaved(false);
  };

  const renameTeam = (teamIndex, name) => {
    setTeams((current) => current.map((team, index) => (index === teamIndex ? { ...team, name } : team)));
    setSaved(false);
  };

  const onDropPlayer = (teamIndex, targetPlayerId = null) => {
    setTeams((current) => moveDraggedPlayer(current, dragged, teamIndex, targetPlayerId));
    setDragged(null);
    setSaved(false);
  };

  const saveRoster = async () => {
    if (!canEdit || !activeEvent?.id || !activeGroup?.id) return false;
    setBusy(true);
    setMessage(null);
    try {
      await api.saveRosterPlan({
        eventId: activeEvent.id,
        ageGroupId: activeGroup.id,
        teams: teams.map((team) => ({
          name: team.name,
          playerIds: team.players.map((player) => player.id),
        })),
      });
      setSaved(true);
      setMessage({ type: 'ok', text: 'Roster saved.' });
      return true;
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Roster save failed.' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createExport = async () => {
    if (!canEdit || !activeEvent?.id || !activeGroup?.id) return;
    setBusy(true);
    setMessage(null);
    try {
      if (!saved) {
        const ok = await api.saveRosterPlan({
          eventId: activeEvent.id,
          ageGroupId: activeGroup.id,
          teams: teams.map((team) => ({
            name: team.name,
            playerIds: team.players.map((player) => player.id),
          })),
        });
        if (!ok) return;
        setSaved(true);
      }
      const result = await api.createRosterExport(activeEvent.id, activeGroup.id);
      setMessage({ type: 'ok', text: `Export created in ${result.export.folder_name}.` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Export failed.' });
    } finally {
      setBusy(false);
    }
  };

  if (!eligibleSkaters.length) return null;

  return (
    <section style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 18, overflow: 'hidden' }}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700, color: 'var(--text)' }}>
            Team Divider
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
            {eligibleSkaters.length} skaters tried out. Set a target team size, then drag cards to rebalance.
          </div>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" style={A.ghostBtn} onClick={saveRoster} disabled={busy || loadingPlan}>
              {busy ? 'Saving...' : saved ? 'Saved' : 'Save Roster'}
            </button>
            <button type="button" style={A.primaryBtn} onClick={createExport} disabled={busy || loadingPlan}>
              Create Export
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) auto minmax(150px, 1fr)', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--maroon)' }}>
            Target {teamSize} per team
          </div>
          <input
            type="range"
            min={1}
            max={eligibleSkaters.length}
            value={teamSize}
            disabled={!canEdit}
            onInput={(e) => applyTeamSize(e.currentTarget.value)}
            onChange={(e) => applyTeamSize(e.target.value)}
            aria-label="Target skaters per team"
            style={{ width: 'min(360px, 42vw)', accentColor: 'var(--maroon)' }}
          />
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--maroon)', textAlign: 'right' }}>
            {teams.length} teams · bottom {teams[teams.length - 1]?.players.length || 0}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {teams.map((team, index) => (
            <div
              key={`${team.name}-${index}`}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 20,
                padding: '5px 10px',
                fontSize: 12,
                fontWeight: 800,
                color: index === 0 ? 'var(--maroon)' : 'var(--text2)',
                background: index === 0 ? 'var(--gold-bg)' : '#fff',
              }}
            >
              {team.name}: {team.players.length}
            </div>
          ))}
        </div>
      </div>

      {message && (
        <div style={{ margin: 16, ...(message.type === 'error' ? A.errorBox : A.successBox) }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14, padding: 16 }}>
        {teams.map((team, teamIndex) => (
          <div
            key={teamIndex}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDropPlayer(teamIndex)}
            style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', minHeight: 240, background: 'var(--bg2)' }}
          >
            <div style={{ padding: 12, background: teamIndex === 0 ? '#4A1320' : '#2F3437', color: '#fff' }}>
              <input
                value={team.name}
                disabled={!canEdit}
                onChange={(e) => renameTeam(teamIndex, e.target.value)}
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  color: '#fff',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 24,
                  fontWeight: 700,
                  outline: 'none',
                }}
              />
              <div style={{ fontSize: 11, fontWeight: 800, color: '#F7CC6A', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {team.players.length} skaters
              </div>
            </div>
            <div style={{ padding: 10, display: 'grid', gap: 8 }}>
              {team.players.length === 0 && (
                <div style={{ padding: 18, color: 'var(--text3)', fontSize: 13 }}>Drop skaters here.</div>
              )}
              {team.players.map((player) => (
                <div
                  key={player.id}
                  draggable={canEdit}
                  onDragStart={() => setDragged({ teamIndex, playerId: player.id })}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.stopPropagation(); onDropPlayer(teamIndex, player.id); }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '54px minmax(0, 1fr)',
                    gap: 10,
                    alignItems: 'center',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: '#fff',
                    padding: '10px 12px',
                    cursor: canEdit ? 'grab' : 'default',
                  }}
                >
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: 'var(--maroon)' }}>#{player.jersey_number}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {player.first_name} {player.last_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {POS_LABELS[player.position] || 'Skater'} · {player.outcome || 'Registered'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlayerModal({ player, activeEvent, activeGroup, onSave, onClose, saving }) {
  const isEdit = !!player;
  const birthYearRule = getBirthYearRule(activeGroup, activeEvent);
  const birthYearOptions = getBirthYearOptions(birthYearRule);
  const [form, setForm] = useState({
    firstName:    player?.first_name   ?? '',
    lastName:     player?.last_name    ?? '',
    jerseyNumber: player?.jersey_number != null ? String(player.jersey_number) : '',
    position:     player?.position     ?? '',
    shot:         player?.shot         ?? '',
    birthYear:    player?.birth_year   ?? (player?.date_of_birth ? (parseInt(player.date_of_birth, 10) || '') : ''),
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.jerseyNumber) return;
    if (!isBirthYearValidForRule(form.birthYear, birthYearRule)) return;
    onSave({
      firstName:    form.firstName.trim(),
      lastName:     form.lastName.trim(),
      jerseyNumber: Number(form.jerseyNumber),
      position:     form.position || null,
      shot:         form.shot || null,
      birthYear:    form.birthYear ? Number(form.birthYear) : null,
    });
  }

  const birthYearInvalid = !isBirthYearValidForRule(form.birthYear, birthYearRule);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={e => e.stopPropagation()}>
        <div style={modalTitle}>{isEdit ? 'Edit Player' : 'Add Player'}</div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ ...fieldGroupStyle, flex: 1 }}>
              <label style={A.fieldLabel}>First Name</label>
              <input
                style={inputStyle}
                value={form.firstName}
                onChange={e => set('firstName', e.target.value)}
                required
                autoFocus
              />
            </div>
            <div style={{ ...fieldGroupStyle, flex: 1 }}>
              <label style={A.fieldLabel}>Last Name</label>
              <input
                style={inputStyle}
                value={form.lastName}
                onChange={e => set('lastName', e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ ...fieldGroupStyle, width: 100, flexShrink: 0 }}>
              <label style={A.fieldLabel}>Jersey #</label>
              <input
                style={inputStyle}
                type="number"
                min={1}
                max={99}
                value={form.jerseyNumber}
                onChange={e => set('jerseyNumber', e.target.value)}
                required
              />
            </div>
            <div style={{ ...fieldGroupStyle, flex: 1 }}>
              <label style={A.fieldLabel}>Position</label>
              <select style={selectStyle} value={form.position} onChange={e => set('position', e.target.value)}>
                <option value="">— Select —</option>
                <option value="skater">Skater</option>
                <option value="goalie">Goalie</option>
                <option value="defense">Defense</option>
                <option value="forward">Forward</option>
              </select>
            </div>
            <div style={{ ...fieldGroupStyle, width: 90, flexShrink: 0 }}>
              <label style={A.fieldLabel}>Shot</label>
              <select style={selectStyle} value={form.shot} onChange={e => set('shot', e.target.value)}>
                <option value="">—</option>
                <option value="L">Left</option>
                <option value="R">Right</option>
              </select>
            </div>
          </div>

          <div style={{ ...fieldGroupStyle, maxWidth: 160 }}>
            <label style={A.fieldLabel}>Birth Year</label>
            <select style={selectStyle} value={form.birthYear} onChange={e => set('birthYear', e.target.value)}>
              <option value="">— Select —</option>
              {birthYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {birthYearRule && (
              <div style={{ marginTop: 6, fontSize: 12, color: birthYearInvalid ? 'var(--red-txt)' : 'var(--text3)', lineHeight: 1.4 }}>
                {birthYearRule.label}
              </div>
            )}
          </div>

          <div style={footerRow}>
            <button type="button" style={A.ghostBtn} onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" style={A.primaryBtn} disabled={saving || birthYearInvalid}>
              {saving ? 'Saving…' : isEdit ? 'Update Player' : 'Add Player'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RemoveMoveDialog({ player, ageGroups, onRemove, onMove, onClose, saving }) {
  const [targetGroupId, setTargetGroupId] = useState('');

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...cardStyle, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div style={modalTitle}>
          {player.first_name} {player.last_name} #{player.jersey_number}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ ...A.sectionLabel, marginBottom: 8 }}>Move to another age group</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select
              style={{ ...selectStyle, flex: 1 }}
              value={targetGroupId}
              onChange={e => setTargetGroupId(e.target.value)}
            >
              <option value="">Select age group…</option>
              {ageGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button
              style={A.primaryBtn}
              onClick={() => targetGroupId && onMove(targetGroupId)}
              disabled={!targetGroupId || saving}
            >
              Move
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
            Removes from current sessions and auto-assigns to the new group.
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
          <div style={{ ...A.sectionLabel, marginBottom: 8, color: 'var(--red-txt)' }}>Remove from roster</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
            Removes this player from the current age group and all its sessions. Scores will be deleted.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={A.ghostBtn} onClick={onClose} disabled={saving}>Cancel</button>
            <button
              style={{ ...A.primaryBtn, background: 'var(--red)', border: '1px solid var(--red)', boxShadow: 'none' }}
              onClick={onRemove}
              disabled={saving}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RostersView({
  activeEvent,
  activeGroup,
  players = [],
  loading = false,
  ageGroups = [],
  onSelectAgeGroup,
  onAddPlayer,
  onEditPlayer,
  onRemovePlayer,
  onMovePlayer,
  isAdmin = false,
  variant = null,
  onVariantChange,
}) {
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [removingPlayer, setRemovingPlayer] = useState(null);
  const [detailPlayer, setDetailPlayer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const otherGroups = ageGroups.filter(g => g.id !== activeGroup?.id);
  const activeVariant = VALID_VARIANTS.has(variant) ? variant : null;
  const canAdd = isAdmin && Boolean(onAddPlayer);
  const canEdit = isAdmin && Boolean(onEditPlayer || onRemovePlayer);
  const stats = useMemo(() => rosterStats(players), [players]);
  const birthYearRule = useMemo(() => getBirthYearRule(activeGroup, activeEvent), [activeGroup, activeEvent]);

  async function handleSave(data) {
    setError(null);
    setSaving(true);
    try {
      if (editingPlayer) {
        await onEditPlayer(editingPlayer.id, data);
        setEditingPlayer(null);
      } else {
        await onAddPlayer(data);
        setAddingPlayer(false);
      }
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setSaving(true);
    try {
      await onRemovePlayer(removingPlayer.id);
      setRemovingPlayer(null);
    } catch (err) {
      setError(err.message || 'Remove failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleMove(targetGroupId) {
    setError(null);
    setSaving(true);
    try {
      await onMovePlayer(removingPlayer.id, targetGroupId);
      setRemovingPlayer(null);
    } catch (err) {
      setError(err.message || 'Move failed');
    } finally {
      setSaving(false);
    }
  }

  if (!activeEvent) {
    return <div style={A.emptyCard}>No active event. Create an event first.</div>;
  }

  if (!activeGroup) {
    if (!ageGroups.length) {
      return (
        <div style={A.emptyCard}>
          No age groups are set up yet. Create age groups before managing rosters.
        </div>
      );
    }

    return (
      <div style={A.emptyCard}>
        <div style={{ marginBottom: 12 }}>Select an age group to view its roster.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {ageGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              style={A.primaryBtn}
              onClick={() => onSelectAgeGroup?.(group)}
            >
              {group.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={A.emptyCard}>Loading roster…</div>;
  }

  const openAddModal = () => { setError(null); setAddingPlayer(true); };
  const renderDefaultRoster = () => (
    <CommandDeskRoster
      players={players}
      stats={stats}
      activeEvent={activeEvent}
      activeGroup={activeGroup}
      birthYearRule={birthYearRule}
      canEdit={canEdit}
      canAdd={canAdd}
      onAdd={openAddModal}
      onEdit={setEditingPlayer}
      onRemove={setRemovingPlayer}
      onSelect={setDetailPlayer}
      error={error}
    />
  );

  const renderPrototypeRoster = () => {
    const props = {
      players,
      stats,
      activeGroup,
      canEdit,
      canAdd,
      birthYearRule,
      onAdd: openAddModal,
      onEdit: setEditingPlayer,
      onRemove: setRemovingPlayer,
      onSelect: setDetailPlayer,
    };
    if (activeVariant === 'B') return <VariantB {...props} />;
    if (activeVariant === 'C') return <VariantC {...props} />;
    return <VariantA {...props} />;
  };

  return (
    <>
      {(addingPlayer || editingPlayer) && (
        <PlayerModal
          player={editingPlayer}
          activeEvent={activeEvent}
          activeGroup={activeGroup}
          onSave={handleSave}
          onClose={() => { setEditingPlayer(null); setAddingPlayer(false); setError(null); }}
          saving={saving}
        />
      )}

      {removingPlayer && (
        <RemoveMoveDialog
          player={removingPlayer}
          ageGroups={otherGroups}
          onRemove={handleRemove}
          onMove={handleMove}
          onClose={() => { setRemovingPlayer(null); setError(null); }}
          saving={saving}
        />
      )}

      {detailPlayer && (
        <DetailModal
          player={detailPlayer}
          activeGroup={activeGroup}
          birthYearRule={birthYearRule}
          canEdit={canEdit}
          onEdit={onEditPlayer ? (player) => { setDetailPlayer(null); setEditingPlayer(player); } : undefined}
          onRemove={onRemovePlayer ? (player) => { setDetailPlayer(null); setRemovingPlayer(player); } : undefined}
          onClose={() => setDetailPlayer(null)}
        />
      )}

      {activeVariant ? (
        <>
          {error && <div style={{ ...A.errorBox, marginTop: 0, marginBottom: 12 }}>{error}</div>}
          <RosterBuilder activeEvent={activeEvent} activeGroup={activeGroup} players={players} canEdit={isAdmin} />
          {renderPrototypeRoster()}
          <PrototypeSwitcher activeVariant={activeVariant} onVariantChange={onVariantChange} />
        </>
      ) : (
        <>
          <RosterBuilder activeEvent={activeEvent} activeGroup={activeGroup} players={players} canEdit={isAdmin} />
          {renderDefaultRoster()}
        </>
      )}
    </>
  );
}
