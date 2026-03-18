import { Routes, Route } from 'react-router-dom';
import ContactListView from '../../features/contacts/components/ContactListView/ContactListView';
import ContactDetailDashboard from '../../features/contacts/components/ContactDetailDashboard/ContactDetailDashboard';

export default function ContactsRouter() {
    return (
        <Routes>
            <Route path="/" element={<ContactListView />} />
            <Route path="/:id" element={<ContactDetailDashboard />} />
        </Routes>
    );
}
