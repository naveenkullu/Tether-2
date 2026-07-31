import mongoose from 'mongoose';

const { Schema } = mongoose;

const guardianNotificationLogSchema = new Schema(
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
    guardians: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Guardian',
      },
    ],
    type: {
      type: String,
      enum: ['SAFE_WALK_STARTED', 'RISK_INCREASED', 'HIGH_RISK', 'SOS', 'MONITORING_ENDED'],
      required: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    deliveryStatus: {
      type: String,
      enum: ['queued', 'sent', 'failed', 'skipped'],
      default: 'queued',
      index: true,
    },
    channel: {
      type: String,
      enum: ['push', 'sms', 'email', 'webhook', 'log'],
      default: 'log',
    },
    cooldownKey: {
      type: String,
      index: true,
    },
    sentAt: Date,
    error: String,
  },
  { timestamps: true },
);

guardianNotificationLogSchema.index({ session: 1, createdAt: -1 });
guardianNotificationLogSchema.index({ user: 1, type: 1, createdAt: -1 });

export default mongoose.models.GuardianNotificationLog ||
  mongoose.model('GuardianNotificationLog', guardianNotificationLogSchema);
