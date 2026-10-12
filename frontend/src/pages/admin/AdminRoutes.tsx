import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { Permission } from '@karolla/shared';
import { RequireAuth, RequirePermission } from '@/layouts/AdminLayout';
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
const ProfessionalsPage = lazy(() => import('./ProfessionalsPage'));
const InspirationsAdminPage = lazy(() => import('./InspirationsAdminPage'));
const StoriesAdminPage = lazy(() => import('./StoriesAdminPage'));
const TeamPage = lazy(() => import('./TeamPage'));

const guard = (permission: Permission, page: ReactElement) => <RequirePermission permission={permission}>{page}</RequirePermission>;

export default function AdminRoutes() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route index element={guard('dashboard.view', <DashboardPage />)} />
        <Route path="agenda" element={guard('agenda.view', <AgendaPage />)} />
        <Route path="agendamentos" element={guard('agenda.view', <AppointmentsPage />)} />
        <Route path="agendamentos/:id" element={guard('agenda.view', <AppointmentDetailPage />)} />
        <Route path="clientes" element={guard('customers.view', <CustomersPage />)} />
        <Route path="clientes/:id" element={guard('customers.view', <CustomerDetailPage />)} />
        <Route path="pets" element={guard('pets.view', <PetsPage />)} />
        <Route path="pets/:id" element={guard('pets.view', <PetDetailPage />)} />
        <Route path="servicos" element={guard('services.view', <ServicesPage />)} />
        <Route path="precos" element={guard('finance.view', <PricesPage />)} />
        <Route path="adicionais" element={guard('services.view', <AddonsPage />)} />
        <Route path="formulario" element={guard('services.edit', <FormEditorPage />)} />
        <Route path="horarios" element={guard('settings.view', <SchedulePage />)} />
        <Route path="configuracoes" element={guard('settings.view', <SettingsPage />)} />
        <Route path="profissionais" element={guard('professionals.view', <ProfessionalsPage />)} />
        <Route path="inspiracoes" element={guard('inspirations.view', <InspirationsAdminPage />)} />
        <Route path="stories" element={guard('inspirations.view', <StoriesAdminPage />)} />
        <Route path="equipe" element={guard('team.view', <TeamPage />)} />
        <Route path="*" element={guard('dashboard.view', <DashboardPage />)} />
      </Route>
    </Routes>
  );
}
