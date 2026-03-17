import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { Transaction, Debt, Category, User } from './types';
import { supabase } from './supabaseClient';

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

  const refreshDashboardStats = useCallback(async () => {
    if (!user) return;
    try {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('userid', user.id);
        
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('userid', user.id);

      if (!transactions || !cats) return;

      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const previousMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const previousMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const prevMonthStr = `${previousMonthYear}-${String(previousMonth + 1).padStart(2, '0')}`;

      let totalIncome = 0;
      let totalExpense = 0;
      let currentMonthIncome = 0;
      let currentMonthExpense = 0;
      let prevMonthIncome = 0;
      let prevMonthExpense = 0;

      const expensesByCategoryMap: Record<string, number> = {};
      const currentMonthSpentByCategoryMap: Record<string, number> = {};
      const past6MonthsSpentByCategoryMap: Record<string, Record<string, number>> = {};

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      transactions.forEach(t => {
        const amount = Number(t.amount);
        if (t.type === 'income') {
          totalIncome += amount;
          if (t.date.startsWith(currentMonthStr)) currentMonthIncome += amount;
          if (t.date.startsWith(prevMonthStr)) prevMonthIncome += amount;
        } else if (t.type === 'expense') {
          totalExpense += amount;
          if (t.date.startsWith(currentMonthStr)) {
            currentMonthExpense += amount;
            currentMonthSpentByCategoryMap[t.categoryid] = (currentMonthSpentByCategoryMap[t.categoryid] || 0) + amount;
          }
          if (t.date.startsWith(prevMonthStr)) prevMonthExpense += amount;
          
          expensesByCategoryMap[t.categoryid] = (expensesByCategoryMap[t.categoryid] || 0) + amount;

          const tDate = new Date(t.date);
          if (tDate >= sixMonthsAgo) {
            const monthStr = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
            if (!past6MonthsSpentByCategoryMap[t.categoryid]) past6MonthsSpentByCategoryMap[t.categoryid] = {};
            past6MonthsSpentByCategoryMap[t.categoryid][monthStr] = (past6MonthsSpentByCategoryMap[t.categoryid][monthStr] || 0) + amount;
          }
        }
      });

      const expensesByCategory = Object.entries(expensesByCategoryMap).map(([id, value]) => {
        const cat = cats.find(c => c.id === id);
        return { id, name: cat?.name || 'Unknown', color: cat?.color || '#ccc', value };
      }).filter(c => c.value > 0);

      const currentMonthSpentByCategory = Object.entries(currentMonthSpentByCategoryMap).map(([categoryId, spent]) => ({ categoryId, spent }));
      
      const past6MonthsSpentByCategory: { categoryId: string; monthStr: string; spent: number }[] = [];
      Object.entries(past6MonthsSpentByCategoryMap).forEach(([categoryId, months]) => {
        Object.entries(months).forEach(([monthStr, spent]) => {
          past6MonthsSpentByCategory.push({ categoryId, monthStr, spent });
        });
      });

      setDashboardStats({
        totalIncome,
        totalExpense,
        currentMonthIncome,
        currentMonthExpense,
        prevMonthIncome,
        prevMonthExpense,
        expensesByCategory,
        currentMonthSpentByCategory,
        past6MonthsSpentByCategory
      });
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    }
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const { data: cats } = await supabase.from('categories').select('*').eq('userid', user.id);
      const { data: dbs } = await supabase.from('debts').select('*').eq('userid', user.id);
      
      if (cats) {
        setCategories(cats.map(c => ({
          ...c,
          categoryId: c.categoryid,
          budgetAlertThreshold: c.budgetalertthreshold,
          userId: c.userid
        })));
      }
      if (dbs) {
        setDebts(dbs.map(d => ({
          ...d,
          totalAmount: d.totalamount,
          paidAmount: d.paidamount,
          dueDate: d.duedate,
          userId: d.userid
        })));
      }
      await refreshDashboardStats();
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, refreshDashboardStats]);

  useEffect(() => {
    const storedUser = localStorage.getItem('finance_user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

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
    if (!user) return { data: [], total: 0 };
    try {
      let query = supabase.from('transactions').select('*', { count: 'exact' }).eq('userid', user.id);
      
      if (type && type !== 'all') {
        query = query.eq('type', type);
      }
      if (search) {
        query = query.ilike('note', `%${search}%`);
      }
      
      query = query.order('date', { ascending: false }).range(offset, offset + limit - 1);
      
      const { data, count } = await query;
      
      if (data) {
        return { 
          data: data.map(t => ({...t, categoryId: t.categoryid, userId: t.userid})), 
          total: count || 0 
        };
      }
      return { data: [], total: 0 };
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      return { data: [], total: 0 };
    }
  };

  const fetchDebtPayments = async (debtId: string, limit: number, offset: number) => {
    if (!user) return { data: [], total: 0 };
    try {
      const { data, count } = await supabase
        .from('debt_payments')
        .select('*', { count: 'exact' })
        .eq('debtid', debtId)
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1);
        
      if (data) {
        return { data: data.map(d => ({...d, debtId: d.debtid})), total: count || 0 };
      }
      return { data: [], total: 0 };
    } catch (error) {
      console.error('Failed to fetch debt payments:', error);
      return { data: [], total: 0 };
    }
  };

  const addTransaction = async (t: Omit<Transaction, 'id'>) => {
    if (!user) return;
    const newId = Math.random().toString(36).substr(2, 9);
    try {
      await supabase.from('transactions').insert([{
        id: newId,
        userid: user.id,
        amount: t.amount,
        type: t.type,
        categoryid: t.categoryId,
        date: t.date,
        note: t.note
      }]);
      await refreshDashboardStats();
    } catch (error) {
      console.error('Failed to add transaction:', error);
    }
  };

  const editTransaction = async (id: string, updatedTransaction: Partial<Transaction>) => {
    if (!user) return;
    try {
      const updateData: any = {};
      if (updatedTransaction.amount !== undefined) updateData.amount = updatedTransaction.amount;
      if (updatedTransaction.type !== undefined) updateData.type = updatedTransaction.type;
      if (updatedTransaction.categoryId !== undefined) updateData.categoryid = updatedTransaction.categoryId;
      if (updatedTransaction.date !== undefined) updateData.date = updatedTransaction.date;
      if (updatedTransaction.note !== undefined) updateData.note = updatedTransaction.note;
      
      await supabase.from('transactions').update(updateData).eq('id', id).eq('userid', user.id);
      await refreshDashboardStats();
    } catch (error) {
      console.error('Failed to edit transaction:', error);
    }
  };

  const addDebt = async (d: Omit<Debt, 'id'>) => {
    if (!user) return;
    const newId = Math.random().toString(36).substr(2, 9);
    const newDebt = { ...d, id: newId };
    setDebts([...debts, newDebt]);
    
    try {
      await supabase.from('debts').insert([{
        id: newId,
        userid: user.id,
        name: d.name,
        totalamount: d.totalAmount,
        paidamount: d.paidAmount || 0,
        duedate: d.dueDate,
        note: d.note
      }]);
    } catch (error) {
      console.error('Failed to add debt:', error);
    }
  };

  const editDebt = async (id: string, updatedDebt: Partial<Debt>) => {
    if (!user) return;
    setDebts(debts.map(d => d.id === id ? { ...d, ...updatedDebt } : d));
    
    try {
      const updateData: any = {};
      if (updatedDebt.name !== undefined) updateData.name = updatedDebt.name;
      if (updatedDebt.totalAmount !== undefined) updateData.totalamount = updatedDebt.totalAmount;
      if (updatedDebt.paidAmount !== undefined) updateData.paidamount = updatedDebt.paidAmount;
      if (updatedDebt.dueDate !== undefined) updateData.duedate = updatedDebt.dueDate;
      if (updatedDebt.note !== undefined) updateData.note = updatedDebt.note;
      
      await supabase.from('debts').update(updateData).eq('id', id).eq('userid', user.id);
    } catch (error) {
      console.error('Failed to edit debt:', error);
    }
  };

  const addDebtPayment = async (debtId: string, amount: number, date: string, note?: string) => {
    if (!user) return;
    const newId = Math.random().toString(36).substr(2, 9);
    
    try {
      await supabase.from('debt_payments').insert([{
        id: newId,
        debtid: debtId,
        amount,
        date,
        note
      }]);
      
      const debt = debts.find(d => d.id === debtId);
      if (debt) {
        const newPaidAmount = debt.paidAmount + amount;
        await supabase.from('debts').update({ paidamount: newPaidAmount }).eq('id', debtId).eq('userid', user.id);
        setDebts(debts.map(d => d.id === debtId ? { ...d, paidAmount: newPaidAmount } : d));
      }
    } catch (error) {
      console.error('Failed to add debt payment:', error);
    }
  };

  const editDebtPayment = async (debtId: string, paymentId: string, amount: number, date: string, note?: string) => {
    if (!user) return;
    try {
      const { data: oldPayment } = await supabase.from('debt_payments').select('amount').eq('id', paymentId).single();
      if (!oldPayment) return;
      
      const amountDiff = amount - oldPayment.amount;
      
      await supabase.from('debt_payments').update({ amount, date, note }).eq('id', paymentId);
      
      if (amountDiff !== 0) {
        const debt = debts.find(d => d.id === debtId);
        if (debt) {
          const newPaidAmount = debt.paidAmount + amountDiff;
          await supabase.from('debts').update({ paidamount: newPaidAmount }).eq('id', debtId).eq('userid', user.id);
          setDebts(debts.map(d => d.id === debtId ? { ...d, paidAmount: newPaidAmount } : d));
        }
      }
    } catch (error) {
      console.error('Failed to edit debt payment:', error);
    }
  };

  const deleteDebtPayment = async (debtId: string, paymentId: string) => {
    if (!user) return;
    try {
      const { data: oldPayment } = await supabase.from('debt_payments').select('amount').eq('id', paymentId).single();
      if (!oldPayment) return;
      
      await supabase.from('debt_payments').delete().eq('id', paymentId);
      
      const debt = debts.find(d => d.id === debtId);
      if (debt) {
        const newPaidAmount = debt.paidAmount - oldPayment.amount;
        await supabase.from('debts').update({ paidamount: newPaidAmount }).eq('id', debtId).eq('userid', user.id);
        setDebts(debts.map(d => d.id === debtId ? { ...d, paidAmount: newPaidAmount } : d));
      }
    } catch (error) {
      console.error('Failed to delete debt payment:', error);
    }
  };

  const addCategory = async (c: Omit<Category, 'id'>) => {
    if (!user) return;
    const newId = Math.random().toString(36).substr(2, 9);
    const newCategory = { ...c, id: newId };
    setCategories([...categories, newCategory]);
    
    try {
      await supabase.from('categories').insert([{
        id: newId,
        userid: user.id,
        name: c.name,
        type: c.type,
        color: c.color,
        icon: c.icon,
        budget: c.budget,
        budgetalertthreshold: c.budgetAlertThreshold
      }]);
      await refreshDashboardStats();
    } catch (error) {
      console.error('Failed to add category:', error);
    }
  };

  const editCategory = async (id: string, updatedCategory: Partial<Category>) => {
    if (!user) return;
    setCategories(categories.map(c => c.id === id ? { ...c, ...updatedCategory } : c));
    
    try {
      const updateData: any = {};
      if (updatedCategory.name !== undefined) updateData.name = updatedCategory.name;
      if (updatedCategory.type !== undefined) updateData.type = updatedCategory.type;
      if (updatedCategory.color !== undefined) updateData.color = updatedCategory.color;
      if (updatedCategory.icon !== undefined) updateData.icon = updatedCategory.icon;
      if (updatedCategory.budget !== undefined) updateData.budget = updatedCategory.budget;
      if (updatedCategory.budgetAlertThreshold !== undefined) updateData.budgetalertthreshold = updatedCategory.budgetAlertThreshold;
      
      await supabase.from('categories').update(updateData).eq('id', id).eq('userid', user.id);
      await refreshDashboardStats();
    } catch (error) {
      console.error('Failed to edit category:', error);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!user) return { success: false, error: 'Not logged in' };
    try {
      const { count } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('categoryid', id).eq('userid', user.id);
      
      if (count && count > 0) {
        return { success: false, error: 'Cannot delete category because it has associated transactions.' };
      }
      
      const { error } = await supabase.from('categories').delete().eq('id', id).eq('userid', user.id);
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      setCategories(categories.filter(c => c.id !== id));
      return { success: true };
    } catch (error: any) {
      console.error('Failed to delete category:', error);
      return { success: false, error: 'Network error or server unavailable' };
    }
  };

  const backupToSupabase = async () => {
    return { success: true, message: 'Data is already synced with Supabase' };
  };

  const restoreFromSupabase = async () => {
    await fetchData();
    return { success: true, message: 'Data refreshed from Supabase' };
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
