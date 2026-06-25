import { Router } from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/transactions', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT t.*, i.name as item_name, i.code as item_code, i.unit as item_unit, i.type as item_type 
      FROM transactions t 
      JOIN items i ON t.item_id = i.id 
      WHERE t.is_deleted = 0
      ORDER BY t.date DESC, t.id DESC
      LIMIT 100
    `);
    res.json(stmt.all());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/transactions/:id', (req, res) => {
  try {
    const txId = req.params.id;
    const dbTx = db.transaction(() => {
      const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId) as any;
      if (!transaction) return;

      if (transaction.type === 'in') {
        db.prepare('UPDATE items SET current_stock = current_stock - ? WHERE id = ?').run(transaction.quantity, transaction.item_id);
      } else {
        db.prepare('UPDATE items SET current_stock = current_stock + ? WHERE id = ?').run(transaction.quantity, transaction.item_id);
      }

      db.prepare('DELETE FROM transactions WHERE id = ?').run(txId);
    });
    dbTx();
    res.json({ success: true });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
