import express from 'express';
import Email from '../models/Email.js';

const router = express.Router();

// 1. קבלת כל המיילים (מהחדש לישן)
router.get('/', async (req, res) => {
  try {
    const emails = await Email.find().sort({ receivedAt: -1 });
    res.json(emails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. עדכון סטטוס (למשל מ"חדש" ל"בטיפול")
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const email = await Email.findByIdAndUpdate(
        req.params.id, 
        { status }, 
        { new: true }
    );
    res.json(email);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;