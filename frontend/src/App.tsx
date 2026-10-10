import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { CatalogProvider } from '@/context/CatalogContext';
import { BookingProvider } from '@/context/BookingContext';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Feedback';
import { PublicLayout } from '@/layouts/PublicLayout';
import HomePage from '@/pages/HomePage';
import { TrackingManager } from '@/components/tracking/TrackingManager';

// Agendamento e painel carregados sob demanda (lazy loading) — a home abre mais rápido.
const BookingPage = lazy(() => import('@/pages/BookingPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const InspirationsPage = lazy(() => import('@/pages/InspirationsPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const AdminRoutes = lazy(() => import('@/pages/admin/AdminRoutes'));

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <CatalogProvider>
          <Suspense fallback={<Spinner className="min-h-dvh" />}>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route index element={<HomePage />} />
                <Route path="inspiracoes" element={<InspirationsPage />} />
                <Route path="privacidade" element={<PrivacyPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
              <Route
                path="/agendar"
                element={
                  <BookingProvider>
                    <BookingPage />
                  </BookingProvider>
                }
              />
              <Route
                path="/admin/*"
                element={
                  <AuthProvider>
                    <AdminRoutes />
                  </AuthProvider>
                }
              />
            </Routes>
          </Suspense>
          <TrackingManager />
        </CatalogProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
