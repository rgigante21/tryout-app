import RosterTable from '../RosterTable';
import { A } from '../styles';

export default function RostersView({ activeEvent, activeGroup, players = [], loading = false }) {
  if (!activeEvent) {
    return <div style={A.emptyCard}>No active event. Create an event first.</div>;
  }

  if (!activeGroup) {
    return (
      <div style={A.emptyCard}>
        Select an age group from the sidebar to view the roster.
      </div>
    );
  }

  if (loading) {
    return <div style={A.emptyCard}>Loading roster…</div>;
  }

  if (players.length === 0) {
    return (
      <div style={A.emptyCard}>
        No players registered for {activeGroup.name}.
      </div>
    );
  }

  return <RosterTable players={players} />;
}
