import React from 'react';
import { LayoutDashboard, ArrowRightLeft, CreditCard, Tags, PieChart } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export default function BottomNav({ currentTab, setCurrentTab }: BottomNavProps) {
  const tabs = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
    { id: 'transactions', icon: ArrowRightLeft, label: 'Activity' },
    { id: 'budgets', icon: PieChart, label: 'Budgets' },
    { id: 'debts', icon: CreditCard, label: 'Debts' },
    { id: 'categories', icon: Tags, label: 'Categories' },
  ];

  return (
    <div className="absolute bottom-0 w-full bg-white border-t border-gray-200 flex justify-around items-center h-16 px-2 z-10">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setCurrentTab(tab.id)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
              isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon size={20} className={isActive ? 'stroke-[2.5px]' : 'stroke-2'} />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
