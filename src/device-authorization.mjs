export function confirmedDeviceAuthorization(data, unit, lot) {
  return data?.authorized === true && data?.enforcement_enabled === true &&
    data.unit === unit && data.lot === lot &&
    Number.isInteger(data.current_version) && data.current_version > 0 &&
    data.device_version === data.current_version;
}
