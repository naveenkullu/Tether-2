import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    picture: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

export default mongoose.models.User || mongoose.model('User', userSchema);
