import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createHotelOrder,
  getMyHotelOrders,
  getAllHotelOrders,
  updateHotelOrder,
  deleteHotelOrder,
  getHotelOrderById,
  getMyHotelOrderStats,
  searchHotelOrders,
  getPublicHotelOrderById,
} from '../controllers/hotelOrderController.js';

const router = express.Router();

// Public route (no auth required)
router.get('/public/:id', getPublicHotelOrderById);

router.use(requireAuth);

router.route('/').post(createHotelOrder).get(getAllHotelOrders);
router.get('/my-orders', getMyHotelOrders);
router.get('/my-stats', getMyHotelOrderStats);
router.get('/search', searchHotelOrders);
router.route('/:id').get(getHotelOrderById).put(updateHotelOrder).delete(deleteHotelOrder);

export default router;
