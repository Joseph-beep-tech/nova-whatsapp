import mongoose, { Document, Schema } from 'mongoose';

export type RiderStatus = 'available' | 'busy' | 'offline';

export interface IRider extends Document {
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  vehicleNumber: string;
  status: RiderStatus;
  currentLocation?: { lat: number; lng: number };
  currentOrderId?: mongoose.Types.ObjectId;
  rating: number;
  totalDeliveries: number;
  isActive: boolean;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RiderSchema = new Schema<IRider>(
  {
    name:            { type: String, required: true, trim: true },
    email:           { type: String, required: true, unique: true, lowercase: true },
    phone:           { type: String, required: true },
    vehicle:         { type: String, required: true, default: 'Motorcycle' },
    vehicleNumber:   { type: String, required: true },
    status:          { type: String, enum: ['available','busy','offline'], default: 'offline', index: true },
    currentLocation: { lat: Number, lng: Number },
    currentOrderId:  { type: Schema.Types.ObjectId, ref: 'Order' },
    rating:          { type: Number, default: 5.0, min: 0, max: 5 },
    totalDeliveries: { type: Number, default: 0 },
    isActive:        { type: Boolean, default: true },
    userId:          { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model<IRider>('Rider', RiderSchema);
