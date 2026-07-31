import mongoose from 'mongoose';

const { Schema } = mongoose;

const locationHistorySchema = new Schema(
  {
    session: {
      type: Schema.Types.ObjectId,
      ref: 'MonitoringSession',
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    capturedAt: {
      type: Date,
      required: true,
      index: true,
    },
    accuracyMeters: Number,
    speedKmph: Number,
    source: {
      type: String,
      default: 'safe_walk',
    },
  },
  { timestamps: true },
);

locationHistorySchema.index({ session: 1, capturedAt: -1 });
locationHistorySchema.index({ user: 1, capturedAt: -1 });

export default mongoose.models.LocationHistory ||
  mongoose.model('LocationHistory', locationHistorySchema);
