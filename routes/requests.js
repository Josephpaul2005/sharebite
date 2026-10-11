const router = require('express').Router();
const Donation = require('../models/Donation');
const Request = require('../models/Request');
const Pickup = require('../models/Pickup');
const Feedback = require('../models/Feedback');
const { auth } = require('../middleware/auth');
const { expireOverdue } = require('../utils/expiry');

const fail = (status, error) => Object.assign(new Error(error), { status });

// Give reserved quantity back to the listing (cancellation / no-show)
async function release(request, donation) {
  donation.reservedQty = Math.max(0, donation.reservedQty - request.quantity);
  if (donation.status === 'reserved' && donation.collectionDeadline > new Date()) donation.status = 'available';
  await donation.save();
}

// Recipient: ask for food
router.post('/', auth('recipient'), async (req, res, next) => {
  try {
    if (!req.user.verified) throw fail(403, 'Your organization is awaiting admin verification');
    await expireOverdue();
    const { donationId, message } = req.body;
    const quantity = Number(req.body.quantity);
    const d = await Donation.findById(donationId);
    if (!d || d.status !== 'available' || d.collectionDeadline <= new Date()) throw fail(409, 'This food is no longer available');
    if (!Number.isInteger(quantity) || quantity < 1) throw fail(400, 'Enter a whole number quantity');
    if (quantity > d.remaining) throw fail(400, `Only ${d.remaining} ${d.unit} left`);
    const dup = await Request.findOne({ donation: d._id, requester: req.user._id, status: { $in: ['pending', 'accepted'] } });
    if (dup) throw fail(409, 'You already have an open request for this listing');
    res.status(201).json(await Request.create({ donation: d._id, requester: req.user._id, quantity, message }));
  } catch (e) { next(e); }
});

// Recipient: my requests with pickup + feedback info
router.get('/mine', auth('recipient'), async (req, res, next) => {
  try {
    await expireOverdue();
    const reqs = await Request.find({ requester: req.user._id }).sort({ createdAt: -1 })
      .populate({ path: 'donation', populate: { path: 'donor', select: 'name organization phone' } }).lean();
    const ids = reqs.map((r) => r._id);
    const pickups = await Pickup.find({ request: { $in: ids } }).lean();
    const fb = await Feedback.find({ user: req.user._id, donation: { $in: reqs.map((r) => r.donation?._id) } }).lean();
    res.json(reqs.map((r) => ({
      ...r,
      pickup: pickups.find((p) => String(p.request) === String(r._id)) || null,
      rated: fb.some((f) => String(f.donation) === String(r.donation?._id)),
    })));
  } catch (e) { next(e); }
});

// Donor: requests made on my listings
router.get('/incoming', auth('donor'), async (req, res, next) => {
  try {
    await expireOverdue();
    const mine = await Donation.find({ donor: req.user._id }).select('_id');
    const reqs = await Request.find({ donation: { $in: mine.map((d) => d._id) } }).sort({ createdAt: -1 })
      .populate('donation', 'foodName unit collectionDeadline status')
      .populate('requester', 'name organization phone').lean();
    const pickups = await Pickup.find({ request: { $in: reqs.map((r) => r._id) } }).lean();
    res.json(reqs.map((r) => ({ ...r, pickup: pickups.find((p) => String(p.request) === String(r._id)) || null })));
  } catch (e) { next(e); }
});

// Loads a request and checks the donor owns the listing
async function ownedByDonor(req) {
  const r = await Request.findById(req.params.id);
  if (!r) throw fail(404, 'Request not found');
  const d = await Donation.findById(r.donation);
  if (!d || String(d.donor) !== String(req.user._id)) throw fail(404, 'Request not found');
  return { r, d };
}

router.patch('/:id/accept', auth('donor'), async (req, res, next) => {
  try {
    const { r, d } = await ownedByDonor(req);
    if (r.status !== 'pending') throw fail(409, 'Only pending requests can be accepted');
    if (d.collectionDeadline <= new Date() || !['available', 'reserved'].includes(d.status)) throw fail(409, 'This listing has expired');
    if (r.quantity > d.remaining) throw fail(409, `Only ${d.remaining} ${d.unit} left`);
    const when = new Date(req.body.pickupTime);
    if (isNaN(when) || when < new Date(Date.now() - 60000) || when > d.collectionDeadline)
      throw fail(400, 'Pick a pickup time between now and the collection deadline');
    d.reservedQty += r.quantity;
    d.status = d.remaining === 0 ? 'reserved' : 'available';
    await d.save();
    r.status = 'accepted';
    await r.save();
    await Pickup.create({ request: r._id, donation: d._id, pickupTime: when });
    res.json(r);
  } catch (e) { next(e); }
});

router.patch('/:id/reject', auth('donor'), async (req, res, next) => {
  try {
    const { r } = await ownedByDonor(req);
    if (r.status !== 'pending') throw fail(409, 'Only pending requests can be rejected');
    r.status = 'rejected';
    res.json(await r.save());
  } catch (e) { next(e); }
});

router.patch('/:id/complete', auth('donor'), async (req, res, next) => {
  try {
    const { r, d } = await ownedByDonor(req);
    if (r.status !== 'accepted') throw fail(409, 'Only accepted requests can be completed');
    r.status = 'completed';
    await r.save();
    await Pickup.findOneAndUpdate({ request: r._id }, { status: 'completed', completedAt: new Date() });
    const stillOpen = await Request.exists({ donation: d._id, status: 'accepted' });
    if (d.remaining === 0 && !stillOpen) { d.status = 'completed'; await d.save(); }
    res.json(r);
  } catch (e) { next(e); }
});

router.patch('/:id/no-show', auth('donor'), async (req, res, next) => {
  try {
    const { r, d } = await ownedByDonor(req);
    if (r.status !== 'accepted') throw fail(409, 'Only accepted requests can be marked as no-show');
    r.status = 'no_show';
    await r.save();
    await Pickup.findOneAndUpdate({ request: r._id }, { status: 'missed' });
    await release(r, d);
    res.json(r);
  } catch (e) { next(e); }
});

router.patch('/:id/cancel', auth('recipient'), async (req, res, next) => {
  try {
    const r = await Request.findById(req.params.id);
    if (!r || String(r.requester) !== String(req.user._id)) throw fail(404, 'Request not found');
    if (!['pending', 'accepted'].includes(r.status)) throw fail(409, 'This request can no longer be cancelled');
    const wasAccepted = r.status === 'accepted';
    r.status = 'cancelled';
    await r.save();
    if (wasAccepted) {
      await Pickup.findOneAndUpdate({ request: r._id }, { status: 'cancelled' });
      const d = await Donation.findById(r.donation);
      if (d) await release(r, d);
    }
    res.json(r);
  } catch (e) { next(e); }
});

module.exports = router;
