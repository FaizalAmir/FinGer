import React, { useState } from 'react';
import { useFinance } from '../FinanceContext';
import { Plus, ArrowDownRight, ArrowUpRight, Edit2, Trash2 } from 'lucide-react';
import { TransactionType, Category } from '../types';

export default function CategoriesView() {
  const { categories, addCategory, editCategory, deleteCategory } = useFinance();
  const [showAdd, setShowAdd] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [name, setName] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [color, setColor] = useState('#3B82F6');

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<TransactionType>('expense');
  const [editColor, setEditColor] = useState('#3B82F6');

  const [categoryToDelete, setCategoryToDelete] = useState<{id: string, name: string} | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name) {
      addCategory({
        name,
        type,
        color,
        icon: 'tag' // Default icon for simplicity
      });
      setShowAdd(false);
      setName('');
      setColor('#3B82F6');
    }
  };

  const openEditModal = (category: Category) => {
    setEditingCategoryId(category.id);
    setEditName(category.name);
    setEditType(category.type);
    setEditColor(category.color);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategoryId && editName) {
      editCategory(editingCategoryId, {
        name: editName,
        type: editType,
        color: editColor
      });
      setEditingCategoryId(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setCategoryToDelete({ id, name });
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;
    
    setErrorMsg('');
    const result = await deleteCategory(categoryToDelete.id);
    if (!result.success) {
      setErrorMsg(result.error || 'Failed to delete category');
      setTimeout(() => setErrorMsg(''), 5000);
    }
    setCategoryToDelete(null);
  };

  const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#64748B'];

  return (
    <div className="p-6 bg-gray-50 min-h-full relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-indigo-600 text-white p-2 rounded-full shadow-md hover:bg-indigo-700 transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      {errorMsg && (
        <div className="mb-6 p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-sm font-medium">
          {errorMsg}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Expenses</h2>
          <div className="grid grid-cols-2 gap-3">
            {categories.filter(c => c.type === 'expense').map(c => (
              <div key={c.id} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0" style={{ backgroundColor: c.color }}>
                    <ArrowUpRight size={14} />
                  </div>
                  <span className="font-medium text-gray-900 text-sm truncate">{c.name}</span>
                </div>
                <div className="flex items-center space-x-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => openEditModal(c)}
                    className="text-gray-400 hover:text-indigo-600 transition-colors p-1.5 bg-gray-50 rounded-full"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(c.id, c.name)}
                    className="text-gray-400 hover:text-rose-600 transition-colors p-1.5 bg-gray-50 rounded-full"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Income</h2>
          <div className="grid grid-cols-2 gap-3">
            {categories.filter(c => c.type === 'income').map(c => (
              <div key={c.id} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0" style={{ backgroundColor: c.color }}>
                    <ArrowDownRight size={14} />
                  </div>
                  <span className="font-medium text-gray-900 text-sm truncate">{c.name}</span>
                </div>
                <div className="flex items-center space-x-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => openEditModal(c)}
                    className="text-gray-400 hover:text-indigo-600 transition-colors p-1.5 bg-gray-50 rounded-full"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(c.id, c.name)}
                    className="text-gray-400 hover:text-rose-600 transition-colors p-1.5 bg-gray-50 rounded-full"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Category Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">New Category</h2>
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
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. Groceries"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Color</label>
                <div className="flex space-x-3">
                  {colors.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mt-6"
              >
                Save Category
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCategoryId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Edit Category</h2>
              <button onClick={() => setEditingCategoryId(null)} className="text-gray-400 hover:text-gray-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setEditType('expense')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${editType === 'expense' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setEditType('income')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${editType === 'income' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                >
                  Income
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. Groceries"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Color</label>
                <div className="flex space-x-3">
                  {colors.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`w-8 h-8 rounded-full transition-transform ${editColor === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
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

      {/* Delete Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete Category</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete the category "{categoryToDelete.name}"?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setCategoryToDelete(null)}
                className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 px-4 border border-transparent rounded-xl text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
