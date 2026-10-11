const router = require('express').Router();
const User = require('../models/User');
const Donation = require('../models/Donation');
const { auth } = require('../middleware/auth');
const { cancelDonation, expireOverdue } = require('../utils/expiry');

router.use(auth('admin'));

router.get('/users', async (req, res, next) => {
  try { res.json(await User.find().select('-passwordHash').sort({ createdAt: -1 })); } catch (e) { next(e); }
});

router.patch('/users/:id/verify', async (req, res, next) => {
  try {
    const u = await User.findOneAndUpdate({ _id: req.params.id, role: 'recipient' }, { verified: !!req.body.verified }, { new: true }).select('-passwordHash');
    if (!u) return res.status(404).json({ error: 'Recipient not found' });
    res.json(u);
  } catch (e) { next(e); }
});

router.get('/donations', async (req, res, next) => {
  try {
    await expireOverdue();
    res.json(await Donation.find().sort({ createdAt: -1 }).limit(100).populate('donor', 'name organization'));
  } catch (e) { next(e); }
});

router.delete('/donations/:id', async (req, res, next) => {
  try {
    const d = await cancelDonation(req.params.id);
    if (!d) return res.status(404).json({ error: 'Listing not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
