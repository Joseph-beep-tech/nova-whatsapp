import mongoose, { Document, Schema } from 'mongoose';

export interface IMenuItem extends Document {
  restaurantId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  imageUrl: string;
  category: string;
  isAvailable: boolean;
  isVegetarian: boolean;
  isFeatured: boolean;
  rating: number;
  prepTimeMinutes: number;
  allergens: string[];
  calories?: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const MenuItemSchema = new Schema<IMenuItem>(
  {
    restaurantId:   { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    name:           { type: String, required: true, trim: true },
    description:    { type: String, default: '' },
    price:          { type: Number, required: true, min: 0 },
    imageUrl:       { type: String, default: '' },
    category:       { type: String, required: true, trim: true },
    isAvailable:    { type: Boolean, default: true },
    isVegetarian:   { type: Boolean, default: false },
    isFeatured:     { type: Boolean, default: false },
    rating:         { type: Number, default: 0, min: 0, max: 5 },
    prepTimeMinutes:{ type: Number, default: 15 },
    allergens:      { type: [String], default: [] },
    calories:       { type: Number },
    sortOrder:      { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<IMenuItem>('MenuItem', MenuItemSchema);
