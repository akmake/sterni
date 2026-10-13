import { calculateRoomTotalPrice } from './priceCalculator.js';

export function duplicateHotelRoomForCouple(source, count, priceLists, roomTypes, numberOfNights) {
  if (!Number.isInteger(count) || count < 1 || count > 100) return [];
  const roomType = roomTypes.find(type => type._id === source.roomTypeId || type.name === source.roomType);
  const supplement = source.roomSupplement ?? roomType?.supplementPerNight ?? 0;
  return Array.from({ length: count }, () => {
    const room = {
      roomTypeId: source.roomTypeId, roomType: source.roomType,
      price_list_names: [...(source.price_list_names || [])],
      roomSupplement: supplement, notes: source.notes || '',
      adults: 2, teens: 0, children: 0, babies: 0,
    };
    return { ...room, price: calculateRoomTotalPrice(room, priceLists, room.price_list_names, numberOfNights, supplement) };
  });
}
