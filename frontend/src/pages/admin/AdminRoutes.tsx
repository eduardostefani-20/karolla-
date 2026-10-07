import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from '@/layouts/AdminLayout';
import LoginPage from './LoginPage';

const DashboardPage = lazy(() => import('./DashboardPage'));
const AgendaPage = lazy(() => import('./AgendaPage'));
const AppointmentsPage = lazy(() => import('./AppointmentsPage'));
const AppointmentDetailPage = lazy(() => import('./AppointmentDetailPage'));
const CustomersPage = lazy(() => import('./CustomersPage'));
const CustomerDetailPage = lazy(() => import('./CustomerDetailPage'));
const PetsPage = lazy(() => import('./PetsPage'));
const PetDetailPage = lazy(() => import('./PetDetailPage'));
const ServicesPage = lazy(() => import('./ServicesPage'));
const PricesPage = lazy(() => import('./PricesPage'));
const AddonsPage = lazy(() => import('./AddonsPage'));
const FormEditorPage = lazy(() => import('./FormEditorPage'));
const SchedulePage = lazy(() => import('./SchedulePage'));
const SettingsPage = lazy(() => import('./SettingsPage'));

export default function AdminRoutes() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route index element={<DashboardPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="agendamentos" element={<AppointmentsPage />} />
        <Route path="agendamentos/:id" element={<AppointmentDetailPage />} />
        <Route path="clientes" element={<CustomersPage />} />
        <Route path="clientes/:id" element={<CustomerDetailPage />} />
        <Route path="pets" element={<PetsPage />} />
        <Route path="pets/:id" element={<PetDetailPage />} />
        <Route path="servicos" element={<ServicesPage />} />
        <Route path="precos" element={<PricesPage />} />
        <Route path="adicionais" element={<AddonsPage />} />
        <Route path="formulario" element={<FormEditorPage />} />
        <Route path="horarios" element={<SchedulePage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
        <Route path="*" element={<DashboardPage />} />
      </Route>
    </Routes>
  );
}
