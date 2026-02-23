'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Trash2, Upload } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';

export default function ExpensesPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryInput, setCategoryInput] = useState('');
  const [categories, setCategories] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      loadExpenses();
      loadCategories();
    }
  }, [mounted]);

  const loadExpenses = async () => {
    const companyHQId =
      typeof window !== 'undefined'
        ? localStorage.getItem('companyHQId') || localStorage.getItem('companyId')
        : null;

    if (!companyHQId) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/financials/expenses?companyHQId=${companyHQId}`
      );
      const result = await response.json();

      if (result.success) {
        setExpenses(result.expenses || []);
      }
    } catch (error) {
      console.error('Failed to load expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    const companyHQId =
      typeof window !== 'undefined'
        ? localStorage.getItem('companyHQId') || localStorage.getItem('companyId')
        : null;

    if (!companyHQId) return;

    try {
      const response = await fetch(
        `/api/financials/categories?companyHQId=${companyHQId}&type=expense`
      );
      const result = await response.json();

      if (result.success) {
        setCategories(result.categories || []);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleCategoryEdit = (expenseId, currentCategory) => {
    setEditingCategory(expenseId);
    setCategoryInput(currentCategory || '');
  };

  const handleCategorySave = async (expenseId) => {
    try {
      const response = await fetch(`/api/financials/expenses/${expenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: categoryInput }),
      });

      const result = await response.json();

      if (result.success) {
        setExpenses((prev) =>
          prev.map((e) => (e.id === expenseId ? result.expense : e))
        );
        setEditingCategory(null);
        loadCategories(); // Refresh categories
      }
    } catch (error) {
      console.error('Failed to update category:', error);
      alert('Failed to update category');
    }
  };

  const handleDelete = async (expenseId) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      const response = await fetch(`/api/financials/expenses/${expenseId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
      }
    } catch (error) {
      console.error('Failed to delete expense:', error);
      alert('Failed to delete expense');
    }
  };

  const formatAmount = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString();
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-2xl font-bold text-gray-900">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <PageHeader title="Expenses" subtitle="Track and categorize your expenses" />
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/financials/import')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
            <button
              onClick={() => router.push('/financials/expenses/new')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Expense
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading expenses...</div>
          </div>
        ) : expenses.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 mb-4">No expenses yet</p>
            <button
              onClick={() => router.push('/financials/expenses/new')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Your First Expense
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(expense.date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {expense.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatAmount(expense.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {editingCategory === expense.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={categoryInput}
                            onChange={(e) => setCategoryInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCategorySave(expense.id);
                              } else if (e.key === 'Escape') {
                                setEditingCategory(null);
                              }
                            }}
                            list={`categories-${expense.id}`}
                            className="border rounded px-2 py-1 text-sm w-48"
                            autoFocus
                          />
                          <datalist id={`categories-${expense.id}`}>
                            {categories.map((cat) => (
                              <option key={cat} value={cat} />
                            ))}
                          </datalist>
                          <button
                            onClick={() => handleCategorySave(expense.id)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCategoryEdit(expense.id, expense.category)}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {expense.category || 'Click to add category'}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {expense.vendor || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => router.push(`/financials/expenses/${expense.id}/edit`)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
