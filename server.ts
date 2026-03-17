import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initDb } from './server/db';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

// Middleware to protect routes
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Helper function to restore data from Supabase to SQLite
async function restoreDataFromSupabase(db: any, supabase: any, userId: string) {
  // Categories
  const { data: sbCategories } = await supabase.from('categories').select('*').eq('userid', userId);
  if (sbCategories) {
    for (const cat of sbCategories) {
      await db.run(
        'INSERT OR REPLACE INTO categories (id, userId, name, type, color, icon, budget, budgetAlertThreshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [cat.id, cat.userid, cat.name, cat.type, cat.color, cat.icon, cat.budget, cat.budgetalertthreshold || null]
      );
    }
  }
  
  // Transactions
  const { data: sbTransactions } = await supabase.from('transactions').select('*').eq('userid', userId);
  if (sbTransactions) {
    for (const tx of sbTransactions) {
      await db.run(
        'INSERT OR REPLACE INTO transactions (id, userId, amount, type, categoryId, date, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [tx.id, tx.userid, tx.amount, tx.type, tx.categoryid, tx.date, tx.note]
      );
    }
  }
  
  // Debts
  const { data: sbDebts } = await supabase.from('debts').select('*').eq('userid', userId);
  if (sbDebts) {
    for (const debt of sbDebts) {
      await db.run(
        'INSERT OR REPLACE INTO debts (id, userId, name, totalAmount, paidAmount, dueDate, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [debt.id, debt.userid, debt.name, debt.totalamount, debt.paidamount, debt.duedate, debt.note]
      );
    }
    
    // Debt Payments
    if (sbDebts.length > 0) {
      const debtIds = sbDebts.map((d: any) => d.id);
      const { data: sbPayments } = await supabase.from('debt_payments').select('*').in('debtid', debtIds);
      if (sbPayments) {
        for (const pay of sbPayments) {
          await db.run(
            'INSERT OR REPLACE INTO debt_payments (id, debtId, amount, date, note) VALUES (?, ?, ?, ?, ?)',
            [pay.id, pay.debtid, pay.amount, pay.date, pay.note]
          );
        }
      }
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  const db = await initDb();

  // --- AUTH ROUTES ---
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { name, email, password } = req.body;
      
      const existingUser = await db.get('SELECT * FROM users WHERE email = ?', [email]);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already exists locally. Please login.' });
      }

      // Check Supabase to prevent duplicate emails with different IDs
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_KEY;
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: supabaseUsers } = await supabase
          .from('users')
          .select('email')
          .eq('email', email)
          .limit(1);
          
        if (supabaseUsers && supabaseUsers.length > 0) {
          return res.status(400).json({ error: 'Email already exists in cloud backup. Please login to restore your data.' });
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const id = Math.random().toString(36).substr(2, 9);

      await db.run(
        'INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)',
        [id, name, email, hashedPassword]
      );

      const token = jwt.sign({ id, email, name }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user: { id, name, email } });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      let user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
      
      // If user not found locally, try to restore from Supabase
      if (!user) {
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.VITE_SUPABASE_KEY;
        
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data: supabaseUsers } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .limit(1);
            
          if (supabaseUsers && supabaseUsers.length > 0) {
            const sbUser = supabaseUsers[0];
            const validPassword = await bcrypt.compare(password, sbUser.password);
            
            if (validPassword) {
              // Restore user to local DB
              await db.run(
                'INSERT INTO users (id, name, email, password, createdAt) VALUES (?, ?, ?, ?, ?)',
                [sbUser.id, sbUser.name, sbUser.email, sbUser.password, sbUser.createdat || new Date().toISOString()]
              );
              user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
              
              // Restore user's data
              await restoreDataFromSupabase(db, supabase, user.id);
            }
          }
        }
      }

      if (!user) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
      console.error('Login/Restore error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // --- API ROUTES (PROTECTED) ---

  // Categories
  app.get('/api/categories', authenticateToken, async (req: any, res) => {
    const categories = await db.all('SELECT * FROM categories WHERE userId = ?', [req.user.id]);
    res.json(categories);
  });

  app.post('/api/categories', authenticateToken, async (req: any, res) => {
    const { id, name, type, color, icon, budget, budgetAlertThreshold } = req.body;
    await db.run(
      'INSERT INTO categories (id, userId, name, type, color, icon, budget, budgetAlertThreshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.id, name, type, color, icon, budget, budgetAlertThreshold]
    );
    res.json({ success: true });
  });

  app.put('/api/categories/:id', authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const { name, type, color, icon, budget, budgetAlertThreshold } = req.body;
    
    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (type !== undefined) { updates.push('type = ?'); values.push(type); }
    if (color !== undefined) { updates.push('color = ?'); values.push(color); }
    if (icon !== undefined) { updates.push('icon = ?'); values.push(icon); }
    if (budget !== undefined) { updates.push('budget = ?'); values.push(budget); }
    if (budgetAlertThreshold !== undefined) { updates.push('budgetAlertThreshold = ?'); values.push(budgetAlertThreshold); }
    
    if (updates.length > 0) {
      updates.push('updatedAt = CURRENT_TIMESTAMP');
      values.push(id, req.user.id);
      await db.run(`UPDATE categories SET ${updates.join(', ')} WHERE id = ? AND userId = ?`, values);
    }
    res.json({ success: true });
  });

  app.delete('/api/categories/:id', authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
      // Check if there are any transactions associated with this category
      const countResult = await db.get(
        'SELECT COUNT(*) as count FROM transactions WHERE categoryId = ? AND userId = ?',
        [id, userId]
      );

      if (countResult && countResult.count > 0) {
        return res.status(400).json({ error: 'Cannot delete category because it has associated transactions.' });
      }

      const result = await db.run('DELETE FROM categories WHERE id = ? AND userId = ?', [id, userId]);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Category not found or unauthorized.' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({ error: 'Failed to delete category' });
    }
  });

  // Dashboard Stats
  app.get('/api/dashboard-stats', authenticateToken, async (req: any, res) => {
    const userId = req.user.id;
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const previousMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const previousMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevMonthStr = `${previousMonthYear}-${String(previousMonth + 1).padStart(2, '0')}`;

    try {
      // Total Income & Expense
      const totals = await db.all(
        'SELECT type, SUM(amount) as total FROM transactions WHERE userId = ? GROUP BY type',
        [userId]
      );
      const totalIncome = totals.find(t => t.type === 'income')?.total || 0;
      const totalExpense = totals.find(t => t.type === 'expense')?.total || 0;

      // Current Month Income & Expense
      const currentMonthTotals = await db.all(
        'SELECT type, SUM(amount) as total FROM transactions WHERE userId = ? AND date LIKE ? GROUP BY type',
        [userId, `${currentMonthStr}%`]
      );
      const currentMonthIncome = currentMonthTotals.find(t => t.type === 'income')?.total || 0;
      const currentMonthExpense = currentMonthTotals.find(t => t.type === 'expense')?.total || 0;

      // Previous Month Income & Expense
      const prevMonthTotals = await db.all(
        'SELECT type, SUM(amount) as total FROM transactions WHERE userId = ? AND date LIKE ? GROUP BY type',
        [userId, `${prevMonthStr}%`]
      );
      const prevMonthIncome = prevMonthTotals.find(t => t.type === 'income')?.total || 0;
      const prevMonthExpense = prevMonthTotals.find(t => t.type === 'expense')?.total || 0;

      // Expenses by Category
      const expensesByCategory = await db.all(`
        SELECT c.id, c.name, c.color, SUM(t.amount) as value
        FROM transactions t
        JOIN categories c ON t.categoryId = c.id
        WHERE t.userId = ? AND t.type = 'expense'
        GROUP BY c.id
        HAVING value > 0
      `, [userId]);

      // Budget Alerts (Current Month Spent per Category)
      const currentMonthSpentByCategory = await db.all(`
        SELECT categoryId, SUM(amount) as spent
        FROM transactions
        WHERE userId = ? AND type = 'expense' AND date LIKE ?
        GROUP BY categoryId
      `, [userId, `${currentMonthStr}%`]);

      // Past 6 Months Spent per Category
      const past6MonthsSpentByCategory = await db.all(`
        SELECT categoryId, strftime('%Y-%m', date) as monthStr, SUM(amount) as spent
        FROM transactions
        WHERE userId = ? AND type = 'expense' AND date >= date('now', 'start of month', '-5 months')
        GROUP BY categoryId, monthStr
      `, [userId]);

      res.json({
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
      console.error('Dashboard stats error:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });

  // Transactions
  app.get('/api/transactions', authenticateToken, async (req: any, res) => {
    const { limit, offset, search, type } = req.query;
    let query = 'SELECT * FROM transactions WHERE userId = ?';
    const params: any[] = [req.user.id];

    if (type && type !== 'all') {
      query += ' AND type = ?';
      params.push(type);
    }

    if (search) {
      query += ' AND note LIKE ?';
      params.push(`%${search}%`);
    }

    try {
      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countResult = await db.get(countQuery, params);
      const total = countResult ? countResult.total : 0;

      query += ' ORDER BY date DESC';

      if (limit) {
        query += ' LIMIT ?';
        params.push(Number(limit));
      }
      if (offset) {
        query += ' OFFSET ?';
        params.push(Number(offset));
      }

      const transactions = await db.all(query, params);
      res.json({ data: transactions, total });
    } catch (error) {
      console.error('Transactions fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  app.post('/api/transactions', authenticateToken, async (req: any, res) => {
    const { id, amount, type, categoryId, date, note } = req.body;
    await db.run(
      'INSERT INTO transactions (id, userId, amount, type, categoryId, date, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.id, amount, type, categoryId, date, note]
    );
    res.json({ success: true });
  });

  app.put('/api/transactions/:id', authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const { amount, type, categoryId, date, note } = req.body;
    
    const updates = [];
    const values = [];
    if (amount !== undefined) { updates.push('amount = ?'); values.push(amount); }
    if (type !== undefined) { updates.push('type = ?'); values.push(type); }
    if (categoryId !== undefined) { updates.push('categoryId = ?'); values.push(categoryId); }
    if (date !== undefined) { updates.push('date = ?'); values.push(date); }
    if (note !== undefined) { updates.push('note = ?'); values.push(note); }
    
    if (updates.length > 0) {
      updates.push('updatedAt = CURRENT_TIMESTAMP');
      values.push(id, req.user.id);
      await db.run(`UPDATE transactions SET ${updates.join(', ')} WHERE id = ? AND userId = ?`, values);
    }
    res.json({ success: true });
  });

  // Debts
  app.get('/api/debts', authenticateToken, async (req: any, res) => {
    const debts = await db.all('SELECT * FROM debts WHERE userId = ?', [req.user.id]);
    res.json(debts);
  });

  app.post('/api/debts', authenticateToken, async (req: any, res) => {
    const { id, name, totalAmount, paidAmount, dueDate, note, payments } = req.body;
    await db.run(
      'INSERT INTO debts (id, userId, name, totalAmount, paidAmount, dueDate, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.id, name, totalAmount, paidAmount || 0, dueDate, note]
    );
    
    if (payments && payments.length > 0) {
      for (const payment of payments) {
        await db.run(
          'INSERT INTO debt_payments (id, debtId, amount, date, note) VALUES (?, ?, ?, ?, ?)',
          [payment.id, id, payment.amount, payment.date, payment.note || 'Initial payment']
        );
      }
    }
    
    res.json({ success: true });
  });

  app.put('/api/debts/:id', authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const { name, totalAmount, paidAmount, dueDate, note } = req.body;
    
    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (totalAmount !== undefined) { updates.push('totalAmount = ?'); values.push(totalAmount); }
    if (paidAmount !== undefined) { updates.push('paidAmount = ?'); values.push(paidAmount); }
    if (dueDate !== undefined) { updates.push('dueDate = ?'); values.push(dueDate); }
    if (note !== undefined) { updates.push('note = ?'); values.push(note); }
    
    if (updates.length > 0) {
      updates.push('updatedAt = CURRENT_TIMESTAMP');
      values.push(id, req.user.id);
      await db.run(`UPDATE debts SET ${updates.join(', ')} WHERE id = ? AND userId = ?`, values);
    }
    res.json({ success: true });
  });

  app.get('/api/debts/:id/payments', authenticateToken, async (req: any, res) => {
    const { id: debtId } = req.params;
    const { limit, offset } = req.query;
    
    // Verify debt belongs to user
    const debt = await db.get('SELECT * FROM debts WHERE id = ? AND userId = ?', [debtId, req.user.id]);
    if (!debt) return res.status(404).json({ error: 'Debt not found' });

    try {
      const countResult = await db.get('SELECT COUNT(*) as count FROM debt_payments WHERE debtId = ?', [debtId]);
      const total = countResult ? countResult.count : 0;

      let query = 'SELECT * FROM debt_payments WHERE debtId = ? ORDER BY date DESC';
      const params: any[] = [debtId];

      if (limit) {
        query += ' LIMIT ?';
        params.push(Number(limit));
      }
      if (offset) {
        query += ' OFFSET ?';
        params.push(Number(offset));
      }

      const payments = await db.all(query, params);
      res.json({ data: payments, total });
    } catch (error) {
      console.error('Debt payments fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch debt payments' });
    }
  });

  app.post('/api/debts/:id/payments', authenticateToken, async (req: any, res) => {
    const { id: debtId } = req.params;
    const { id, amount, date, note } = req.body;
    
    // Verify debt belongs to user
    const debt = await db.get('SELECT * FROM debts WHERE id = ? AND userId = ?', [debtId, req.user.id]);
    if (!debt) return res.status(404).json({ error: 'Debt not found' });

    await db.run(
      'INSERT INTO debt_payments (id, debtId, amount, date, note) VALUES (?, ?, ?, ?, ?)',
      [id, debtId, amount, date, note]
    );
    
    await db.run(
      'UPDATE debts SET paidAmount = paidAmount + ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [amount, debtId]
    );
    
    res.json({ success: true });
  });

  app.put('/api/debts/:debtId/payments/:paymentId', authenticateToken, async (req: any, res) => {
    const { debtId, paymentId } = req.params;
    const { amount, date, note } = req.body;
    
    // Verify debt belongs to user
    const debt = await db.get('SELECT * FROM debts WHERE id = ? AND userId = ?', [debtId, req.user.id]);
    if (!debt) return res.status(404).json({ error: 'Debt not found' });

    const oldPayment = await db.get('SELECT * FROM debt_payments WHERE id = ? AND debtId = ?', [paymentId, debtId]);
    if (!oldPayment) return res.status(404).json({ error: 'Payment not found' });

    const amountDiff = Number(amount) - Number(oldPayment.amount);

    await db.run(
      'UPDATE debt_payments SET amount = ?, date = ?, note = ? WHERE id = ?',
      [amount, date, note, paymentId]
    );

    if (amountDiff !== 0) {
      await db.run(
        'UPDATE debts SET paidAmount = paidAmount + ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
        [amountDiff, debtId]
      );
    }
    
    res.json({ success: true });
  });

  app.delete('/api/debts/:debtId/payments/:paymentId', authenticateToken, async (req: any, res) => {
    const { debtId, paymentId } = req.params;
    
    // Verify debt belongs to user
    const debt = await db.get('SELECT * FROM debts WHERE id = ? AND userId = ?', [debtId, req.user.id]);
    if (!debt) return res.status(404).json({ error: 'Debt not found' });

    const oldPayment = await db.get('SELECT * FROM debt_payments WHERE id = ? AND debtId = ?', [paymentId, debtId]);
    if (!oldPayment) return res.status(404).json({ error: 'Payment not found' });

    await db.run('DELETE FROM debt_payments WHERE id = ?', [paymentId]);

    await db.run(
      'UPDATE debts SET paidAmount = paidAmount - ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [oldPayment.amount, debtId]
    );
    
    res.json({ success: true });
  });

  // --- BACKUP ROUTE ---
  app.post('/api/backup', authenticateToken, async (req: any, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return res.status(400).json({ error: 'Supabase credentials are not configured in environment variables.' });
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      const userId = req.user.id;

      // Fetch data from SQLite
      const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
      if (!user) {
        return res.status(400).json({ error: 'User data not found in local database. Cannot proceed with backup.' });
      }

      const categories = await db.all('SELECT * FROM categories WHERE userId = ?', [userId]);
      const transactions = await db.all('SELECT * FROM transactions WHERE userId = ?', [userId]);
      const debts = await db.all('SELECT * FROM debts WHERE userId = ?', [userId]);
      
      const debtPayments = await db.all(`
        SELECT dp.* FROM debt_payments dp
        JOIN debts d ON dp.debtId = d.id
        WHERE d.userId = ?
      `, [userId]);

      // Helper function to convert keys to lowercase and omit specific keys
      const formatForSupabase = (items: any[], omitKeys: string[]) => {
        return items.map(item => {
          const formatted: any = {};
          for (const key in item) {
            if (!omitKeys.includes(key)) {
              formatted[key.toLowerCase()] = item[key];
            }
          }
          return formatted;
        });
      };

      // Upsert to Supabase
      if (user) {
        // Include password and createdAt since they exist in the Supabase schema
        const usersToBackup = formatForSupabase([user], ['updatedAt']);
        const { error } = await supabase.from('users').upsert(usersToBackup);
        if (error) throw new Error(`Users backup failed: ${error.message}`);
      }

      // Fetch existing IDs from Supabase to handle deletions
      const { data: existingCategories } = await supabase.from('categories').select('id').eq('userid', userId);
      const { data: existingTransactions } = await supabase.from('transactions').select('id').eq('userid', userId);
      const { data: existingDebts } = await supabase.from('debts').select('id').eq('userid', userId);
      
      const existingDebtIds = existingDebts?.map(d => d.id) || [];
      const { data: existingDebtPayments } = existingDebtIds.length > 0 
        ? await supabase.from('debt_payments').select('id').in('debtid', existingDebtIds)
        : { data: [] };

      // Find IDs to delete (exist in Supabase but not locally)
      const categoryIdsToDelete = (existingCategories || []).map(c => c.id).filter(id => !categories.find(c => c.id === id));
      const transactionIdsToDelete = (existingTransactions || []).map(t => t.id).filter(id => !transactions.find(t => t.id === id));
      const debtIdsToDelete = (existingDebts || []).map(d => d.id).filter(id => !debts.find(d => d.id === id));
      const debtPaymentIdsToDelete = (existingDebtPayments || []).map(dp => dp.id).filter(id => !debtPayments.find(dp => dp.id === id));

      // Delete from Supabase (order matters for foreign keys)
      if (debtPaymentIdsToDelete.length > 0) {
        const { error } = await supabase.from('debt_payments').delete().in('id', debtPaymentIdsToDelete);
        if (error) console.error('Failed to delete debt payments from Supabase:', error);
      }
      if (transactionIdsToDelete.length > 0) {
        const { error } = await supabase.from('transactions').delete().in('id', transactionIdsToDelete);
        if (error) console.error('Failed to delete transactions from Supabase:', error);
      }
      if (debtIdsToDelete.length > 0) {
        const { error } = await supabase.from('debts').delete().in('id', debtIdsToDelete);
        if (error) console.error('Failed to delete debts from Supabase:', error);
      }
      if (categoryIdsToDelete.length > 0) {
        const { error } = await supabase.from('categories').delete().in('id', categoryIdsToDelete);
        if (error) console.error('Failed to delete categories from Supabase:', error);
      }

      if (categories.length > 0) {
        const categoriesToBackup = formatForSupabase(categories, ['budgetAlertThreshold', 'createdAt', 'updatedAt']);
        const { error } = await supabase.from('categories').upsert(categoriesToBackup);
        if (error) throw new Error(`Categories backup failed: ${error.message}`);
      }
      
      if (transactions.length > 0) {
        const transactionsToBackup = formatForSupabase(transactions, ['createdAt', 'updatedAt']);
        const { error } = await supabase.from('transactions').upsert(transactionsToBackup);
        if (error) throw new Error(`Transactions backup failed: ${error.message}`);
      }

      if (debts.length > 0) {
        const debtsToBackup = formatForSupabase(debts, ['createdAt', 'updatedAt']);
        const { error } = await supabase.from('debts').upsert(debtsToBackup);
        if (error) throw new Error(`Debts backup failed: ${error.message}`);
      }

      if (debtPayments.length > 0) {
        const debtPaymentsToBackup = formatForSupabase(debtPayments, ['createdAt', 'updatedAt']);
        const { error } = await supabase.from('debt_payments').upsert(debtPaymentsToBackup);
        if (error) throw new Error(`Debt payments backup failed: ${error.message}`);
      }

      res.json({ success: true, message: 'Backup successful' });
    } catch (error: any) {
      console.error('Backup error:', error);
      res.status(500).json({ error: error.message || 'Failed to backup data' });
    }
  });

  // --- RESTORE ROUTE ---
  app.post('/api/restore', authenticateToken, async (req: any, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return res.status(400).json({ error: 'Supabase credentials are not configured in environment variables.' });
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      const userId = req.user.id;

      await restoreDataFromSupabase(db, supabase, userId);

      res.json({ success: true, message: 'Restore successful' });
    } catch (error: any) {
      console.error('Restore error:', error);
      res.status(500).json({ error: error.message || 'Failed to restore data' });
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
