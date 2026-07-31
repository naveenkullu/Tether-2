import mongoose from 'mongoose';

const { Schema } = mongoose;

const guardianSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    relation: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    avatarColor: {
      type: String,
      trim: true,
      default: '#4FA89B',
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

guardianSchema.index({ user: 1, createdAt: 1 });

export default mongoose.models.Guardian || mongoose.model('Guardian', guardianSchema);
