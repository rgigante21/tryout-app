import RankingsView from '../../admin/views/RankingsView';

export default function ResultsTab({ rankings, ageGroup }) {
  return <RankingsView rankings={rankings} activeGroup={ageGroup} />;
}
