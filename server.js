require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { expireOverdue } = require('./utils/expiry');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }), require('./routes/auth'));
app.use('/api/donations', require('./routes/donations'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found' }));

// Central error handler
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') return res.status(400).json({ error: Object.values(err.errors)[0].message });
  if (err.code === 11000) return res.status(409).json({ error: 'That value is already in use' });
  if (err.name === 'MulterError') return res.status(400).json({ error: err.message });
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid ID' });
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 3000;
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sharebite')
  .then(() => {
    console.log('MongoDB connected');
    expireOverdue();
    setInterval(expireOverdue, 60 * 1000); // keep expired food off the board
    app.listen(PORT, '0.0.0.0', () => console.log(`ShareBite listening on port ${PORT}`));
  })
  .catch((e) => {
    console.error('Could not connect to MongoDB:', e.message);
    process.exit(1);
  });
