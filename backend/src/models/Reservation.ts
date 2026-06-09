import mongoose, { Document, Schema } from 'mongoose';

export type ReservationStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
export type ReservationSource = 'whatsapp' | 'voice_call' | 'walk_in' | 'online' | 'phone';

export interface IReservation extends Document {
  restaurantId: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  partySize: number;
  date: Date;
  timeSlot: string;         // "19:30"
  tableNumber?: string;
  specialRequests?: string;
  status: ReservationStatus;
  source: ReservationSource;
  aiConversationId?: string; // link to the WA/voice convo that created it
  confirmedAt?: Date;
  cancelledReason?: string;
  staffNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema = new Schema<IReservation>({
  restaurantId: { type: Schema.Types.ObjectId, required: true, index: true },
  customerName: { type: String, required: true, trim: true },
  customerPhone: { type: String, required: true },
  partySize: { type: Number, required: true, min: 1 },
  date: { type: Date, required: true },
  timeSlot: { type: String, required: true },
  tableNumber: String,
  specialRequests: String,
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'],
    default: 'pending',
  },
  source: {
    type: String,
    enum: ['whatsapp', 'voice_call', 'walk_in', 'online', 'phone'],
    default: 'online',
  },
  aiConversationId: String,
  confirmedAt: Date,
  cancelledReason: String,
  staffNote: String,
}, { timestamps: true });

export default mongoose.model<IReservation>('Reservation', ReservationSchema);
