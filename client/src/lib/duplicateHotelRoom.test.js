import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duplicateHotelRoomForCouple } from './duplicateHotelRoom.js';

test('copies room details but recalculates each independent room for a couple', () => {
  const source = { _id: 'existing-room', roomTypeId: 'suite', roomType: 'סוויטה',
    price_list_names: ['חג'], roomSupplement: 100, notes: 'חדרים סמוכים',
    adults: 3, teens: 1, children: 2, babies: 1, price: 9999 };
  const copies = duplicateHotelRoomForCouple(source, 3, { 'חג': { couple: 2000, teen: 500, child: 300, baby: 100 } }, [], 2);
  assert.equal(copies.length, 3);
  for (const room of copies) {
    assert.deepEqual([room.adults, room.teens, room.children, room.babies], [2, 0, 0, 0]);
    assert.equal(room.price, 2200);
    assert.equal(room.notes, source.notes);
    assert.equal(room.roomTypeId, 'suite');
    assert.equal(room._id, undefined);
  }
  copies[0].price_list_names.push('another');
  assert.deepEqual(copies[1].price_list_names, ['חג']);
  assert.deepEqual(source.price_list_names, ['חג']);
  assert.equal(source.adults, 3);
});

test('resolves missing supplement and rejects invalid quantities', () => {
  const source = { roomTypeId: 'suite', price_list_names: ['base', 'holiday'] };
  const lists = { base: { couple: 1000 }, holiday: { couple: 2000 } };
  const types = [{ _id: 'suite', supplementPerNight: 50 }];
  assert.equal(duplicateHotelRoomForCouple(source, 1, lists, types, 3)[0].price, 3150);
  for (const count of [0, -1, 1.5, NaN, 101]) assert.deepEqual(duplicateHotelRoomForCouple(source, count, lists, types, 3), []);
});
