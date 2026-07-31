import mongoose from 'mongoose';

const { Schema } = mongoose;

const placeSchema = new Schema(
  {
    id: String,
    name: String,
    type: String,
    distanceKm: Number,
    latitude: Number,
    longitude: Number,
  },
  { _id: false },
);

const riskSnapshotSchema = new Schema(
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
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    readableLocation: String,
    capturedAt: {
      type: Date,
      required: true,
      index: true,
    },
    clientSafeScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    risk: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      required: true,
      index: true,
    },
    reasons: {
      type: [String],
      default: [],
    },
    weather: {
      type: Schema.Types.Mixed,
      default: null,
    },
    dayNight: {
      type: String,
      enum: ['day', 'night', 'unknown'],
      default: 'unknown',
    },
    nearbySafePlaces: {
      type: [placeSchema],
      default: [],
    },
    nearbyPoliceStations: {
      type: [placeSchema],
      default: [],
    },
    nearbyHospitals: {
      type: [placeSchema],
      default: [],
    },
    aiInsight: {
      type: Schema.Types.Mixed,
      default: null,
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
    },
    walkingSpeedKmph: Number,
    isSos: {
      type: Boolean,
      default: false,
      index: true,
    },
    isUnsafeArea: {
      type: Boolean,
      default: false,
    },
    isCrowdedArea: {
      type: Boolean,
      default: false,
    },
    stoppedUnexpectedly: {
      type: Boolean,
      default: false,
    },
    longInactivity: {
      type: Boolean,
      default: false,
    },
    rawPayload: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

riskSnapshotSchema.index({ session: 1, capturedAt: -1 });
riskSnapshotSchema.index({ user: 1, capturedAt: -1 });

export default mongoose.models.RiskSnapshot ||
  mongoose.model('RiskSnapshot', riskSnapshotSchema);
