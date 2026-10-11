const router = require('express').Router();
const Request = require('../models/Request');
const Feedback = require('../models/Feedback');
const { auth } = require('../middleware/auth');

// Recipient rates a donation after pickup is completed
router.post('/', auth('recipient'), async (req, res, next) => {
  try {
    const r = await Request.findById(req.body.requestId);
    if (!r || String(r.requester) !== String(req.user._id)) return res.status(404).json({ error: 'Request not found' });
    if (r.status !== 'completed') return res.status(409).json({ error: 'You can rate food after the pickup is completed' });
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1 to 5' });
    const fb = await Feedback.create({ donation: r.donation, user: req.user._id, rating, comments: req.body.comments });
    res.status(201).json(fb);
  } catch (e) { next(e); }
});

module.exports = router;
