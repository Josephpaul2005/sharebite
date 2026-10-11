// Basic food-safety rules. Edit here to tighten or relax them.
const CATEGORIES = {
  cooked_meal: { label: 'Cooked meals', maxHours: 6 },
  dairy_packaged: { label: 'Packaged dairy', maxHours: 12 },
  bakery: { label: 'Bakery items', maxHours: 24 },
  fruits_veg: { label: 'Fresh fruits and vegetables', maxHours: 48 },
  packaged_dry: { label: 'Sealed packaged food', maxHours: 168 },
};

const BLOCKED_TERMS = [
  'raw meat', 'raw fish', 'raw chicken', 'raw egg', 'alcohol', 'beer', 'wine', 'liquor',
  'half-eaten', 'half eaten', 'partially eaten', 'plate leftover', 'spoiled', 'mouldy', 'moldy',
];

const MIN_WINDOW_MIN = 15;

function validateListing(b) {
  const name = (b.foodName || '').trim();
  if (name.length < 3) return 'Food name must be at least 3 characters';
  const text = `${name} ${b.description || ''}`.toLowerCase();
  const hit = BLOCKED_TERMS.find((t) => text.includes(t));
  if (hit) return `"${hit}" is not allowed. Only safe, ready-to-eat food can be listed`;
  const qty = Number(b.quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 5000) return 'Quantity must be a whole number between 1 and 5000';
  const cat = CATEGORIES[b.category];
  if (!cat) return 'Choose a valid food category';
  if ((b.pickupLocation || '').trim().length < 5) return 'Enter a pickup location with enough detail to find it';
  const deadline = new Date(b.collectionDeadline);
  if (isNaN(deadline)) return 'Enter a valid collection deadline';
  const now = Date.now();
  if (deadline.getTime() < now + MIN_WINDOW_MIN * 60000) return `Collection deadline must be at least ${MIN_WINDOW_MIN} minutes from now`;
  if (deadline.getTime() > now + cat.maxHours * 3600000)
    return `${cat.label} can only be listed for up to ${cat.maxHours} hours`;
  if (!(b.safetyConfirmed === true || b.safetyConfirmed === 'true'))
    return 'Confirm that the food is fresh, safely stored and fit to eat';
  return null;
}

module.exports = { CATEGORIES, validateListing };
