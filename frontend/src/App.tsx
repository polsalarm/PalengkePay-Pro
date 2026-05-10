import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WalletProvider } from './components/WalletProvider';
import { ToastProvider } from './components/Toast';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { Connect } from './pages/Connect';
import { Onboard } from './pages/Onboard';
import { Dashboard } from './pages/Dashboard';
import { TestSend } from './pages/TestSend';
import { VendorHome } from './pages/vendor/VendorHome';
import { VendorQR } from './pages/vendor/VendorQR';
import { VendorTransactions } from './pages/vendor/VendorTransactions';
import { VendorUtang } from './pages/vendor/VendorUtang';
import { VendorProfile } from './pages/vendor/VendorProfile';
import { CustomerHome } from './pages/customer/CustomerHome';
import { CustomerScan } from './pages/customer/CustomerScan';
import { CustomerHistory } from './pages/customer/CustomerHistory';
import { CustomerUtang } from './pages/customer/CustomerUtang';
import { AdminMarket } from './pages/admin/AdminMarket';
import { AdminRegister } from './pages/admin/AdminRegister';
import { AdminMetrics } from './pages/admin/AdminMetrics';
import { VendorApply } from './pages/vendor/VendorApply';
import { MarketDirectory } from './pages/MarketDirectory';

export default function App() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <ToastProvider>
        <Routes>
          {/* Fullscreen pages — no layout shell */}
          <Route path="/onboard" element={<Onboard />} />
          <Route path="/connect" element={<Connect />} />
          <Route path="/" element={<Landing />} />

          {/* Layout shell */}
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/test-send" element={<TestSend />} />

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

            {/* Admin */}
            <Route path="/admin/market" element={<AdminMarket />} />
            <Route path="/admin/register" element={<AdminRegister />} />
            <Route path="/admin/metrics" element={<AdminMetrics />} />

            {/* Vendor apply (public) */}
            <Route path="/vendor/apply" element={<VendorApply />} />

            {/* Market directory */}
            <Route path="/market" element={<MarketDirectory />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </ToastProvider>
      </WalletProvider>
    </BrowserRouter>
  );
}
