import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WalletProvider } from './components/WalletProvider';
import { ToastProvider } from './components/Toast';
import { Layout } from './components/Layout';

const Landing = lazy(() => import('./pages/Landing').then((module) => ({ default: module.Landing })));
const Connect = lazy(() => import('./pages/Connect').then((module) => ({ default: module.Connect })));
const Onboard = lazy(() => import('./pages/Onboard').then((module) => ({ default: module.Onboard })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const TestSend = lazy(() => import('./pages/TestSend').then((module) => ({ default: module.TestSend })));
const Receipt = lazy(() => import('./pages/Receipt').then((module) => ({ default: module.Receipt })));
const MarketDirectory = lazy(() => import('./pages/MarketDirectory').then((module) => ({ default: module.MarketDirectory })));
const CustomerHome = lazy(() => import('./pages/customer/CustomerHome').then((module) => ({ default: module.CustomerHome })));
const CustomerScan = lazy(() => import('./pages/customer/CustomerScan').then((module) => ({ default: module.CustomerScan })));
const CustomerHistory = lazy(() => import('./pages/customer/CustomerHistory').then((module) => ({ default: module.CustomerHistory })));
const CustomerUtang = lazy(() => import('./pages/customer/CustomerUtang').then((module) => ({ default: module.CustomerUtang })));
const CustomerProfile = lazy(() => import('./pages/customer/CustomerProfile').then((module) => ({ default: module.CustomerProfile })));
const CustomerCashin = lazy(() => import('./pages/customer/CustomerCashin').then((module) => ({ default: module.CustomerCashin })));
const CustomerCashout = lazy(() => import('./pages/customer/CustomerCashout').then((module) => ({ default: module.CustomerCashout })));
const VendorApply = lazy(() => import('./pages/vendor/VendorApply').then((module) => ({ default: module.VendorApply })));
const VendorHome = lazy(() => import('./pages/vendor/VendorHome').then((module) => ({ default: module.VendorHome })));
const VendorQR = lazy(() => import('./pages/vendor/VendorQR').then((module) => ({ default: module.VendorQR })));
const VendorTransactions = lazy(() => import('./pages/vendor/VendorTransactions').then((module) => ({ default: module.VendorTransactions })));
const VendorUtang = lazy(() => import('./pages/vendor/VendorUtang').then((module) => ({ default: module.VendorUtang })));
const VendorProfile = lazy(() => import('./pages/vendor/VendorProfile').then((module) => ({ default: module.VendorProfile })));
const AdminMarket = lazy(() => import('./pages/admin/AdminMarket').then((module) => ({ default: module.AdminMarket })));
const AdminRegister = lazy(() => import('./pages/admin/AdminRegister').then((module) => ({ default: module.AdminRegister })));
const AdminMetrics = lazy(() => import('./pages/admin/AdminMetrics').then((module) => ({ default: module.AdminMetrics })));
const AdminHealth = lazy(() => import('./pages/admin/AdminHealth').then((module) => ({ default: module.AdminHealth })));
const AdminProofs = lazy(() => import('./pages/admin/AdminProofs').then((module) => ({ default: module.AdminProofs })));
const AdminRamps = lazy(() => import('./pages/admin/AdminRamps').then((module) => ({ default: module.AdminRamps })));

function RouteLoading() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{ backgroundColor: '#F8FAFC' }}
    >
      <div className="h-10 w-10 rounded-2xl animate-pulse" aria-hidden="true" style={{ backgroundColor: '#008055' }} />
      <span className="sr-only">Loading route</span>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <ToastProvider>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              {/* Fullscreen pages - no layout shell */}
              <Route path="/onboard" element={<Onboard />} />
              <Route path="/connect" element={<Connect />} />
              <Route path="/" element={<Landing />} />

              {/* Layout shell */}
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/test-send" element={<TestSend />} />
                <Route path="/receipt/:txHash" element={<Receipt />} />

                {/* Vendor */}
                <Route path="/vendor/home" element={<VendorHome />} />
                <Route path="/vendor/qr" element={<VendorQR />} />
                <Route path="/vendor/transactions" element={<VendorTransactions />} />
                <Route path="/vendor/utang" element={<VendorUtang />} />
                <Route path="/vendor/profile" element={<VendorProfile />} />

                {/* Customer */}
                <Route path="/customer/home" element={<CustomerHome />} />
                <Route path="/customer/scan" element={<CustomerScan />} />
                <Route path="/customer/history" element={<CustomerHistory />} />
                <Route path="/customer/utang" element={<CustomerUtang />} />
                <Route path="/customer/profile" element={<CustomerProfile />} />
                <Route path="/customer/cashin" element={<CustomerCashin />} />
                <Route path="/customer/cashout" element={<CustomerCashout />} />

                {/* Admin */}
                <Route path="/admin/market" element={<AdminMarket />} />
                <Route path="/admin/register" element={<AdminRegister />} />
                <Route path="/admin/metrics" element={<AdminMetrics />} />
                <Route path="/admin/health" element={<AdminHealth />} />
                <Route path="/admin/proofs" element={<AdminProofs />} />
                <Route path="/admin/ramps" element={<AdminRamps />} />

                {/* Vendor apply (public) */}
                <Route path="/vendor/apply" element={<VendorApply />} />

                {/* Market directory */}
                <Route path="/market" element={<MarketDirectory />} />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </ToastProvider>
      </WalletProvider>
    </BrowserRouter>
  );
}
