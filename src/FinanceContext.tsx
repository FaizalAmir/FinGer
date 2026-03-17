import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { Transaction, Debt, Category, User } from './types';

export interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  currentMonthIncome: number;
  currentMonthExpense: number;
  prevMonthIncome: number;
  prevMonthExpense: number;
  expensesByCategory: { id: string; name: string; color: string; value: number }[];
  currentMonthSpentByCategory: { categoryId: string; spent: number }[];
  past6MonthsSpentByCategory: { categoryId: string; monthStr: string; spent: number }[];
}

interface FinanceContextType {
  user: User | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
  categories: Category[];
  debts: Debt[];
  dashboardStats: DashboardStats | null;
  fetchTransactions: (limit: number, offset: number, search?: string, type?: string) => Promise<{ data: Transaction[], total: number }>;
  fetchDebtPayments: (debtId: string, limit: number, offset: number) => Promise<{ data: any[], total: number }>;
  addTransaction: (t: Omit<Transaction, 'id'>) => Promise<void>;
  editTransaction: (id: string, updatedTransaction: Partial<Transaction>) => Promise<void>;
  addDebt: (d: Omit<Debt, 'id'>) => void;
  editDebt: (id: string, updatedDebt: Partial<Debt>) => void;
  addDebtPayment: (debtId: string, amount: number, date: string, note?: string) => void;
  editDebtPayment: (debtId: string, paymentId: string, amount: number, date: string, note?: string) => Promise<void>;
  deleteDebtPayment: (debtId: string, paymentId: string) => Promise<void>;
  addCategory: (c: Omit<Category, 'id'>) => void;
  editCategory: (id: string, updatedCategory: Partial<Category>) => void;
  deleteCategory: (id: string) => Promise<{ success: boolean; error?: string }>;
  backupToSupabase: () => Promise<{ success: boolean; message?: string; error?: string }>;
  restoreFromSupabase: () => Promise<{ success: boolean; message?: string; error?: string }>;
  isLoading: boolean;
  refreshDashboardStats: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('finance_token'));
  const [categories, setCategories] = useState<Category[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }, [token]);

  const refreshDashboardStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/dashboard-stats', { headers: getHeaders() });
      if (res.ok) {
        setDashboardStats(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    }
  }, [token, getHeaders]);

  const fetchData = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const [catRes, debtsRes, statsRes] = await Promise.all([
        fetch('/api/categories', { headers: getHeaders() }),
        fetch('/api/debts', { headers: getHeaders() }),
        fetch('/api/dashboard-stats', { headers: getHeaders() })
      ]);
      
      if (catRes.status === 401 || catRes.status === 403) {
        logout();
        return;
      }

      if (catRes.ok) setCategories(await catRes.json());
      if (debtsRes.ok) setDebts(await debtsRes.json());
      if (statsRes.ok) setDashboardStats(await statsRes.json());
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token, getHeaders]);

  useEffect(() => {
    const storedUser = localStorage.getItem('finance_user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [token, fetchData]);

  const login = (newToken: string, userData: User) => {
    localStorage.setItem('finance_token', newToken);
    localStorage.setItem('finance_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('finance_token');
    localStorage.removeItem('finance_user');
    setToken(null);
    setUser(null);
    setCategories([]);
    setDebts([]);
    setDashboardStats(null);
  };

  const fetchTransactions = async (limit: number, offset: number, search?: string, type?: string) => {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });
      if (search) params.append('search', search);
      if (type && type !== 'all') params.append('type', type);

      const res = await fetch(`/api/transactions?${params.toString()}`, { headers: getHeaders() });
      if (res.ok) {
        return await res.json();
      }
      return { data: [], total: 0 };
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      return { data: [], total: 0 };
    }
  };

  const fetchDebtPayments = async (debtId: string, limit: number, offset: number) => {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });
      const res = await fetch(`/api/debts/${debtId}/payments?${params.toString()}`, { headers: getHeaders() });
      if (res.ok) {
        return await res.json();
      }
      return { data: [], total: 0 };
    } catch (error) {
      console.error('Failed to fetch debt payments:', error);
      return { data: [], total: 0 };
    }
  };

  const addTransaction = async (t: Omit<Transaction, 'id'>) => {
    const newTransaction = { ...t, id: Math.random().toString(36).substr(2, 9) };
    try {
      await fetch('/api/transactions', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newTransaction)
      });
      await refreshDashboardStats();
    } catch (error) {
      console.error('Failed to add transaction:', error);
    }
  };

  const editTransaction = async (id: string, updatedTransaction: Partial<Transaction>) => {
    try {
      await fetch(`/api/transactions/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updatedTransaction)
      });
      await refreshDashboardStats();
    } catch (error) {
      console.error('Failed to edit transaction:', error);
    }
  };

  const addDebt = async (d: Omit<Debt, 'id'>) => {
    const newDebt = { ...d, id: Math.random().toString(36).substr(2, 9) };
    setDebts([...debts, newDebt]);
    
    try {
      await fetch('/api/debts', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newDebt)
      });
    } catch (error) {
      console.error('Failed to add debt:', error);
    }
  };

  const editDebt = async (id: string, updatedDebt: Partial<Debt>) => {
    setDebts(debts.map(d => d.id === id ? { ...d, ...updatedDebt } : d));
    
    try {
      await fetch(`/api/debts/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updatedDebt)
      });
    } catch (error) {
      console.error('Failed to edit debt:', error);
    }
  };

  const addDebtPayment = async (debtId: string, amount: number, date: string, note?: string) => {
    const newPayment = { id: Math.random().toString(36).substr(2, 9), amount, date, note };
    
    try {
      await fetch(`/api/debts/${debtId}/payments`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newPayment)
      });
      
      setDebts(debts.map(d => {
        if (d.id === debtId) {
          return {
            ...d,
            paidAmount: d.paidAmount + amount,
            // We no longer need to maintain payments array here since it's lazy loaded
          };
        }
        return d;
      }));
    } catch (error) {
      console.error('Failed to add debt payment:', error);
    }
  };

  const editDebtPayment = async (debtId: string, paymentId: string, amount: number, date: string, note?: string) => {
    try {
      await fetch(`/api/debts/${debtId}/payments/${paymentId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ amount, date, note })
      });
      
      // Refresh debts to get updated paidAmount
      const res = await fetch('/api/debts', { headers: getHeaders() });
      if (res.ok) {
        setDebts(await res.json());
      }
    } catch (error) {
      console.error('Failed to edit debt payment:', error);
    }
  };

  const deleteDebtPayment = async (debtId: string, paymentId: string) => {
    try {
      await fetch(`/api/debts/${debtId}/payments/${paymentId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      
      // Refresh debts to get updated paidAmount
      const res = await fetch('/api/debts', { headers: getHeaders() });
      if (res.ok) {
        setDebts(await res.json());
      }
    } catch (error) {
      console.error('Failed to delete debt payment:', error);
    }
  };

  const addCategory = async (c: Omit<Category, 'id'>) => {
    const newCategory = { ...c, id: Math.random().toString(36).substr(2, 9) };
    setCategories([...categories, newCategory]);
    
    try {
      await fetch('/api/categories', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newCategory)
      });
      await refreshDashboardStats();
    } catch (error) {
      console.error('Failed to add category:', error);
    }
  };

  const editCategory = async (id: string, updatedCategory: Partial<Category>) => {
    setCategories(categories.map(c => c.id === id ? { ...c, ...updatedCategory } : c));
    
    try {
      await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updatedCategory)
      });
      await refreshDashboardStats();
    } catch (error) {
      console.error('Failed to edit category:', error);
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to delete category' };
      }
      
      setCategories(categories.filter(c => c.id !== id));
      return { success: true };
    } catch (error: any) {
      console.error('Failed to delete category:', error);
      return { success: false, error: 'Network error or server unavailable' };
    }
  };

  const backupToSupabase = async () => {
    try {
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Backup failed');
      }
      return { success: true, message: data.message };
    } catch (error: any) {
      console.error('Backup error:', error);
      return { success: false, error: error.message };
    }
  };

  const restoreFromSupabase = async () => {
    try {
      const response = await fetch('/api/restore', {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Restore failed');
      }
      await fetchData();
      return { success: true, message: data.message };
    } catch (error: any) {
      console.error('Restore error:', error);
      return { success: false, error: error.message };
    }
  };

  return (
    <FinanceContext.Provider value={{ user, login, logout, categories, debts, dashboardStats, fetchTransactions, fetchDebtPayments, addTransaction, editTransaction, addDebt, editDebt, addDebtPayment, editDebtPayment, deleteDebtPayment, addCategory, editCategory, deleteCategory, backupToSupabase, restoreFromSupabase, isLoading, refreshDashboardStats }}>
      {isLoading ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        children
      )}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (context === undefined) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
