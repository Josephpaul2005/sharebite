const jwt = require('jsonwebtoken');
const User = require('../models/User');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const sign = (user) => jwt.sign({ id: user._id }, SECRET, { expiresIn: '7d' });

// auth() = any logged-in user; auth('donor', 'admin') = only those roles
const auth = (...roles) => async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Log in to continue' });
    const { id } = jwt.verify(token, SECRET);
    const user = await User.findById(id);
    if (!user) return res.status(401).json({ error: 'Account not found' });
    if (roles.length && !roles.includes(user.role)) return res.status(403).json({ error: 'Your account type cannot do this' });
    req.user = user;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Session expired. Log in again' });
  }
};

module.exports = { sign, auth };
