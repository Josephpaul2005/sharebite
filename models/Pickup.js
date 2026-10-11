const { Schema, model } = require('mongoose');

const pickupSchema = new Schema(
  {
    request: { type: Schema.Types.ObjectId, ref: 'Request', required: true, unique: true },
    donation: { type: Schema.Types.ObjectId, ref: 'Donation', required: true },
    pickupTime: { type: Date, required: true },
    status: { type: String, enum: ['scheduled', 'completed', 'missed', 'cancelled'], default: 'scheduled' },
    completedAt: Date,
  },
  { timestamps: true }
);

module.exports = model('Pickup', pickupSchema);
