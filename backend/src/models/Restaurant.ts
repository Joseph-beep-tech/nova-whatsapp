import mongoose, { Document, Schema } from 'mongoose';

export interface IRestaurant extends Document {
  name: string;
  description?: string;
  cuisine: string;
  rating: number;
  reviewCount: number;
  deliveryFee: number;
  deliveryTimeMinutesMin: number;
  deliveryTimeMinutesMax: number;
  currencyCode: string;
  currencySymbol: string;
  address: string;
  location?: { lat: number; lng: number };
  imageUrl: string;
  phone?: string;
  hours?: string;
  minOrder: number;
  features: string[];
  isPromoted: boolean;
  discount?: string;
  isOpen: boolean;
  ownerId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RestaurantSchema = new Schema<IRestaurant>(
  {
    name:                   { type: String, required: true, trim: true },
    description:            { type: String, default: '' },
    cuisine:                { type: String, required: true, trim: true },
    rating:                 { type: Number, default: 0, min: 0, max: 5 },
    reviewCount:            { type: Number, default: 0 },
    deliveryFee:            { type: Number, required: true, default: 0 },
    deliveryTimeMinutesMin: { type: Number, default: 20 },
    deliveryTimeMinutesMax: { type: Number, default: 45 },
    currencyCode:           { type: String, default: 'KES' },
    currencySymbol:         { type: String, default: 'KSh' },
    address:                { type: String, required: true },
    location:               { lat: Number, lng: Number },
    imageUrl:               { type: String, default: '' },
    phone:                  { type: String, default: '' },
    hours:                  { type: String, default: 'Mon–Sun 08:00–22:00' },
    minOrder:               { type: Number, default: 0 },
    features:               { type: [String], default: [] },
    isPromoted:             { type: Boolean, default: false },
    discount:               { type: String, default: '' },
    isOpen:                 { type: Boolean, default: true },
    ownerId:                { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model<IRestaurant>('Restaurant', RestaurantSchema);
