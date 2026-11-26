import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { AuthPage } from './features/auth/AuthPage';
import { AllSubjectsPage } from "./features/subjects/AllSubjectsPage";
import { DashboardPage } from './features/dashboard/DashboardPage';
import { AdminPage } from './features/admin/AdminPage';
import { ExamSetupPage } from './features/exam/ExamSetupPage';
import { ExamEnginePage } from './features/exam/ExamEnginePage';
import { ResultsPage } from './features/analytics/ResultsPage';
import { AnalyticsPage } from './features/analytics/AnalyticsPage';
import { OfflineBanner } from './components/OfflineBanner';
import { isSupabaseConfigured } from './lib/supabase';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-sm shadow-sm">
          <h1 className="font-bold text-slate-900">Supabase Keys Needed</h1>
          <p className="mt-2 text-slate-600">
            Update <code className="rounded bg-slate-100 px-1 py-0.5">.env.local</code> with your
            Supabase Project URL and Publishable key, then restart{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5">npm run dev</code>.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-700" />
        Loading your JAMB portal...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={user ? <DashboardPage /> : <AuthPage />} />
      <Route path="/exam-setup" element={user ? <ExamSetupPage /> : <AuthPage />} />
      <Route path="/exam" element={user ? <ExamEnginePage /> : <AuthPage />} />
      <Route path="/results/:attemptId" element={user ? <ResultsPage /> : <AuthPage />} />
      <Route path="/analytics" element={user ? <AnalyticsPage /> : <AuthPage />} />
      <Route path="/subjects" element={user ? <AllSubjectsPage /> : <AuthPage />} />
      <Route path="/admin" element={user ? <AdminPage /> : <AuthPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <OfflineBanner />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
