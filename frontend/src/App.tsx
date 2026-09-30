import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { NotFoundPage } from './components/NotFoundPage';
import { LoginPage } from './features/auth/LoginPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { useSessionBootstrap } from './features/auth/useSessionBootstrap';
import { CreateInvoicePage } from './features/invoices/CreateInvoicePage';
import { InvoiceDetailPage } from './features/invoices/InvoiceDetailPage';
import { InvoiceListPage } from './features/invoices/InvoiceListPage';

/** Route map. Everything except /login sits behind <RequireAuth>. */
export function AppRoutes() {
  useSessionBootstrap();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/invoices" replace />} />
        <Route path="/invoices" element={<InvoiceListPage />} />
        <Route path="/invoices/new" element={<CreateInvoicePage />} />
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
