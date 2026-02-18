import { useParams } from 'react-router-dom';
import PlaceholderPage from '../../components/PlaceholderPage';

export default function ClubEventDetail() {
    const { id } = useParams<{ id: string }>();
    return <PlaceholderPage title="Event Details" icon="📋" description={`Manage event ${id ?? '…'}`} />;
}
