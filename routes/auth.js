const router = require('express').Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sign, auth } = require('../middleware/auth');

const publicUser = (u) => ({
  id: u._id, name: u.name, email: u.email, role: u.role,
  organization: u.organization, phone: u.phone, address: u.address, verified: u.verified,
});

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role, organization, phone, address } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!['donor', 'recipient'].includes(role)) return res.status(400).json({ error: 'Choose donor or recipient' });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ error: 'An account with this email already exists' });
    const user = await User.create({
      name, email, role, organization, phone, address,
      passwordHash: await bcrypt.hash(password, 10),
      verified: role === 'donor', // recipients wait for admin verification
    });
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const user = await User.findOne({ email: String(req.body.email || '').toLowerCase() });
    if (!user || !(await bcrypt.compare(req.body.password || '', user.passwordHash)))
      return res.status(401).json({ error: 'Email or password is incorrect' });
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (e) { next(e); }
});

router.get('/me', auth(), (req, res) => res.json({ user: publicUser(req.user) }));

module.exports = router;
