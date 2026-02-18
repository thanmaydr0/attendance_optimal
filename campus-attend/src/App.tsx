import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// ── Auth pages ──────────────────────────────────────────────
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// ── Student ─────────────────────────────────────────────────
import StudentLayout from './pages/student/StudentLayout';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentTimetable from './pages/student/TimetablePage';
import StudentEvents from './pages/student/StudentEvents';
import StudentAttendance from './pages/student/AttendancePage';
import StudentRoadmap from './pages/student/StudentRoadmap';
import StudentCheckIn from './pages/student/StudentCheckIn';
import CheckInPage from './pages/student/CheckInPage';

// ── Faculty ─────────────────────────────────────────────────
import FacultyLayout from './pages/faculty/FacultyLayout';
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import FacultySubjects from './pages/faculty/FacultySubjects';
import FacultyAttendance from './pages/faculty/FacultyAttendance';
import FacultyRequests from './pages/faculty/FacultyRequests';

// ── Club Admin ──────────────────────────────────────────────
import ClubLayout from './pages/club/ClubLayout';
import ClubDashboard from './pages/club/ClubDashboard';
import ClubEvents from './pages/club/ClubEvents';
import ClubEventNew from './pages/club/ClubEventNew';
import ClubEventDetail from './pages/club/ClubEventDetail';
import ClubAttendees from './pages/club/ClubAttendees';

// ── Admin ───────────────────────────────────────────────────
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminSemester from './pages/admin/AdminSemester';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public routes ──────────────────────────── */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* ── QR Check-in (public URL, requires auth) ── */}
          <Route
            path="/checkin/:token"
            element={
              <ProtectedRoute>
                <CheckInPage />
              </ProtectedRoute>
            }
          />

          {/* ── Student routes ─────────────────────────── */}
          <Route
            path="/student"
            element={
              <ProtectedRoute role="student">
                <StudentLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="timetable" element={<StudentTimetable />} />
            <Route path="events" element={<StudentEvents />} />
            <Route path="attendance" element={<StudentAttendance />} />
            <Route path="roadmap" element={<StudentRoadmap />} />
            <Route path="check-in/:eventId" element={<StudentCheckIn />} />
          </Route>

          {/* ── Faculty routes ─────────────────────────── */}
          <Route
            path="/faculty"
            element={
              <ProtectedRoute role="faculty">
                <FacultyLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<FacultyDashboard />} />
            <Route path="subjects" element={<FacultySubjects />} />
            <Route path="attendance" element={<FacultyAttendance />} />
            <Route path="requests" element={<FacultyRequests />} />
          </Route>

          {/* ── Club Admin routes ──────────────────────── */}
          <Route
            path="/club"
            element={
              <ProtectedRoute role="club_admin">
                <ClubLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ClubDashboard />} />
            <Route path="events" element={<ClubEvents />} />
            <Route path="events/new" element={<ClubEventNew />} />
            <Route path="events/:id" element={<ClubEventDetail />} />
            <Route path="attendees" element={<ClubAttendees />} />
          </Route>

          {/* ── Admin routes ───────────────────────────── */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="semester" element={<AdminSemester />} />
          </Route>

          {/* ── Catch-all fallback ─────────────────────── */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>

      {/* Toast container — top-center, mobile-friendly */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: { fontSize: '14px', borderRadius: '12px' },
        }}
      />
    </AuthProvider>
  );
}
