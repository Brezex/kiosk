import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import KioskPage from './pages/KioskPage';
//import ChatPage from './pages/ChatPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/*" element={<AdminPage />} />
      <Route path="/kiosk" element={<KioskPage />} />
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
      {/*<Route path="/chat" element={<ChatPage />} />*/}
    </Routes>
  );
}