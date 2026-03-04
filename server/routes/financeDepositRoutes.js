import { Router } from 'express';
import {
  getDeposits, addDeposit, updateDeposit,
  breakDeposit, matureDeposit, deleteDeposit
} from '../controllers/financeDepositController.js';

const router = Router();

router.get('/', getDeposits);
router.post('/', addDeposit);
router.put('/:id', updateDeposit);
router.post('/:id/break', breakDeposit);
router.post('/:id/mature', matureDeposit);
router.delete('/:id', deleteDeposit);

export default router;
