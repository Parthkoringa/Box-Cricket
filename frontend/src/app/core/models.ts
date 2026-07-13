export type Role = 'owner' | 'worker';
export type BookingStatus = 'confirmed' | 'arrived' | 'completed' | 'cancelled' | 'no_show';
export type PaymentType = 'advance' | 'remaining' | 'extra';
export type PaymentMethod = 'cash' | 'upi';

export interface AuthUser { id: string; role: Role; name: string; }
export interface LoginResponse { token: string; user: { id: string; name: string; role: Role }; }
export interface Court { id: string; venue_id: string; name: string; }

export interface Booking {
  id: string;
  court_id: string;
  customer_name: string;
  customer_phone: string;
  booking_date: string;          // YYYY-MM-DD
  start_time: string;            // ISO timestamp
  end_time: string;
  total_amount: string;          // NUMERIC → string
  status: BookingStatus;
  advance_forfeited: boolean;
  cancellation_reason: string | null;
  reminder_acknowledged: boolean;
  created_at: string;
  updated_at: string;
  total_due?: string;
  total_paid?: string;
  balance_due?: string;
}

export interface Payment {
  id: string; booking_id: string; amount: string;
  type: PaymentType; method: string; collected_by: string; paid_at: string;
}

export interface BookingItem {
  id: string; booking_id: string; item_name: string;
  quantity: number; unit_price: string; total_price: string; added_by: string; added_at: string;
}

export interface BookingDetail extends Booking {
  payments: Payment[];
  items: BookingItem[];
}

export interface NewBooking {
  court_id: string; customer_name: string; customer_phone: string;
  booking_date: string; start_time: string; end_time: string; total_amount: number;
}

export interface ReportSummary {
  revenue: string;
  forfeited_advances: string;
  bookings: Partial<Record<BookingStatus, number>>;
}

export interface TrendPoint { day: string; bookings: number; revenue: string; }

export interface WorkerAccount {
  id: string; name: string; phone: string; email: string | null; role: Role; is_active: boolean;
}
