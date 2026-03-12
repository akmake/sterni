// חישוב מחירים - זהה ל-ziporiclass
const guestHierarchy = {
  adult: { priceKey: 'teen', order: 1 },
  teen: { priceKey: 'teen', order: 2 },
  child: { priceKey: 'child', order: 3 },
};

export function calculateSinglePackageBasePrice(room, priceList) {
  const { adults = 0, teens = 0, children = 0, babies = 0 } = room;
  const babyCost = babies * (priceList.baby || 0);
  const mainGroupSize = adults + teens + children;
  let mainGroupPrice = 0;

  if (mainGroupSize === 0) {
    mainGroupPrice = 0;
  } else if (mainGroupSize === 1) {
    mainGroupPrice = priceList.single_room || 0;
  } else {
    const guests = [
      ...Array(adults).fill('adult'),
      ...Array(teens).fill('teen'),
      ...Array(children).fill('child'),
    ];
    guests.sort((a, b) => guestHierarchy[a].order - guestHierarchy[b].order);
    mainGroupPrice = priceList.couple || 0;
    for (let i = 2; i < guests.length; i++) {
      mainGroupPrice += (priceList[guestHierarchy[guests[i]].priceKey] || 0);
    }
  }
  return mainGroupPrice + babyCost;
}

export function calculateRoomTotalPrice(room, allPriceLists, selectedNames, nights = 1, roomSupplementPerNight = 0) {
  if (!allPriceLists || !selectedNames || selectedNames.length === 0) return 0;
  let totalPackageBasePrice = 0;
  for (const name of selectedNames) {
    const priceList = allPriceLists[name];
    if (priceList) {
      totalPackageBasePrice += calculateSinglePackageBasePrice(room, priceList);
    }
  }
  return totalPackageBasePrice + (roomSupplementPerNight * nights);
}
