const { Schema, model } = require('mongoose');

const userSchema = new Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['donor', 'recipient', 'admin'], default: 'donor' },
    organization: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    // Recipient organizations must be verified by an admin before requesting food
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = model('User', userSchema);
