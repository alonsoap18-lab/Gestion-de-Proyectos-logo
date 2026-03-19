// src/components/layout/Layout.jsx
import { useState } from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} toggle={() => setCollapsed(c => !c)}/>
      <main className={`flex-1 min-w-0 transition-all duration-200 ${collapsed ? 'ml-[60px]' : 'ml-[220px]'}`}>
        <div className="p-6 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
