/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { FinanceProvider, useFinance } from './FinanceContext';
import LoginView from './views/LoginView';
import DashboardView from './views/DashboardView';
import TransactionsView from './views/TransactionsView';
import BudgetsView from './views/BudgetsView';
import DebtsView from './views/DebtsView';
import CategoriesView from './views/CategoriesView';
import BottomNav from './components/BottomNav';
//
// const apiUrl = import.meta.env.VITE_API_URL;
// const appTitle = import.meta.env.VITE_APP_TITLE;

function MainApp() {
  const { user } = useFinance();
  const [currentTab, setCurrentTab] = useState('dashboard');

  if (!user) return <LoginView />;

  return (
    <div className="min-h-screen bg-gray-200 flex justify-center font-sans sm:py-8">
      <div className="w-full max-w-md bg-white sm:rounded-[2.5rem] sm:shadow-2xl relative flex flex-col overflow-hidden sm:h-[850px] h-screen border-4 border-gray-900">
        <div className="flex-1 overflow-y-auto pb-16 custom-scrollbar">
          {currentTab === 'dashboard' && <DashboardView />}
          {currentTab === 'transactions' && <TransactionsView />}
          {currentTab === 'budgets' && <BudgetsView />}
          {currentTab === 'debts' && <DebtsView />}
          {currentTab === 'categories' && <CategoriesView />}
        </div>
        <BottomNav currentTab={currentTab} setCurrentTab={setCurrentTab} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <FinanceProvider>
      <MainApp />
    </FinanceProvider>
  );
}
