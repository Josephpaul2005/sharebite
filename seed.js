// Fills the database with demo data: node seed.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Donation = require('./models/Donation');
const Request = require('./models/Request');
const Pickup = require('./models/Pickup');
const Feedback = require('./models/Feedback');

const hrs = (h) => new Date(Date.now() + h * 3600000);

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sharebite');
  await Promise.all([User, Donation, Request, Pickup, Feedback].map((m) => m.deleteMany({})));
  const passwordHash = await bcrypt.hash('Password@123', 10);
  const mk = (o) => User.create({ passwordHash, ...o });

  const admin = await mk({ name: 'Admin', email: 'admin@sharebite.test', role: 'admin', verified: true });
  const canteen = await mk({ name: 'Anita Menon', email: 'canteen@sharebite.test', role: 'donor', organization: 'College Canteen', phone: '9876500001', verified: true });
  const bakery = await mk({ name: 'Joseph Mathew', email: 'bakery@sharebite.test', role: 'donor', organization: 'Morning Crust Bakery', phone: '9876500002', verified: true });
  const hope = await mk({ name: 'Riya Thomas', email: 'hope@sharebite.test', role: 'recipient', organization: 'Hope Shelter NGO', phone: '9876500003', verified: true });
  await mk({ name: 'Sam Philip', email: 'pending@sharebite.test', role: 'recipient', organization: 'Care Trust (awaiting verification)', phone: '9876500004', verified: false });

  const base = { safetyConfirmed: true, unit: 'packets' };
  const [meals, bread, fruit] = await Donation.create([
    { ...base, donor: canteen._id, foodName: 'Veg biryani meal packets', description: 'Cooked at 12:30, packed in sealed containers', quantity: 20, category: 'cooked_meal', pickupLocation: 'Main Canteen, Block A, Thodupuzha', collectionDeadline: hrs(4) },
    { ...base, donor: bakery._id, foodName: 'Bread loaves and buns', description: 'Baked this morning', quantity: 30, unit: 'pieces', category: 'bakery', pickupLocation: 'Morning Crust Bakery, Town Road, Thodupuzha', collectionDeadline: hrs(20) },
    { ...base, donor: canteen._id, foodName: 'Bananas and apples', quantity: 15, unit: 'kg', category: 'fruits_veg', pickupLocation: 'Canteen Store Room, Block A, Thodupuzha', collectionDeadline: hrs(30) },
  ]);
  await Donation.create([
    { ...base, donor: bakery._id, foodName: 'Sealed biscuit cartons', quantity: 40, unit: 'cartons', category: 'packaged_dry', pickupLocation: 'Morning Crust Bakery, Town Road, Thodupuzha', collectionDeadline: hrs(100) },
    { ...base, donor: canteen._id, foodName: 'Sealed curd cups', quantity: 25, unit: 'cups', category: 'dairy_packaged', pickupLocation: 'Main Canteen, Block A, Thodupuzha', collectionDeadline: hrs(8) },
  ]);

  // A few finished donations so the impact dashboard has numbers
  const old = await Donation.create({ ...base, donor: canteen._id, foodName: 'Fest lunch packets', quantity: 60, reservedQty: 60, category: 'cooked_meal', pickupLocation: 'Auditorium, Thodupuzha', collectionDeadline: hrs(1), status: 'completed' });
  const done = await Request.create({ donation: old._id, requester: hope._id, quantity: 60, status: 'completed' });
  await Pickup.create({ request: done._id, donation: old._id, pickupTime: hrs(-5), status: 'completed', completedAt: hrs(-5) });
  await Feedback.create({ donation: old._id, user: hope._id, rating: 5, comments: 'Hot, fresh and well packed.' });

  // One pending request for the donor dashboard demo
  await Request.create({ donation: meals._id, requester: hope._id, quantity: 12, message: 'We can collect by 6 pm with a van.' });
  void bread; void fruit;

  console.log('Seeded. Log in with Password@123 as:\n admin@sharebite.test\n canteen@sharebite.test (donor)\n bakery@sharebite.test (donor)\n hope@sharebite.test (verified recipient)\n pending@sharebite.test (unverified recipient)');
  await mongoose.disconnect();
})();
