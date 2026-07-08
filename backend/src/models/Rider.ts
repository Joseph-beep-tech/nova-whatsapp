export type RiderStatus = 'available' | 'busy' | 'offline';

export interface IRider {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  status: string;
  currentLat?: number | null;
  currentLng?: number | null;
  vehicleType: string;
  createdAt: Date;
  updatedAt: Date;
}
