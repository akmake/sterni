import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  getHotels, createHotel, updateMasterChecklist, deleteHotel,
  getPriceLists, createPriceList, updatePriceList, deletePriceList,
  getRoomTypesByHotel, createRoomType, updateRoomType, deleteRoomType,
  getExtraTypes, createExtraType, deleteExtraType,
} from '../controllers/hotelZiporiDataController.js';

const router = express.Router();
router.use(requireAuth);

// Hotels
router.get('/hotels', getHotels);
router.post('/hotels', createHotel);
router.put('/hotels/:id/checklist', updateMasterChecklist);
router.delete('/hotels/:id', deleteHotel);

// Price Lists
router.get('/pricelists', getPriceLists);
router.post('/pricelists', createPriceList);
router.put('/pricelists/:id', updatePriceList);
router.delete('/pricelists/:id', deletePriceList);

// Room Types
router.get('/room-types/by-hotel/:hotelId', getRoomTypesByHotel);
router.post('/room-types', createRoomType);
router.put('/room-types/:id', updateRoomType);
router.delete('/room-types/:id', deleteRoomType);

// Extra Types
router.get('/extras', getExtraTypes);
router.post('/extras', createExtraType);
router.delete('/extras/:id', deleteExtraType);

export default router;
