const { Schema, model } = require('mongoose');

const requestSchema = new Schema(
  {
    donation: { type: Schema.Types.ObjectId, ref: 'Donation', required: true, index: true },
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    message: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed', 'no_show'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

module.exports = model('Request', requestSchema);
