const Donation = require('../models/Donation');
const Request = require('../models/Request');
const Pickup = require('../models/Pickup');

// Marks overdue listings as expired and closes their open requests.
async function expireOverdue() {
  try {
    const overdue = await Donation.find({
      status: { $in: ['available', 'reserved'] },
      collectionDeadline: { $lt: new Date() },
    }).select('_id');
    if (!overdue.length) return;
    const ids = overdue.map((d) => d._id);
    await Donation.updateMany({ _id: { $in: ids } }, { status: 'expired' });
    const open = await Request.find({ donation: { $in: ids }, status: { $in: ['pending', 'accepted'] } }).select('_id');
    const reqIds = open.map((r) => r._id);
    await Request.updateMany({ _id: { $in: reqIds } }, { status: 'cancelled' });
    await Pickup.updateMany({ request: { $in: reqIds }, status: 'scheduled' }, { status: 'missed' });
  } catch (e) {
    console.error('expireOverdue failed:', e.message);
  }
}

// Removes a listing from the board and cancels everything attached to it.
async function cancelDonation(id) {
  const d = await Donation.findByIdAndUpdate(id, { status: 'cancelled' }, { new: true });
  if (!d) return null;
  const open = await Request.find({ donation: id, status: { $in: ['pending', 'accepted'] } }).select('_id');
  const reqIds = open.map((r) => r._id);
  await Request.updateMany({ _id: { $in: reqIds } }, { status: 'cancelled' });
  await Pickup.updateMany({ request: { $in: reqIds }, status: 'scheduled' }, { status: 'cancelled' });
  return d;
}

module.exports = { expireOverdue, cancelDonation };
