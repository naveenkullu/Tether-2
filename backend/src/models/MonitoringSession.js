import mongoose from 'mongoose';

const { Schema } = mongoose;

const monitoringSessionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'ended', 'sos'],
      default: 'active',
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    endedAt: Date,
    startLocation: {
      latitude: Number,
      longitude: Number,
    },
    startArea: String,
    endLocation: {
      latitude: Number,
      longitude: Number,
    },
    endArea: String,
    lastSnapshotAt: Date,
    lastRiskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
    lastRiskLevel: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Low',
    },
    notificationCooldownUntil: Date,
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

monitoringSessionSchema.index({ user: 1, status: 1, startedAt: -1 });

export default mongoose.models.MonitoringSession ||
  mongoose.model('MonitoringSession', monitoringSessionSchema);
