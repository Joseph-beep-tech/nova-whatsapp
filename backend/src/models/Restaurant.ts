export interface IRestaurant {
  id: string;
  name: string;
  description: string;
  cuisine: string;
  rating: number;
  reviewCount: number;
  deliveryFee: number;
  deliveryTimeMinutesMin: number;
  deliveryTimeMinutesMax: number;
  currencyCode: string;
  currencySymbol: string;
  address: string;
  locationLat?: number | null;
  locationLng?: number | null;
  imageUrl: string;
  phone: string;
  hours: string;
  minOrder: number;
  features: string[];
  isPromoted: boolean;
  discount: string;
  isOpen: boolean;
  ownerId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
