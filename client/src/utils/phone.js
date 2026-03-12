export function formatPhoneForWhatsApp(phone) {
  if (!phone || typeof phone !== 'string') return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = '972' + digits.substring(1);
  } else if (digits.startsWith('972')) {
    // already correct
  } else if (digits.length === 9) {
    digits = '972' + digits;
  } else {
    return null;
  }
  return digits.length === 12 ? digits : null;
}
