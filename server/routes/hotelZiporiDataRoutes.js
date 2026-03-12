import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  getHotels,
  getPriceLists,
  getRoomTypesByHotel,
  getExtraTypes,
} from '../controllers/hotelZiporiDataController.js';

const router = express.Router();
router.use(requireAuth);

router.get('/hotels', getHotels);
router.get('/pricelists', getPriceLists);
router.get('/room-types/:hotelId', getRoomTypesByHotel);
router.get('/extras', getExtraTypes);

export default router;
