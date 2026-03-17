import React, { useState, useEffect, useCallback } from 'react';
import { useFinance } from '../FinanceContext';
import { Plus, Target, ChevronDown, ChevronUp, DollarSign, Edit2, Search, Download, MessageCircle, Loader2, Trash2 } from 'lucide-react';
import { Debt } from '../types';

const PaymentHistory: React.FC<{ debt: Debt }> = ({ debt }) => {
  const { fetchDebtPayments, editDebtPayment, deleteDebtPayment } = useFinance();
  const [payments, setPayments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);

  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  const loadPayments = useCallback(async (isLoadMore = false) => {
    setIsLoading(true);
    try {
      const limit = isLoadMore ? 5 : visibleCount;
      const offset = isLoadMore ? payments.length : 0;
      const result = await fetchDebtPayments(debt.id, limit, offset);
      
      if (isLoadMore) {
        setPayments(prev => [...prev, ...result.data]);
      } else {
        setPayments(result.data);
      }
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load payments", error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchDebtPayments, debt.id, visibleCount, payments.length]);

  useEffect(() => {
    loadPayments();
  }, [debt.paidAmount]);

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 5);
    loadPayments(true);
  };

  const startEdit = (payment: any) => {
    setEditingPaymentId(payment.id);
    setEditAmount(payment.amount.toString());
    setEditDate(payment.date);
    setEditNote(payment.note || '');
    setDeletingPaymentId(null);
  };

  const handleSaveEdit = async (paymentId: string) => {
    if (!editAmount || !editDate) return;
    await editDebtPayment(debt.id, paymentId, parseFloat(editAmount), editDate, editNote);
    setEditingPaymentId(null);
    loadPayments();
  };

  const handleDelete = async (paymentId: string) => {
    await deleteDebtPayment(debt.id, paymentId);
    setDeletingPaymentId(null);
    loadPayments();
  };

  const handleDownloadHistory = async () => {
    if (total === 0) return;

    try {
      // Fetch all payments for the CSV
      const result = await fetchDebtPayments(debt.id, total, 0);
      const allPayments = result.data;

      const headers = ['Date', 'Amount', 'Note'];
      const csvContent = [
        headers.join(','),
        ...allPayments.map(p => {
          const date = new Date(p.date).toLocaleDateString();
          const amount = p.amount.toString();
          const note = `"${(p.note || '').replace(/"/g, '""')}"`;
          return [date, amount, note].join(',');
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${debt.name.replace(/\s+/g, '_').toLowerCase()}_payment_history.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to download history", error);
    }
  };

  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment History</h4>
        {total > 0 && (
          <button
            onClick={handleDownloadHistory}
            className="text-xs flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg font-medium"
            title="Download History as CSV"
          >
            <Download size={12} />
            <span>Download CSV</span>
          </button>
        )}
      </div>
      
      {total === 0 && !isLoading ? (
        <p className="text-xs text-gray-400 italic">No payments logged yet.</p>
      ) : (
        <div className="space-y-2">
          {payments.map(payment => {
            if (editingPaymentId === payment.id) {
              return (
                <div key={payment.id} className="flex flex-col bg-white p-3 rounded-lg border border-indigo-200 shadow-sm space-y-2">
                  <div className="flex space-x-2">
                    <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="flex-1 border border-gray-200 p-1.5 rounded-md text-xs focus:ring-1 focus:ring-indigo-500 outline-none" />
                    <input type="number" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="w-24 border border-gray-200 p-1.5 rounded-md text-xs focus:ring-1 focus:ring-indigo-500 outline-none" placeholder="Amount" />
                  </div>
                  <input type="text" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Note (optional)" className="w-full border border-gray-200 p-1.5 rounded-md text-xs focus:ring-1 focus:ring-indigo-500 outline-none" />
                  <div className="flex justify-end space-x-2 pt-1">
                    <button onClick={() => setEditingPaymentId(null)} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">Cancel</button>
                    <button onClick={() => handleSaveEdit(payment.id)} className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors">Save</button>
                  </div>
                </div>
              );
            }

            if (deletingPaymentId === payment.id) {
              return (
                <div key={payment.id} className="flex flex-col bg-rose-50 p-3 rounded-lg border border-rose-200 space-y-2">
                  <p className="text-xs text-rose-800 font-medium">Delete this payment?</p>
                  <div className="flex justify-end space-x-2">
                    <button onClick={() => setDeletingPaymentId(null)} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
                    <button onClick={() => handleDelete(payment.id)} className="px-3 py-1.5 text-xs font-medium text-white bg-rose-600 rounded-md hover:bg-rose-700 transition-colors">Delete</button>
                  </div>
                </div>
              );
            }

            return (
              <div key={payment.id} className="group flex flex-col bg-gray-50 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors relative">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-600">
                    {new Date(payment.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-sm font-bold text-emerald-600">+${payment.amount.toLocaleString()}</span>
                </div>
                {payment.note && (
                  <p className="text-xs text-gray-500 mt-1.5 pr-12">{payment.note}</p>
                )}
                
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1 bg-gray-50 pl-2 rounded-md">
                  <button onClick={() => startEdit(payment)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors" title="Edit payment">
                    <Edit2 size={12} />
                  </button>
                  <button onClick={() => setDeletingPaymentId(payment.id)} className="p-1.5 text-gray-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors" title="Delete payment">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
          
          {isLoading && (
            <div className="flex justify-center py-2">
              <Loader2 className="animate-spin text-indigo-600" size={16} />
            </div>
          )}
          
          {payments.length < total && !isLoading && (
            <div className="pt-2 pb-2 flex justify-center">
              <button
                onClick={handleLoadMore}
                className="px-4 py-1.5 bg-white border border-gray-200 text-xs text-gray-700 font-medium rounded-full shadow-sm hover:bg-gray-50 transition-colors"
              >
                Load More ({payments.length} of {total})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function DebtsView() {
  const { debts, addDebt, editDebt, addDebtPayment } = useFinance();
  const [showAdd, setShowAdd] = useState(false);
  
  const [name, setName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');

  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);
  const [paymentModalDebtId, setPaymentModalDebtId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNote, setPaymentNote] = useState('');

  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTotalAmount, setEditTotalAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editNote, setEditNote] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paid'>('all');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && totalAmount && dueDate) {
      addDebt({
        name,
        totalAmount: parseFloat(totalAmount),
        paidAmount: parseFloat(paidAmount) || 0,
        dueDate,
        note,
        payments: parseFloat(paidAmount) > 0 ? [{
          id: Math.random().toString(36).substr(2, 9),
          amount: parseFloat(paidAmount),
          date: new Date().toISOString().split('T')[0]
        }] : []
      });
      setShowAdd(false);
      setName('');
      setTotalAmount('');
      setPaidAmount('');
      setDueDate('');
      setNote('');
    }
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentModalDebtId && paymentAmount && paymentDate) {
      addDebtPayment(paymentModalDebtId, parseFloat(paymentAmount), paymentDate, paymentNote);
      setPaymentModalDebtId(null);
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentNote('');
    }
  };

  const openEditModal = (debt: Debt) => {
    setEditingDebtId(debt.id);
    setEditName(debt.name);
    setEditTotalAmount(debt.totalAmount.toString());
    setEditDueDate(debt.dueDate);
    setEditNote(debt.note || '');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDebtId && editName && editTotalAmount && editDueDate) {
      editDebt(editingDebtId, {
        name: editName,
        totalAmount: parseFloat(editTotalAmount),
        dueDate: editDueDate,
        note: editNote
      });
      setEditingDebtId(null);
    }
  };

  const handleShareWhatsApp = (debt: Debt) => {
    const remaining = debt.totalAmount - debt.paidAmount;
    const dueDate = new Date(debt.dueDate).toLocaleDateString();
    const message = `Halo, ini detail tagihan untuk *${debt.name}*:\n\n` +
                    `Total Tagihan: $${debt.totalAmount.toLocaleString()}\n` +
                    `Sudah Dibayar: $${debt.paidAmount.toLocaleString()}\n` +
                    `Sisa Tagihan: $${remaining.toLocaleString()}\n` +
                    `Jatuh Tempo: ${dueDate}\n\n` +
                    `Terima kasih!`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const totalDebt = debts.reduce((sum, d) => sum + d.totalAmount, 0);
  const totalPaid = debts.reduce((sum, d) => sum + d.paidAmount, 0);
  const totalRemaining = totalDebt - totalPaid;

  const filteredDebts = debts.filter(debt => {
    const matchesSearch = debt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (debt.note || '').toLowerCase().includes(searchQuery.toLowerCase());
    const isPaidOff = debt.paidAmount >= debt.totalAmount;
    const matchesStatus = filterStatus === 'all' ||
                          (filterStatus === 'active' && !isPaidOff) ||
                          (filterStatus === 'paid' && isPaidOff);
    return matchesSearch && matchesStatus;
  });

  const selectedDebtForPayment = debts.find(d => d.id === paymentModalDebtId);
  const maxPayment = selectedDebtForPayment ? Math.max(0, selectedDebtForPayment.totalAmount - selectedDebtForPayment.paidAmount) : 0;

  return (
    <div className="p-6 bg-gray-50 min-h-full relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Debts & Loans</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-indigo-600 text-white p-2 rounded-full shadow-md hover:bg-indigo-700 transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-6 flex items-center space-x-4">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center">
          <Target size={24} />
        </div>
        <div>
          <p className="text-sm text-gray-500 font-medium">Total Remaining</p>
          <p className="text-2xl font-bold text-gray-900">${totalRemaining.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search debts..."
            className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 text-sm shadow-sm bg-white"
          />
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${filterStatus === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${filterStatus === 'active' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >
            Active
          </button>
          <button
            onClick={() => setFilterStatus('paid')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${filterStatus === 'paid' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >
            Paid
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredDebts.map((debt) => {
          const progress = Math.min(100, Math.round((debt.paidAmount / debt.totalAmount) * 100));
          const remaining = debt.totalAmount - debt.paidAmount;
          const isExpanded = expandedDebtId === debt.id;
          
          return (
            <div key={debt.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-gray-900">{debt.name}</h3>
                    <button 
                      onClick={() => handleShareWhatsApp(debt)}
                      className="text-gray-400 hover:text-green-500 transition-colors"
                      title="Share via WhatsApp"
                    >
                      <MessageCircle size={14} />
                    </button>
                    <button 
                      onClick={() => openEditModal(debt)}
                      className="text-gray-400 hover:text-indigo-600 transition-colors"
                      title="Edit Debt"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">Due: {new Date(debt.dueDate).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">${remaining.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">left of ${debt.totalAmount.toLocaleString()}</p>
                </div>
              </div>
              
              {debt.note && (
                <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded-lg border border-gray-100">{debt.note}</p>
              )}
              
              <div className="mt-4 mb-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-indigo-600">{progress}% Paid</span>
                  <span className="text-gray-500">${debt.paidAmount.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div 
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex space-x-2 border-t border-gray-100 pt-3 mt-2">
                <button 
                  onClick={() => setPaymentModalDebtId(debt.id)}
                  className="flex-1 flex items-center justify-center space-x-1 bg-indigo-50 text-indigo-600 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-100 transition-colors"
                >
                  <DollarSign size={14} />
                  <span>Log Payment</span>
                </button>
                <button 
                  onClick={() => setExpandedDebtId(isExpanded ? null : debt.id)}
                  className="flex-1 flex items-center justify-center space-x-1 bg-gray-50 text-gray-600 py-2 rounded-xl text-xs font-semibold hover:bg-gray-100 transition-colors"
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>History</span>
                </button>
              </div>

              {isExpanded && (
                <PaymentHistory debt={debt} />
              )}
            </div>
          );
        })}
        {filteredDebts.length === 0 && (
          <p className="text-center text-gray-500 mt-10">
            {debts.length === 0 ? 'No debts tracked yet.' : 'No debts match your filters.'}
          </p>
        )}
      </div>

      {/* Add Debt Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Add New Debt</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Debt Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. Car Loan"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Total Amount</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                    className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Already Paid</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                    className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Note (Optional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  placeholder="Add a note..."
                  rows={2}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mt-6"
              >
                Save Debt
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Debt Modal */}
      {editingDebtId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Edit Debt</h2>
              <button onClick={() => setEditingDebtId(null)} className="text-gray-400 hover:text-gray-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Debt Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. Car Loan"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Total Amount</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={editTotalAmount}
                  onChange={(e) => setEditTotalAmount(e.target.value)}
                  onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                  className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  required
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Note (Optional)</label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  placeholder="Add a note..."
                  rows={2}
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

      {/* Log Payment Modal */}
      {paymentModalDebtId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Log Payment</h2>
              <button onClick={() => setPaymentModalDebtId(null)} className="text-gray-400 hover:text-gray-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-medium text-gray-700">Payment Amount</label>
                  {selectedDebtForPayment && maxPayment > 0 && (
                    <button 
                      type="button"
                      onClick={() => setPaymentAmount(maxPayment.toString())}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Max: ${maxPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    required
                    min="0.01"
                    max={maxPayment > 0 ? maxPayment : undefined}
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                    className="block w-full pl-7 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 text-lg font-semibold"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Note (Optional)</label>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  placeholder="Add a note..."
                  rows={2}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mt-6"
              >
                Save Payment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
