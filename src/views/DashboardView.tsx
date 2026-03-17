import React from 'react';
import { useFinance } from '../FinanceContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Wallet, LogOut, TrendingUp, TrendingDown } from 'lucide-react';

export default function DashboardView() {
  const { user, categories, logout, dashboardStats } = useFinance();

  const totalIncome = dashboardStats?.totalIncome || 0;
  const totalExpense = dashboardStats?.totalExpense || 0;
  const balance = totalIncome - totalExpense;

  const currentMonthIncome = dashboardStats?.currentMonthIncome || 0;
  const currentMonthExpense = dashboardStats?.currentMonthExpense || 0;
  const prevMonthIncome = dashboardStats?.prevMonthIncome || 0;
  const prevMonthExpense = dashboardStats?.prevMonthExpense || 0;

  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const incomeChange = calculatePercentageChange(currentMonthIncome, prevMonthIncome);
  const expenseChange = calculatePercentageChange(currentMonthExpense, prevMonthExpense);

  const expensesByCategory = dashboardStats?.expensesByCategory || [];

  // --- Budget Alerts Logic ---
  const budgetAlerts = categories
    .filter(c => c.type === 'expense' && c.budget && c.budgetAlertThreshold)
    .map(category => {
      const spent = dashboardStats?.currentMonthSpentByCategory?.find(s => s.categoryId === category.id)?.spent || 0;
      const percentage = Math.min(100, Math.round((spent / category.budget!) * 100));
      return { ...category, spent, percentage, isOverBudget: spent > category.budget! };
    })
    .filter(c => c.percentage >= c.budgetAlertThreshold!);

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-full">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-500 font-medium">Welcome back,</p>
          <h1 className="text-2xl font-bold text-gray-900">{user?.name}</h1>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={logout} className="p-2 bg-white rounded-full shadow-sm text-gray-400 hover:text-gray-600 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Budget Alerts Section */}
      {budgetAlerts.length > 0 && (
        <div className="space-y-3">
          {budgetAlerts.map(alert => (
            <div key={alert.id} className={`p-4 rounded-2xl border flex items-start space-x-3 ${alert.isOverBudget ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className={`p-2 rounded-full ${alert.isOverBudget ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                <Wallet size={16} />
              </div>
              <div>
                <h4 className={`text-sm font-bold ${alert.isOverBudget ? 'text-rose-900' : 'text-amber-900'}`}>
                  {alert.isOverBudget ? `${alert.name} Budget Exceeded` : `${alert.name} Budget Alert`}
                </h4>
                <p className={`text-xs mt-0.5 ${alert.isOverBudget ? 'text-rose-700' : 'text-amber-700'}`}>
                  {alert.isOverBudget 
                    ? `You've exceeded your budget by $${(alert.spent - alert.budget!).toLocaleString()}.`
                    : `You've reached ${alert.percentage}% of your $${alert.budget!.toLocaleString()} budget.`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Balance Card */}
      <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-white opacity-10 rounded-full blur-lg"></div>
        
        <div className="relative z-10">
          <div className="flex items-center space-x-2 opacity-80 mb-1">
            <Wallet size={18} />
            <span className="text-sm font-medium">Total Balance</span>
          </div>
          <h2 className="text-4xl font-bold tracking-tight">${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
          
          <div className="flex justify-between mt-6 pt-4 border-t border-white/20">
            <div>
              <div className="flex items-center space-x-1 text-indigo-100 text-xs mb-1">
                <ArrowDownRight size={14} />
                <span>Total Income</span>
              </div>
              <p className="font-semibold">${totalIncome.toLocaleString()}</p>
            </div>
            <div>
              <div className="flex items-center space-x-1 text-indigo-100 text-xs mb-1">
                <ArrowUpRight size={14} />
                <span>Total Expenses</span>
              </div>
              <p className="font-semibold">${totalExpense.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Summary Section */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium mb-1">Income (This Month)</p>
          <p className="text-xl font-bold text-gray-900">${currentMonthIncome.toLocaleString()}</p>
          <div className={`flex items-center mt-2 text-xs font-medium ${incomeChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {incomeChange >= 0 ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
            <span>{Math.abs(incomeChange)}% vs last month</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-medium mb-1">Expenses (This Month)</p>
          <p className="text-xl font-bold text-gray-900">${currentMonthExpense.toLocaleString()}</p>
          <div className={`flex items-center mt-2 text-xs font-medium ${expenseChange <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {expenseChange <= 0 ? <TrendingDown size={14} className="mr-1" /> : <TrendingUp size={14} className="mr-1" />}
            <span>{Math.abs(expenseChange)}% vs last month</span>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Expenses by Category</h3>
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
          {expensesByCategory.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensesByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {expensesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `$${value}`}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              No expenses yet
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3 mt-2">
            {expensesByCategory.map((c) => (
              <div key={c.name} className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }}></div>
                <span className="text-xs text-gray-600 truncate">{c.name}</span>
                <span className="text-xs font-semibold text-gray-900 ml-auto">${c.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
