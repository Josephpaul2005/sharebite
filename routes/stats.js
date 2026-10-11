const router = require('express').Router();
const Donation = require('../models/Donation');
const Request = require('../models/Request');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Completed requests joined with their donation, so we can group by donor
const completedWithDonation = [
  { $match: { status: 'completed' } },
  { $lookup: { from: 'donations', localField: 'donation', foreignField: '_id', as: 'd' } },
  { $unwind: '$d' },
];

router.get('/', async (req, res, next) => {
  try {
    const [totalDonations, activeListings, donors, recipients, totals, top] = await Promise.all([
      Donation.countDocuments({ status: { $ne: 'cancelled' } }),
      Donation.countDocuments({ status: { $in: ['available', 'reserved'] }, collectionDeadline: { $gt: new Date() } }),
      User.countDocuments({ role: 'donor' }),
      User.countDocuments({ role: 'recipient', verified: true }),
      Request.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, pickups: { $sum: 1 }, qty: { $sum: '$quantity' } } }]),
      Request.aggregate([
        ...completedWithDonation,
        { $group: { _id: '$d.donor', qty: { $sum: '$quantity' }, pickups: { $sum: 1 } } },
        { $sort: { qty: -1 } }, { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $unwind: '$u' },
        { $project: { _id: 0, name: { $cond: [{ $ne: ['$u.organization', ''] }, '$u.organization', '$u.name'] }, qty: 1, pickups: 1 } },
      ]),
    ]);
    res.json({
      totalDonations, activeListings, donors, recipients,
      completedPickups: totals[0]?.pickups || 0,
      mealsRedistributed: totals[0]?.qty || 0,
      topDonors: top,
    });
  } catch (e) { next(e); }
});

// Individual contribution
router.get('/me', auth('donor', 'recipient'), async (req, res, next) => {
  try {
    if (req.user.role === 'donor') {
      const [listed, agg] = await Promise.all([
        Donation.countDocuments({ donor: req.user._id, status: { $ne: 'cancelled' } }),
        Request.aggregate([...completedWithDonation, { $match: { 'd.donor': req.user._id } },
          { $group: { _id: null, qty: { $sum: '$quantity' }, pickups: { $sum: 1 } } }]),
      ]);
      return res.json({ role: 'donor', listed, pickups: agg[0]?.pickups || 0, quantity: agg[0]?.qty || 0 });
    }
    const agg = await Request.aggregate([{ $match: { requester: req.user._id, status: 'completed' } },
      { $group: { _id: null, qty: { $sum: '$quantity' }, pickups: { $sum: 1 } } }]);
    res.json({ role: 'recipient', pickups: agg[0]?.pickups || 0, quantity: agg[0]?.qty || 0 });
  } catch (e) { next(e); }
});

module.exports = router;
