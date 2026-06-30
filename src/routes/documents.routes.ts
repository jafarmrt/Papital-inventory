import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { DocumentService } from '../services/document.service.js';

const router = Router();
router.use(authenticateToken);

const documentCreateSchema = z.object({
  body: z.object({
    docType: z.enum(['receipt', 'invoice', 'proforma', 'return', 'audit', 'transfer', 'remittance', 'waste']),
    refNumber: z.union([z.string(), z.number()]),
    date: z.string(),
    items: z.array(z.object({
      itemId: z.number(),
      quantity: z.union([z.number(), z.string()]).optional(),
      unit_price: z.union([z.number(), z.string()]).optional(),
      discount: z.union([z.number(), z.string()]).optional(),
      system_stock: z.union([z.number(), z.string()]).optional(),
      physical_stock: z.union([z.number(), z.string()]).optional(),
      location: z.string().optional()
    })).min(1, 'حداقل یک کالا باید ثبت شود'),
    user: z.string().optional(),
    inOut: z.enum(['in', 'out']).optional(),
    buyer_name: z.string().optional(),
    buyer_city: z.string().optional(),
    buyer_phone: z.string().optional(),
    buyer_address: z.string().optional(),
    status: z.enum(['draft', 'final']).optional(),
    notes: z.string().optional(),
    location: z.string().optional()
  })
});

router.get('/documents/next-ref', async (req, res) => {
  try {
    const type = req.query.type as string;
    const nextRef = await DocumentService.getNextRef(type);
    res.json({ nextRef });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/documents', authorize('admin', 'manager'), validate(documentCreateSchema), async (req, res) => {
  try {
    const newDocId = await DocumentService.createDocument(req.body);
    res.json({ success: true, docId: newDocId });
  } catch (err: any) {
    console.error("Error creating document:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/documents', async (req, res) => {
  try {
    const type = req.query.type as string;
    const formattedDocs = await DocumentService.getDocuments(type);
    res.json(formattedDocs);
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/documents/by-ref/:ref', async (req, res) => {
  try {
    const type = req.query.type as string;
    const ref = req.params.ref;
    const docs = await DocumentService.getDocuments(type);
    const docSummary = docs.find(d => d.ref_number === ref);
    if (!docSummary) {
      return res.status(404).json({ error: 'سند یافت نشد' });
    }
    const doc = await DocumentService.getDocumentById(docSummary.id);
    res.json(doc);
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/documents/:id', async (req, res) => {
  try {
    const doc = await DocumentService.getDocumentById(Number(req.params.id));
    if (!doc) return res.status(404).json({ error: 'یافت نشد' });
    res.json(doc);
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/documents/:id/finalize', authorize('admin', 'manager'), async (req, res) => {
  try {
    const docId = Number(req.params.id);
    const { user } = req.body;
    await DocumentService.finalizeDocument(docId, user);
    res.json({ success: true });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/documents/:id/notes', authorize('admin', 'manager'), async (req, res) => {
  try {
    const docId = Number(req.params.id);
    const { notes } = req.body;
    await DocumentService.updateDocumentNotes(docId, notes);
    res.json({ success: true });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/documents/:id', authorize('admin'), async (req, res) => {
  try {
    const docId = Number(req.params.id);
    await DocumentService.deleteDocument(docId);
    res.json({ success: true });
  } catch(err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
