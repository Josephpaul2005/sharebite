const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Donation = require('../models/Donation');
const { auth } = require('../middleware/auth');
const { validateListing, CATEGORIES } = require('../utils/safety');
const { expireOverdue, cancelDonation } = require('../utils/expiry');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (EXT[file.mimetype] ? cb(null, true) : cb(new Error('Images must be JPG, PNG or WebP'))),
});

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fields = ['foodName', 'description', 'quantity', 'unit', 'category', 'pickupLocation', 'collectionDeadline', 'safetyConfirmed'];
const pick = (body) => Object.fromEntries(fields.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

router.get('/categories', (req, res) => res.json(CATEGORIES));

// Public search. Expired food is never returned.
router.get('/', async (req, res, next) => {
  try {
    await expireOverdue();
    const { search, category, location, minQty, status } = req.query;
    const q = { collectionDeadline: { $gt: new Date() } };
    q.status = ['available', 'reserved'].includes(status) ? status : { $in: ['available', 'reserved'] };
    if (category && CATEGORIES[category]) q.category = category;
    if (location) q.pickupLocation = new RegExp(escapeRx(location), 'i');
    if (search) {
      const rx = new RegExp(escapeRx(search), 'i');
      q.$or = [{ foodName: rx }, { description: rx }];
    }
    if (Number(minQty) > 0) q.$expr = { $gte: [{ $subtract: ['$quantity', '$reservedQty'] }, Number(minQty)] };
    const list = await Donation.find(q).sort({ collectionDeadline: 1 }).limit(100).populate('donor', 'name organization');
    res.json(list);
  } catch (e) { next(e); }
});

router.get('/mine', auth('donor'), async (req, res, next) => {
  try {
    await expireOverdue();
    res.json(await Donation.find({ donor: req.user._id }).sort({ createdAt: -1 }));
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const d = await Donation.findById(req.params.id).populate('donor', 'name organization');
    if (!d) return res.status(404).json({ error: 'Listing not found' });
    res.json(d);
  } catch (e) { next(e); }
});

router.post('/', auth('donor'), upload.single('image'), async (req, res, next) => {
  try {
    const err = validateListing(req.body);
    if (err) return res.status(400).json({ error: err });
    const d = await Donation.create({
      ...pick(req.body),
      safetyConfirmed: true,
      donor: req.user._id,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : '',
    });
    res.status(201).json(d);
  } catch (e) { next(e); }
});

router.put('/:id', auth('donor'), upload.single('image'), async (req, res, next) => {
  try {
    const d = await Donation.findById(req.params.id);
    if (!d || String(d.donor) !== String(req.user._id)) return res.status(404).json({ error: 'Listing not found' });
    if (!['available', 'reserved'].includes(d.status)) return res.status(409).json({ error: 'Only active listings can be edited' });
    const merged = { ...d.toObject(), ...pick(req.body) };
    const err = validateListing(merged);
    if (err) return res.status(400).json({ error: err });
    if (Number(merged.quantity) < d.reservedQty) return res.status(400).json({ error: `Quantity cannot be below the ${d.reservedQty} already reserved` });
    Object.assign(d, pick(req.body), { safetyConfirmed: true });
    if (req.file) d.imageUrl = `/uploads/${req.file.filename}`;
    d.status = d.quantity - d.reservedQty === 0 ? 'reserved' : 'available';
    await d.save();
    res.json(d);
  } catch (e) { next(e); }
});

router.delete('/:id', auth('donor'), async (req, res, next) => {
  try {
    const d = await Donation.findById(req.params.id);
    if (!d || String(d.donor) !== String(req.user._id)) return res.status(404).json({ error: 'Listing not found' });
    await cancelDonation(d._id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
