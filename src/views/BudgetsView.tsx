import React, { useState } from 'react';
import { useFinance } from '../FinanceContext';
import { Plus, Target, Edit2, AlertCircle, ArrowDown, ArrowUp, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import { Category } from '../types';

export default function BudgetsView() {
  const { categories, dashboardStats, editCategory } = useFinance();
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [alertThreshold, setAlertThreshold] = useState('80');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<{ budget: number; budgetAlertThreshold: number } | null>(null);

  const [sortBy, setSortBy] = useState<'name' | 'budget' | 'spent' | 'percentage'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  const expenseCategories = categories.filter(c => c.type === 'expense');

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const getPastMonths = (count: number) => {
    const months = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      months.push({
        month: d.getMonth(),
        year: d.getFullYear(),
        label: d.toLocaleDateString('default', { month: 'short' })
      });
    }
    return months;
  };

  const pastMonths = getPastMonths(6);

  const budgetsData = expenseCategories.map(category => {
    const history = pastMonths.map(m => {
      const monthStr = `${m.year}-${String(m.month + 1).padStart(2, '0')}`;
      const spent = dashboardStats?.past6MonthsSpentByCategory?.find(
        s => s.categoryId === category.id && s.monthStr === monthStr
      )?.spent || 0;
      return { ...m, spent };
    });

    const currentMonthData = history[history.length - 1];
    const spent = currentMonthData.spent;
    
    const percentage = category.budget ? Math.min(100, Math.round((spent / category.budget) * 100)) : 0;
    const isOverBudget = category.budget ? spent > category.budget : false;
    const isNearBudget = category.budget && category.budgetAlertThreshold && !isOverBudget && percentage >= category.budgetAlertThreshold;

    return {
      ...category,
      spent,
      budget: category.budget || 0,
      percentage,
      isOverBudget,
      isNearBudget,
      history
    };
  });

  const totalBudget = budgetsData.reduce((sum, c) => sum + c.budget, 0);
  const totalSpent = budgetsData.reduce((sum, c) => sum + c.spent, 0);
  const totalPercentage = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

  const sortedBudgetsData = [...budgetsData].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'budget':
        comparison = a.budget - b.budget;
        break;
      case 'spent':
        comparison = a.spent - b.spent;
        break;
      case 'percentage':
        comparison = a.percentage - b.percentage;
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const openEditModal = (category: Category) => {
    setEditingCategoryId(category.id);
    setBudgetAmount(category.budget ? category.budget.toString() : '');
    setAlertThreshold(category.budgetAlertThreshold ? category.budgetAlertThreshold.toString() : '80');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategoryId) {
      setPendingChanges({
        budget: parseFloat(budgetAmount) || 0,
        budgetAlertThreshold: parseFloat(alertThreshold) || 80
      });
      setShowConfirmDialog(true);
    }
  };

  const confirmEdit = () => {
    if (editingCategoryId && pendingChanges) {
      editCategory(editingCategoryId, pendingChanges);
      setEditingCategoryId(null);
      setShowConfirmDialog(false);
      setPendingChanges(null);
    }
  };

  const cancelEdit = () => {
    setShowConfirmDialog(false);
    setPendingChanges(null);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-full relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Monthly Budgets</h1>
      </div>

      {/* Total Budget Summary Card */}
      <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-200 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
        <div className="relative z-10">
          <div className="flex items-center space-x-2 opacity-80 mb-1">
            <Target size={18} />
            <span className="text-sm font-medium">Total Budget (This Month)</span>
          </div>
          <div className="flex items-end space-x-2">
            <h2 className="text-4xl font-bold tracking-tight">${totalSpent.toLocaleString()}</h2>
            <p className="text-indigo-200 mb-1">/ ${totalBudget.toLocaleString()}</p>
          </div>
          
          <div className="mt-5">
            <div className="flex justify-between text-xs mb-1 text-indigo-100">
              <span>{totalPercentage}% Used</span>
              <span>${Math.max(0, totalBudget - totalSpent).toLocaleString()} Left</span>
            </div>
            <div className="w-full bg-indigo-900/50 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${totalSpent > totalBudget ? 'bg-rose-400' : 'bg-white'}`} 
                style={{ width: `${totalPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-2">
          <h3 className="text-lg font-bold text-gray-900">Category Budgets</h3>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-gray-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-sm border border-gray-200 rounded-lg py-1.5 pl-3 pr-8 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm"
            >
              <option value="name">Name</option>
              <option value="budget">Budget Amount</option>
              <option value="spent">Amount Spent</option>
              <option value="percentage">% Used</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-indigo-600 transition-colors shadow-sm"
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
            </button>
          </div>
        </div>
        
        {sortedBudgetsData.map((data) => (
          <div key={data.id} className={`bg-white p-5 rounded-2xl shadow-sm border transition-colors ${data.isOverBudget ? 'border-rose-300 bg-rose-50 ring-2 ring-rose-500/20' : data.isNearBudget ? 'border-amber-300 bg-amber-50 ring-2 ring-amber-500/20' : 'border-gray-100'}`}>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: data.color }}
                  >
                    <span className="font-bold text-sm">{data.name.charAt(0)}</span>
                  </div>
                  {data.isOverBudget && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border-2 border-white"></span>
                    </span>
                  )}
                  {data.isNearBudget && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border-2 border-white"></span>
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{data.name}</h3>
                  <p className="text-xs text-gray-500">
                    {data.budget > 0 
                      ? `$${data.spent.toLocaleString()} of $${data.budget.toLocaleString()}`
                      : `$${data.spent.toLocaleString()} spent`}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => openEditModal(data)}
                className="text-gray-400 hover:text-indigo-600 transition-colors p-2 bg-gray-50 rounded-full"
              >
                <Edit2 size={14} />
              </button>
            </div>
            
            <div className="mt-2">
              {data.budget > 0 ? (
                <>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={`font-medium ${data.isOverBudget ? 'text-rose-600' : data.isNearBudget ? 'text-amber-600' : 'text-indigo-600'}`}>
                      {data.percentage}% Used
                    </span>
                    <span className={data.isOverBudget ? 'text-rose-600 font-bold' : data.isNearBudget ? 'text-amber-600 font-bold' : 'text-gray-500'}>
                      {data.isOverBudget 
                        ? `$${(data.spent - data.budget).toLocaleString()} Over` 
                        : `$${(data.budget - data.spent).toLocaleString()} Left`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${data.isOverBudget ? 'bg-rose-500' : data.isNearBudget ? 'bg-amber-500' : 'bg-indigo-600'}`} 
                      style={{ width: `${Math.min(100, data.percentage)}%` }}
                    ></div>
                  </div>
                  
                  {data.isOverBudget && (
                    <div className="mt-3 flex items-start space-x-2 text-rose-700 bg-rose-100/50 p-2.5 rounded-xl border border-rose-100">
                      <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-500" />
                      <p className="text-xs font-medium leading-relaxed">
                        You've exceeded your {data.name} budget by <span className="font-bold">${(data.spent - data.budget).toLocaleString()}</span>. Consider reducing expenses here.
                      </p>
                    </div>
                  )}

                  {data.isNearBudget && (
                    <div className="mt-3 flex items-start space-x-2 text-amber-700 bg-amber-100/50 p-2.5 rounded-xl border border-amber-100">
                      <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                      <p className="text-xs font-medium leading-relaxed">
                        You've reached <span className="font-bold">{data.percentage}%</span> of your {data.name} budget.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-500">No budget set</span>
                    <span className="text-gray-500">
                      {data.spent > 0 ? 'Unbudgeted spending' : 'No spending'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${data.spent > 0 ? 'bg-gray-400' : 'bg-gray-200'}`} 
                      style={{ width: data.spent > 0 ? '100%' : '0%' }}
                    ></div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-center">
              <button 
                onClick={() => setExpandedCategoryId(expandedCategoryId === data.id ? null : data.id)}
                className="flex items-center space-x-1 text-xs font-medium text-gray-500 hover:text-indigo-600 transition-colors"
              >
                <BarChart2 size={14} />
                <span>{expandedCategoryId === data.id ? 'Hide Trend' : 'View 6-Month Trend'}</span>
                {expandedCategoryId === data.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {expandedCategoryId === data.id && (
              <div className="mt-4 pt-4 border-t border-gray-100 animate-in slide-in-from-top-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 text-center">6-Month Spending Trend</h4>
                <div className="flex items-end justify-between space-x-2 h-32 px-2">
                  {data.history.map((h, i) => {
                    const maxSpent = Math.max(...data.history.map(x => x.spent), data.budget || 1);
                    const height = h.spent > 0 ? Math.max(4, (h.spent / maxSpent) * 100) : 0;
                    const isCurrent = i === data.history.length - 1;
                    const isOver = data.budget > 0 && h.spent > data.budget;
                    
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        <div className="absolute -top-8 bg-gray-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                          ${h.spent.toLocaleString()}
                        </div>
                        
                        <div className="w-full flex justify-center h-[80%] items-end">
                          <div 
                            className={`w-full max-w-[28px] rounded-t-md transition-all duration-500 ${isOver ? 'bg-rose-400' : isCurrent ? 'bg-indigo-500' : 'bg-indigo-200'}`} 
                            style={{ height: `${height}%` }}
                          ></div>
                        </div>
                        
                        <span className={`text-[10px] mt-2 ${isCurrent ? 'font-bold text-indigo-600' : 'text-gray-500'}`}>
                          {h.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Set Budget Modal */}
      {editingCategoryId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Set Monthly Budget</h2>
              <button onClick={() => setEditingCategoryId(null)} className="text-gray-400 hover:text-gray-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Budget Amount</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                    className="block w-full pl-7 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 text-lg font-semibold"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Set to 0 to remove the budget for this category.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Alert Threshold (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(e.target.value)}
                    onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                    className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 text-lg font-semibold"
                    placeholder="80"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Get notified when spending reaches this percentage.</p>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mt-6"
              >
                Save Budget
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Changes</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to save these budget changes?</p>
            <div className="flex space-x-3">
              <button
                onClick={cancelEdit}
                className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmEdit}
                className="flex-1 py-2.5 px-4 border border-transparent rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
