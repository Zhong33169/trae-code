import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import InvitationList from '@/pages/InvitationList';
import InvitationDetail from '@/pages/InvitationDetail';
import Audit from '@/pages/Audit';

const App = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/invitations" element={<InvitationList />} />
        <Route path="/invitations/:id" element={<InvitationDetail />} />
        <Route path="/audit" element={<Audit />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
