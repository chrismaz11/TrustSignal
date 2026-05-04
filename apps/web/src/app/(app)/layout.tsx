import type { Metadata } from 'next';

import '@tabler/core/dist/css/tabler.min.css';
import { AppSidebar } from '../../components/app/AppSidebar';

export const metadata: Metadata = {
  title: 'TrustSignal App',
  description: 'TrustSignal Operator Console'
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrapper">
      <AppSidebar />
      <div className="page-wrapper">
        {children}
      </div>
    </div>
  );
}
