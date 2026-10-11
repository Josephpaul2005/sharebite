const { Schema, model } = require('mongoose');

const donationSchema = new Schema(
  {
    donor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    foodName: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    reservedQty: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: 'packets', trim: true },
    category: {
      type: String,
      required: true,
      enum: ['cooked_meal', 'dairy_packaged', 'bakery', 'fruits_veg', 'packaged_dry'],
    },
    pickupLocation: { type: String, required: true, trim: true },
    collectionDeadline: { type: Date, required: true, index: true },
    imageUrl: { type: String, default: '' },
    safetyConfirmed: { type: Boolean, required: true },
    status: {
      type: String,
      enum: ['available', 'reserved', 'completed', 'expired', 'cancelled'],
      default: 'available',
      index: true,
    },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

donationSchema.virtual('remaining').get(function () {
  return this.quantity - this.reservedQty;
});

module.exports = model('Donation', donationSchema);
