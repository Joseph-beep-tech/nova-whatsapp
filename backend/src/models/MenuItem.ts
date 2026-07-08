export interface IMenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  isAvailable: boolean;
  isVegetarian: boolean;
  isFeatured: boolean;
  rating: number;
  prepTimeMinutes: number;
  allergens: string[];
  calories?: number | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
