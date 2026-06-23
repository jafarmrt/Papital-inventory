import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import db from './src/db.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  // ======== API Routes ========
  
  // Get all items (products or raw materials)
  app.get('/api/items', (req, res) => {
    try {
      const type = req.query.type;
      let query = 'SELECT * FROM items WHERE is_deleted = 0';
      const params: any[] = [];
      if (typeof type === 'string' && (type === 'product' || type === 'raw_material')) {
        query += ' AND type = ?';
        params.push(type);
      }
      query += ' ORDER BY id DESC';
      const stmt = db.prepare(query);
      const items = stmt.all(...params);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create an item
  app.post('/api/items', (req, res) => {
    try {
      const { type, name, code, unit, category, image, thumbnail, reorder_point, weighted_average_cost } = req.body;
      
      const existing = db.prepare('SELECT id FROM items WHERE code = ? AND is_deleted = 0').get(code);
      if (existing) {
        return res.status(400).json({ error: 'کد کالا تکراری است و مجاز به استفاده مجدد نیستید.' });
      }

      const warehouses = db.prepare('SELECT code FROM warehouses').all() as { code: string }[];
      let computedStock = 0;
      const stockValues: Record<string, number> = {};
      
      for (const wh of warehouses) {
        const bodyKey = `stock_${wh.code}`;
        const val = req.body[bodyKey] !== undefined ? Number(req.body[bodyKey]) : 0;
        stockValues[bodyKey] = val;
        computedStock += val;
      }

      const columns = ['type', 'name', 'code', 'current_stock', 'unit', 'category', 'image', 'thumbnail', 'reorder_point', 'weighted_average_cost', 'is_deleted'];
      const values: any[] = [type, name, code, computedStock, unit, category || '', image || '', thumbnail || '', Number(reorder_point || 0), Number(weighted_average_cost || 0), 0];
      
      for (const wh of warehouses) {
        columns.push(`stock_${wh.code}`);
        values.push(stockValues[`stock_${wh.code}`]);
      }

      const placeholders = columns.map(() => '?').join(', ');
      const stmt = db.prepare(`
        INSERT INTO items (${columns.join(', ')}) 
        VALUES (${placeholders})
      `);
      const info = stmt.run(...values);
      res.json({ id: info.lastInsertRowid, type, name, code, current_stock: computedStock, unit, category, image, thumbnail, ...stockValues, reorder_point, weighted_average_cost });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update item
  app.put('/api/items/:id', (req, res) => {
    try {
      const { name, code, unit, category, image, thumbnail, reorder_point, weighted_average_cost } = req.body;

      const existing = db.prepare('SELECT id FROM items WHERE code = ? AND id != ? AND is_deleted = 0').get(code, req.params.id);
      if (existing) {
        return res.status(400).json({ error: 'کد کالا تکراری است و متعلق به محصول دیگری می باشد.' });
      }

      const warehouses = db.prepare('SELECT code FROM warehouses').all() as { code: string }[];
      let computedStock = 0;
      const stockFieldsToUpdate: string[] = [];
      const updateValues: any[] = [name, code, unit, category || '', image || '', thumbnail || ''];

      for (const wh of warehouses) {
        const bodyKey = `stock_${wh.code}`;
        const val = req.body[bodyKey] !== undefined ? Number(req.body[bodyKey]) : 0;
        computedStock += val;
        stockFieldsToUpdate.push(`stock_${wh.code} = ?`);
        updateValues.push(val);
      }

      updateValues.push(computedStock, Number(reorder_point || 0), Number(weighted_average_cost || 0), req.params.id);

      const query = `
        UPDATE items 
        SET name = ?, code = ?, unit = ?, category = ?, image = ?, thumbnail = ?, ${stockFieldsToUpdate.join(', ')}, current_stock = ?, reorder_point = ?, weighted_average_cost = ? 
        WHERE id = ?
      `;
      db.prepare(query).run(...updateValues);
      res.json({ success: true });
    } catch(err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Soft Delete Item
  app.delete('/api/items/:id', (req, res) => {
    try {
      db.prepare('UPDATE items SET is_deleted = 1 WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get transactions
  app.get('/api/transactions', (req, res) => {
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

  // Get Next Doc Ref Number
  app.get('/api/documents/next-ref', (req, res) => {
    try {
      const type = req.query.type as string; // 'in' or 'out' or 'audit'
      let nextNum = 1;
      let startNumber = 1;

      if (type === 'out') {
        const startSetting = db.prepare("SELECT value FROM app_settings WHERE key = 'invoice_start_number'").get() as any;
        if (startSetting && !isNaN(parseInt(startSetting.value, 10))) {
          startNumber = parseInt(startSetting.value, 10);
        }
      }

      const doc = db.prepare('SELECT MAX(CAST(ref_number AS INTEGER)) as maxNum FROM documents WHERE type = ? AND is_deleted = 0').get(type) as any;
      if (doc && doc.maxNum && doc.maxNum >= startNumber) {
        nextNum = doc.maxNum + 1;
      } else {
        nextNum = startNumber;
      }

      res.json({ nextRef: nextNum.toString() });
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  // Create document & transactions
  app.post('/api/documents', (req, res) => {
    try {
      const { 
        docType, refNumber, date, items, user, inOut,
        buyer_name, buyer_city, buyer_phone, buyer_address,
        status, notes, location
      } = req.body;

      const docStatus = status || 'final';
      const docLocation = location || 'safe'; // 'safe', 'workshop', 'showroom'

      const tx = db.transaction(() => {
        // 1. Insert Document
        const docStmt = db.prepare(`
          INSERT INTO documents (type, ref_number, date, user, notes, buyer_name, buyer_city, buyer_phone, buyer_address, status, is_deleted) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `);
        const docInfo = docStmt.run(docType, refNumber, date, user, notes || '', buyer_name || '', buyer_city || '', buyer_phone || '', buyer_address || '', docStatus);
        const docId = docInfo.lastInsertRowid;

        // 2. Handle Items & Inventory Updates
        if (docType === 'audit') {
          // INTERPRET PERIODIC AUDIT
          const warehouses = db.prepare('SELECT code FROM warehouses').all() as { code: string }[];
          const sumQuery = warehouses.map(w => `COALESCE(stock_${w.code}, 0)`).join(' + ');

          for (const item of items) {
            const { itemId, system_stock, physical_stock, location: itemLoc } = item;
            const targetLoc = itemLoc || docLocation;
            const variance = Number(physical_stock) - Number(system_stock);
            const stockCol = 'stock_' + targetLoc;

            // Log discrepancy in document items
            db.prepare(`
              INSERT INTO document_items (document_id, item_id, quantity, unit_price, discount, location) 
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(docId, itemId, physical_stock, 0, 0, targetLoc);

            if (variance !== 0) {
              const txType = variance > 0 ? 'in' : 'out';
              const absVariance = Math.abs(variance);
              const txNotes = variance > 0 ? 'اضافی انبارگردانی دوره‌ای' : 'کسری انبارگردانی دوره‌ای';

              // insert discrepancy transaction
              const txStmt = db.prepare(`
                INSERT INTO transactions (item_id, type, quantity, date, document_type, document_ref, user, notes, location, is_deleted) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
              `);
              txStmt.run(itemId, txType, absVariance, date, 'audit', refNumber, user, txNotes, targetLoc);

              // Set the location stock directly to match physical reality
              db.prepare(`
                UPDATE items 
                SET ${stockCol} = ?
                WHERE id = ?
              `).run(physical_stock, itemId);

              db.prepare(`
                UPDATE items 
                SET current_stock = ${sumQuery} 
                WHERE id = ?
              `).run(itemId);
            }
          }
        } else {
          // STANDARDS DOCUMENTS (receipt, invoice, remittance, waste, return)
          for (const item of items) {
            const { itemId, quantity, unit_price, discount, location: itemLoc } = item;
            const price = unit_price || 0;
            const disc = discount || 0;
            const qty = Number(quantity);
            const targetLoc = itemLoc || docLocation;
            const stockCol = 'stock_' + targetLoc;

            if (docStatus === 'final') {
              // Create transaction
              const txStmt = db.prepare(`
                INSERT INTO transactions (item_id, type, quantity, date, document_type, document_ref, user, location, is_deleted) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
              `);
              txStmt.run(itemId, inOut, qty, date, docType, refNumber, user, targetLoc);

              const dbItem = db.prepare('SELECT current_stock, weighted_average_cost FROM items WHERE id = ?').get(itemId) as any;
              
              if (inOut === 'in') {
                // WALKING AVERAGE COST calculation
                let newAvg = dbItem.weighted_average_cost;
                const prevStock = dbItem.current_stock;
                if (prevStock <= 0) {
                  newAvg = price;
                } else {
                  newAvg = ((prevStock * dbItem.weighted_average_cost) + (qty * price)) / (prevStock + qty);
                }

                // Increment location stock & Current total
                db.prepare(`
                  UPDATE items 
                  SET ${stockCol} = COALESCE(${stockCol}, 0) + ?, current_stock = current_stock + ?, weighted_average_cost = ? 
                  WHERE id = ?
                `).run(qty, qty, newAvg, itemId);
              } else {
                // Decrement location stock & Current total
                db.prepare(`
                  UPDATE items 
                  SET ${stockCol} = COALESCE(${stockCol}, 0) - ?, current_stock = current_stock - ? 
                  WHERE id = ?
                `).run(qty, qty, itemId);
              }
            }

            // Record document item details
            db.prepare(`
              INSERT INTO document_items (document_id, item_id, quantity, unit_price, discount, location) 
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(docId, itemId, qty, price, disc, targetLoc);
          }
        }
        return docId;
      });

      const newDocId = tx();
      res.json({ success: true, docId: newDocId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get active documents
  app.get('/api/documents', (req, res) => {
    try {
      const type = req.query.type;
      let docs;
      if (type) {
        docs = db.prepare('SELECT * FROM documents WHERE type = ? AND is_deleted = 0 ORDER BY id DESC').all(type);
      } else {
        docs = db.prepare('SELECT * FROM documents WHERE is_deleted = 0 ORDER BY id DESC').all();
      }
      res.json(docs);
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  // Get document details
  app.get('/api/documents/:id', (req, res) => {
    try {
      const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id) as any;
      if (!doc) return res.status(404).json({ error: 'یافت نشد' });

      // Support fallback if is_deleted
      const items = db.prepare(`
        SELECT di.*, i.name, i.code, i.unit, i.category
        FROM document_items di
        JOIN items i ON di.item_id = i.id
        WHERE di.document_id = ?
      `).all(doc.id);

      res.json({ ...doc, items });
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  // Finalize proforma invoice
  app.put('/api/documents/:id/finalize', (req, res) => {
    try {
      const docId = req.params.id;
      const { user } = req.body;
      const tx = db.transaction(() => {
        const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND is_deleted = 0').get(docId) as any;
        if (!doc || doc.status === 'final') return;

        db.prepare("UPDATE documents SET status = 'final' WHERE id = ?").run(docId);

        const items = db.prepare('SELECT * FROM document_items WHERE document_id = ?').all(docId) as any[];
        const inOut = 'out'; // pre-invoice transitions to outgoing invoice

        for (const item of items) {
          const { item_id, quantity, location: itemLoc } = item;
          const targetLoc = itemLoc || 'safe';
          const stockCol = 'stock_' + targetLoc;

          // insert transaction
          const txStmt = db.prepare(`
            INSERT INTO transactions (item_id, type, quantity, date, document_type, document_ref, user, location, is_deleted) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
          `);
          txStmt.run(item_id, inOut, quantity, doc.date, doc.type, doc.ref_number, user || doc.user, targetLoc);
          
          // update stock
          db.prepare(`
            UPDATE items 
            SET ${stockCol} = COALESCE(${stockCol}, 0) - ?, current_stock = current_stock - ? 
            WHERE id = ?
          `).run(quantity, quantity, item_id);
        }
      });
      tx();
      res.json({ success: true });
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  // Soft Delete Document
  app.delete('/api/documents/:id', (req, res) => {
    try {
      const docId = req.params.id;
      const tx = db.transaction(() => {
        const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND is_deleted = 0').get(docId) as any;
        if (!doc) return;

        // Mark document as deleted
        db.prepare('UPDATE documents SET is_deleted = 1 WHERE id = ?').run(docId);

        // Mark associated transactions as deleted
        db.prepare('UPDATE transactions SET is_deleted = 1 WHERE document_ref = ? AND document_type = ?').run(doc.ref_number, doc.type);

        // Revert items stock
        const items = db.prepare('SELECT * FROM document_items WHERE document_id = ?').all(docId) as any[];
        const inOut = (doc.type === 'receipt' || doc.type === 'return') ? 'in' : 'out';

        if (doc.status === 'final') {
          for (const item of items) {
            const qty = Number(item.quantity);
            const targetLoc = item.location || 'safe';
            const stockCol = 'stock_' + targetLoc;

            if (inOut === 'in') {
              // we added stock, now we take it out
              db.prepare(`
                UPDATE items 
                SET ${stockCol} = COALESCE(${stockCol}, 0) - ?, current_stock = current_stock - ? 
                WHERE id = ?
              `).run(qty, qty, item.item_id);
            } else {
              // we subtracted stock, now we put it back
              db.prepare(`
                UPDATE items 
                SET ${stockCol} = COALESCE(${stockCol}, 0) + ?, current_stock = current_stock + ? 
                WHERE id = ?
              `).run(qty, qty, item.item_id);
            }
          }
        }
      });
      tx();
      res.json({ success: true });
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  // Dashboard stats
  app.get('/api/stats', (req, res) => {
    try {
      const totalProducts = db.prepare("SELECT count(*) as count FROM items WHERE type='product' AND is_deleted = 0").get() as any;
      const totalMaterials = db.prepare("SELECT count(*) as count FROM items WHERE type='raw_material' AND is_deleted = 0").get() as any;
      const lowStock = db.prepare("SELECT count(*) as count FROM items WHERE is_deleted = 0 AND current_stock <= COALESCE(reorder_point, 5)").get() as any;
      const recentTx = db.prepare("SELECT count(*) as count FROM transactions WHERE is_deleted = 0 AND date >= date('now', '-7 days')").get() as any;

      const userCountQuery = db.prepare("SELECT count(*) as count FROM users").get() as any;

      res.json({
        totalProducts: totalProducts.count,
        totalMaterials: totalMaterials.count,
        lowStock: lowStock.count,
        recentTx: recentTx.count,
        activeUsers: userCountQuery.count
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Business Intelligence dashboard-bi-stats
  app.get('/api/dashboard-bi-stats', (req, res) => {
    try {
      // Fetch dynamic thresholds from app_settings
      const fastMovingSetting = db.prepare("SELECT value FROM app_settings WHERE key = 'fast_moving_days'").get() as any;
      const slowMovingSetting = db.prepare("SELECT value FROM app_settings WHERE key = 'slow_moving_days'").get() as any;
      const deadStockSetting = db.prepare("SELECT value FROM app_settings WHERE key = 'dead_stock_days'").get() as any;
      const fastDays = fastMovingSetting ? parseInt(fastMovingSetting.value, 10) : 30;
      const slowDays = slowMovingSetting ? parseInt(slowMovingSetting.value, 10) : 90;
      const deadDays = deadStockSetting ? parseInt(deadStockSetting.value, 10) : 180;

      // 1. Reorder Alarms
      const alarms = db.prepare(`
        SELECT id, name, code, current_stock, reorder_point, unit, type
        FROM items
        WHERE is_deleted = 0 AND current_stock <= reorder_point AND reorder_point > 0
        ORDER BY current_stock ASC
      `).all();

      // 2. Fast Moving Items (based on dynamic fast_moving_days setting)
      const fastMoving = db.prepare(`
        SELECT i.id, i.name, i.code, i.unit, SUM(t.quantity) as total_qty, i.current_stock
        FROM transactions t
        JOIN items i ON t.item_id = i.id
        WHERE t.type = 'out' AND t.is_deleted = 0 AND t.date >= date('now', '-' || ? || ' days')
        GROUP BY i.id
        ORDER BY total_qty DESC
        LIMIT 5
      `).all(fastDays);

      // 3. Slow Moving Items (lack of out transactions in slow_moving_days but has some in dead_stock_days)
      const slowMoving = db.prepare(`
        SELECT id, name, code, current_stock, unit, weighted_average_cost
        FROM items
        WHERE is_deleted = 0 AND current_stock > 0 
          AND id NOT IN (
            SELECT DISTINCT item_id FROM transactions t
            WHERE t.type = 'out' AND t.is_deleted = 0 AND t.date >= date('now', '-' || ? || ' days')
          )
          AND id IN (
            SELECT DISTINCT item_id FROM transactions t
            WHERE t.type = 'out' AND t.is_deleted = 0 AND t.date >= date('now', '-' || ? || ' days')
          )
        ORDER BY current_stock DESC
        LIMIT 5
      `).all(slowDays, deadDays);

      // 4. Dead Stock (positive inventory but 0 'out' transactions in last dead_stock_days)
      const deadStock = db.prepare(`
        SELECT id, name, code, current_stock, unit, weighted_average_cost
        FROM items
        WHERE is_deleted = 0 AND current_stock > 0 
          AND id NOT IN (
            SELECT DISTINCT item_id FROM transactions t
            WHERE t.type = 'out' AND t.is_deleted = 0 AND t.date >= date('now', '-' || ? || ' days')
          )
        ORDER BY current_stock DESC
        LIMIT 5
      `).all(deadDays);

      // 5. Warehouse Valuation using Moving Average Cost
      const valuation = db.prepare(`
        SELECT SUM(current_stock * COALESCE(weighted_average_cost, 0)) as total_value
        FROM items
        WHERE is_deleted = 0
      `).get() as any;

      // 6. Locations stock distribution
      const warehouses = db.prepare('SELECT name, code FROM warehouses WHERE is_active = 1').all() as { name: string, code: string }[];
      const selectParts = warehouses.map(w => `SUM(COALESCE(stock_${w.code}, 0)) as stock_${w.code}`).join(', ');
      
      const distributionObj: Record<string, number> = {};
      if (selectParts) {
        const distributions = db.prepare(`
          SELECT ${selectParts}
          FROM items 
          WHERE is_deleted = 0
        `).get() as any || {};
        
        for (const w of warehouses) {
          distributionObj[w.code] = distributions[`stock_${w.code}`] || 0;
        }
      }

      // 7. Monthly Transaction Trends (in vs out over last 6 months)
      const trends = db.prepare(`
        SELECT strftime('%Y-%m', date) as month, type, SUM(quantity) as total
        FROM transactions
        WHERE is_deleted = 0 AND date >= date('now', '-6 months')
        GROUP BY month, type
        ORDER BY month ASC
      `).all();

      res.json({
        reorderAlarms: alarms,
        fastMoving,
        slowMoving,
        deadStock,
        totalValuation: valuation?.total_value || 0,
        locations: distributionObj,
        warehouses,
        monthlyTrends: trends,
        fastDays,
        slowDays,
        deadDays
      });
    } catch(err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Login
  app.post('/api/login', (req, res) => {
    try {
      const { username, password } = req.body;
      const tUsername = (username || '').trim();
      const user = db.prepare('SELECT id, username, full_name, role FROM users WHERE username = ? AND password = ?').get(tUsername, password);
      
      if (user) {
        res.json({ success: true, user });
      } else {
        res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Users Management
  app.get('/api/users', (req, res) => {
    try {
      const users = db.prepare('SELECT id, username, full_name, role FROM users ORDER BY id DESC').all();
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/users', (req, res) => {
    try {
      const { username, password, full_name, role } = req.body;
      const tUsername = (username || '').trim();
      const stmt = db.prepare('INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)');
      const info = stmt.run(tUsername, password, full_name, role);
      res.json({ id: info.lastInsertRowid, username: tUsername, full_name, role });
    } catch (err: any) {
      if (err.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: 'نام کاربری تکراری است' });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  app.put('/api/users/:id', (req, res) => {
    try {
      const { password, full_name, role } = req.body;
      if (password) {
        db.prepare('UPDATE users SET password = ?, full_name = ?, role = ? WHERE id = ?').run(password, full_name, role, req.params.id);
      } else {
        db.prepare('UPDATE users SET full_name = ?, role = ? WHERE id = ?').run(full_name, role, req.params.id);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/users/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Categories Mgt
  app.get('/api/categories', (req, res) => {
    try {
      res.json(db.prepare('SELECT * FROM categories ORDER BY type ASC, id ASC').all());
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/categories', (req, res) => {
    try {
      const { name, prefix, type } = req.body;
      const info = db.prepare('INSERT INTO categories (name, prefix, type) VALUES (?, ?, ?)').run(name, prefix, type);
      res.json({ id: info.lastInsertRowid, name, prefix, type });
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/categories/:id', (req, res) => {
    try {
      const { name, prefix, type } = req.body;
      db.prepare('UPDATE categories SET name = ?, prefix = ?, type = ? WHERE id = ?').run(name, prefix, type, req.params.id);
      res.json({ success: true });
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/categories/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/categories/next-code', (req, res) => {
    try {
      const { prefix } = req.query;
      if (!prefix) return res.json({ nextCode: '' });
      
      const likeQuery = `${prefix}%`;
      const items = db.prepare('SELECT code FROM items WHERE code LIKE ?').all(likeQuery) as any[];
      
      let maxNum = 0;
      for (const it of items) {
        const numPart = it.code.substring((prefix as string).length);
        const num = parseInt(numPart, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
      
      const nextNum = maxNum + 1;
      const nextCode = `${prefix}${nextNum.toString().padStart(3, '0')}`;
      res.json({ nextCode });
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  // Warehouses Management API
  app.get('/api/warehouses', (req, res) => {
    try {
      res.json(db.prepare('SELECT * FROM warehouses WHERE is_active = 1').all());
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/warehouses', (req, res) => {
    try {
      const { name, code } = req.body;
      const cleanCode = code.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (!cleanCode) {
        return res.status(400).json({ error: 'کد انبار نامعتبر است' });
      }

      // Automatically run migration on SQLite to add column to items table
      try {
        db.exec(`ALTER TABLE items ADD COLUMN stock_${cleanCode} REAL DEFAULT 0`);
      } catch(e: any) {
        // If column exists already, it's fine!
      }

      const info = db.prepare('INSERT INTO warehouses (name, code, is_active) VALUES (?, ?, 1)').run(name, cleanCode);
      res.json({ id: info.lastInsertRowid, name, code: cleanCode, is_active: 1 });
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/warehouses/:id', (req, res) => {
    try {
      const { name } = req.body;
      db.prepare('UPDATE warehouses SET name = ? WHERE id = ?').run(name, req.params.id);
      res.json({ success: true });
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/warehouses/:id', (req, res) => {
    try {
      const wh = db.prepare('SELECT code FROM warehouses WHERE id = ?').get(req.params.id) as any;
      if (wh && wh.code === 'safe') {
        return res.status(400).json({ error: 'امکان حذف انبار اصلی سیستم وجود ندارد' });
      }
      db.prepare('UPDATE warehouses SET is_active = 0 WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/items/next-product-code', (req, res) => {
    try {
      const { year, prefix, transfer } = req.query;
      // format: start = `1403-N-001-`
      const baseCode = `${year}-${prefix}-${transfer}-`;
      const likeQuery = `${baseCode}%`;
      const items = db.prepare('SELECT code FROM items WHERE code LIKE ?').all(likeQuery) as any[];
      
      let maxNum = 0;
      for (const it of items) {
        const numPart = it.code.substring(baseCode.length);
        const num = parseInt(numPart, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
      
      const nextNum = maxNum + 1;
      const nextCode = `${baseCode}${nextNum.toString().padStart(2, '0')}`;
      res.json({ nextCode });
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  // Admin clear data / edit transactions
  app.delete('/api/transactions/:id', (req, res) => {
    try {
      const txId = req.params.id;
      const dbTx = db.transaction(() => {
        const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId) as any;
        if (!transaction) return;

        // Revert stock
        if (transaction.type === 'in') {
          db.prepare('UPDATE items SET current_stock = current_stock - ? WHERE id = ?').run(transaction.quantity, transaction.item_id);
        } else {
          db.prepare('UPDATE items SET current_stock = current_stock + ? WHERE id = ?').run(transaction.quantity, transaction.item_id);
        }

        // Delete the tx
        db.prepare('DELETE FROM transactions WHERE id = ?').run(txId);
      });
      dbTx();
      res.json({ success: true });
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/admin/clear-data', (req, res) => {
    try {
      const { mode } = req.body;
      const clearTx = db.transaction(() => {
        if (mode === 'transactions') {
          db.prepare('DELETE FROM transactions').run();
          db.prepare('DELETE FROM document_items').run();
          db.prepare('DELETE FROM documents').run();
          db.prepare('UPDATE items SET current_stock = 0').run();
        } else if (mode === 'all') {
          db.prepare('DELETE FROM transactions').run();
          db.prepare('DELETE FROM document_items').run();
          db.prepare('DELETE FROM documents').run();
          db.prepare('DELETE FROM items').run();
          db.prepare('DELETE FROM warehouses').run();
          db.prepare("INSERT INTO warehouses (name, code, is_active) VALUES ('انبار اصلی', 'safe', 1)").run();
        }
      });
      clearTx();
      res.json({ success: true });
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  // App Settings
  app.get('/api/settings', (req, res) => {
    try {
      const settings = db.prepare('SELECT key, value FROM app_settings').all();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/settings', (req, res) => {
    try {
      const { settings } = req.body;
      const updateStmt = db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
      const updateTx = db.transaction((settingsList) => {
        for (const item of settingsList) {
          updateStmt.run(item.key, item.value);
        }
      });
      updateTx(settings);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Changelogs
  app.get('/api/changelogs', (req, res) => {
    try {
      const logs = db.prepare('SELECT * FROM changelogs ORDER BY id DESC').all();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ======== Vite Middleware ========
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      app.get('*', (req, res) => {
        res.status(404).send('Not built yet');
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
