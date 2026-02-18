import { useParams } from 'react-router-dom';
import PlaceholderPage from '../../components/PlaceholderPage';

export default function StudentCheckIn() {
    const { eventId } = useParams<{ eventId: string }>();
    return (
        <PlaceholderPage
            title="Event Check-In"
            icon="📱"
            description={`QR scan / geofence check-in for event ${eventId ?? '…'}`}
        />
    );
}
