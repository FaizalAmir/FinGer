import React, { useState, useEffect, useCallback } from 'react';
import { useFinance } from '../FinanceContext';
import { Plus, ArrowUpRight, ArrowDownRight, Search, Edit2, Loader2 } from 'lucide-react';
import { TransactionType, Transaction } from '../types';

export default function TransactionsView() {
  const { categories, addTransaction, editTransaction, fetchTransactions } = useFinance();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const [showAdd, setShowAdd] = useState(false);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [visibleCount, setVisibleCount] = useState(20);

  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editType, setEditType] = useState<TransactionType>('expense');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');

  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  const loadTransactions = useCallback(async (isLoadMore = false) => {
    setIsLoading(true);
    try {
      const limit = isLoadMore ? 20 : visibleCount;
      const offset = isLoadMore ? transactions.length : 0;
      const result = await fetchTransactions(limit, offset, searchQuery, filterType);
      
      if (isLoadMore) {
        setTransactions(prev => [...prev, ...result.data]);
      } else {
        setTransactions(result.data);
      }
      setTotalTransactions(result.total);
    } catch (error) {
      console.error("Failed to load transactions", error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchTransactions, searchQuery, filterType, visibleCount, transactions.length]);

  useEffect(() => {
    loadTransactions();
  }, [searchQuery, filterType]); // Reload when search or filter changes

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 20);
    loadTransactions(true);
  };

  const filteredCategories = categories.filter((c) => c.type === type);
  const editFilteredCategories = categories.filter((c) => c.type === editType);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setVisibleCount(20);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterType(e.target.value as 'all' | 'income' | 'expense');
    setVisibleCount(20);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount && categoryId) {
      setConfirmMessage('Are you sure you want to save this new transaction?');
      setConfirmAction(() => async () => {
        await addTransaction({
          amount: parseFloat(amount),
          type,
          categoryId,
          note,
          date: date || new Date().toISOString().split('T')[0],
        });
        setShowAdd(false);
        setAmount('');
        setNote('');
        setCategoryId('');
        setDate(new Date().toISOString().split('T')[0]);
        setShowConfirm(false);
        loadTransactions(); // Reload after adding
      });
      setShowConfirm(true);
    }
  };

  const openEditModal = (t: Transaction) => {
    setEditingTransactionId(t.id);
    setEditAmount(t.amount.toString());
    setEditType(t.type);
    setEditCategoryId(t.categoryId);
    setEditNote(t.note || '');
    setEditDate(t.date || new Date().toISOString().split('T')[0]);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTransactionId && editAmount && editCategoryId) {
      setConfirmMessage('Are you sure you want to save changes to this transaction?');
      setConfirmAction(() => async () => {
        await editTransaction(editingTransactionId, {
          amount: parseFloat(editAmount),
          type: editType,
          categoryId: editCategoryId,
          note: editNote,
          date: editDate || new Date().toISOString().split('T')[0]
        });
        setEditingTransactionId(null);
        setShowConfirm(false);
        loadTransactions(); // Reload after editing
      });
      setShowConfirm(true);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-full relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-indigo-600 text-white p-2 rounded-full shadow-md hover:bg-indigo-700 transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 flex space-x-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search transactions by note..."
            className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 text-sm shadow-sm bg-white"
          />
        </div>
        <select
          value={filterType}
          onChange={handleFilterChange}
          className="block w-32 px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 text-sm shadow-sm bg-white"
        >
          <option value="all">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </div>

      <div className="space-y-3">
        {transactions.map((t) => {
          const category = categories.find((c) => c.id === t.categoryId);
          const isIncome = t.type === 'income';
          return (
            <div 
              key={t.id} 
              onClick={() => setViewingTransaction(t)}
              className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: category?.color || '#ccc' }}
                >
                  {isIncome ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <p className="font-semibold text-gray-900 truncate">{category?.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500 line-clamp-2">{t.note || t.date}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 shrink-0">
                <div className={`font-bold ${isIncome ? 'text-emerald-600' : 'text-gray-900'}`}>
                  {isIncome ? '+' : '-'}${t.amount.toLocaleString()}
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(t);
                  }}
                  className="text-gray-400 hover:text-indigo-600 transition-colors"
                >
                  <Edit2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
        {transactions.length === 0 && !isLoading && (
          <p className="text-center text-gray-500 mt-10">
            {searchQuery ? 'No transactions found matching your search.' : 'No transactions yet.'}
          </p>
        )}
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="animate-spin text-indigo-600" size={24} />
          </div>
        )}
        {transactions.length < totalTransactions && !isLoading && (
          <div className="pt-4 pb-8 flex justify-center">
            <button
              onClick={handleLoadMore}
              className="px-6 py-2 bg-white border border-gray-200 text-gray-700 font-medium rounded-full shadow-sm hover:bg-gray-50 transition-colors"
            >
              Load More ({transactions.length} of {totalTransactions})
            </button>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">New Transaction</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${type === 'expense' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${type === 'income' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                >
                  Income
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                    className="block w-full pl-7 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 text-lg font-semibold"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="" disabled>Select a category</option>
                  {filteredCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Detailed Note</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  placeholder="Add a detailed description..."
                  rows={3}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mt-6"
              >
                Save Transaction
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTransactionId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Edit Transaction</h2>
              <button onClick={() => setEditingTransactionId(null)} className="text-gray-400 hover:text-gray-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setEditType('expense');
                    setEditCategoryId('');
                  }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${editType === 'expense' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditType('income');
                    setEditCategoryId('');
                  }}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${editType === 'income' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                >
                  Income
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                    className="block w-full pl-7 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 text-lg font-semibold"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <select
                  required
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                  className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="" disabled>Select a category</option>
                  {editFilteredCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Detailed Note</label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  placeholder="Add a detailed description..."
                  rows={3}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mt-6"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {viewingTransaction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Transaction Details</h2>
              <button onClick={() => setViewingTransaction(null)} className="text-gray-400 hover:text-gray-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            
            {(() => {
              const category = categories.find(c => c.id === viewingTransaction.categoryId);
              const isIncome = viewingTransaction.type === 'income';
              return (
                <div className="space-y-6">
                  <div className="flex items-center justify-center">
                    <div 
                      className="w-16 h-16 rounded-full flex items-center justify-center text-white shrink-0 shadow-md"
                      style={{ backgroundColor: category?.color || '#ccc' }}
                    >
                      {isIncome ? <ArrowDownRight size={32} /> : <ArrowUpRight size={32} />}
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${isIncome ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {isIncome ? '+' : '-'}${viewingTransaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-gray-500 font-medium mt-1">{category?.name || 'Unknown Category'}</p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-4 border border-gray-100">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Date</span>
                      <span className="text-sm font-medium text-gray-900">{viewingTransaction.date}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Type</span>
                      <span className="text-sm font-medium text-gray-900 capitalize">{viewingTransaction.type}</span>
                    </div>
                    {viewingTransaction.note && (
                      <div className="pt-4 border-t border-gray-200">
                        <span className="text-sm text-gray-500 block mb-1">Note</span>
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{viewingTransaction.note}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-3 pt-2">
                    <button
                      onClick={() => {
                        setViewingTransaction(null);
                        openEditModal(viewingTransaction);
                      }}
                      className="flex-1 py-3 px-4 border border-gray-200 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center justify-center"
                    >
                      <Edit2 size={16} className="mr-2" />
                      Edit
                    </button>
                    <button
                      onClick={() => setViewingTransaction(null)}
                      className="flex-1 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Action</h3>
            <p className="text-gray-600 text-sm mb-6">{confirmMessage}</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmAction && confirmAction()}
                className="flex-1 py-3 px-4 border border-transparent rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
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
