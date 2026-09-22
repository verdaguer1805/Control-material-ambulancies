export function cachedDeviceCanQueue(cached, unit, lot) {
  return cached?.authorized === true && cached?.checked === true &&
    cached?.enforcement === true && cached?.unit === unit &&
    Boolean(lot) && (!cached.lot || cached.lot === lot);
}
