export type ReservationStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';

export interface IReservation {
  id: string;
  restaurantId: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  date: Date;
  partySize: number;
  status: string;
  notes?: string | null;
  tableNumber?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
