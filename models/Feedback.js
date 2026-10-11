const { Schema, model } = require('mongoose');

const feedbackSchema = new Schema(
  {
    donation: { type: Schema.Types.ObjectId, ref: 'Donation', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: [true, 'Rating is required'], min: 1, max: 5 },
    comments: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);
feedbackSchema.index({ donation: 1, user: 1 }, { unique: true });

module.exports = model('Feedback', feedbackSchema);
