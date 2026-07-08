export interface IPhoneNumber {
  id: string;
  userId: string;
  restaurantId?: string | null;
  number: string;
  phoneNumber?: string | null;
  label: string;
  isActive: boolean;
  sipUri?: string | null;
  promptId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
