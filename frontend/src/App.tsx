import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Profile from './pages/Profile';
import MedicineWorkspace from './pages/medicine/MedicineWorkspace';
import SubjectOverview from './pages/medicine/SubjectOverview';
import SubjectSearch from './pages/medicine/SubjectSearch';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/medicine" element={<MedicineWorkspace />} />
        <Route path="/medicine/subjects" element={<SubjectSearch />} />
        <Route path="/medicine/subjects/:subjectRef" element={<SubjectOverview />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;