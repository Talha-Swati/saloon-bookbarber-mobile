export type Service = {
  id: string;
  name: string;
  price: number;
  duration: number;
  description: string;
  category?: string;
};
export type Review = {
  id: string;
  name: string;
  rating: number;
  comment: string;
};
export type Salon = {
  id: string;
  name: string;
  area: string;
  city: string;
  rating: number;
  reviews: number;
  distanceKm: number;
  startingPrice: number;
  featured?: boolean;
  accent: string;
  isOpen: boolean;
  description: string;
  hours: string;
  services: Service[];
  reviewPreview: Review[];
};
export type Booking = {
  id: string;
  salonName: string;
  serviceName: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  deposit: number;
  paymentMethod: string;
  paymentStatus: "Deposit paid" | "Pay at salon";
  status: "upcoming" | "completed" | "cancelled";
};
export type NotificationItem = {
  id: string;
  type:
    | "confirmed"
    | "reminder"
    | "rescheduled"
    | "cancelled"
    | "payment"
    | "review";
  title: string;
  message: string;
  time: string;
  read: boolean;
};
export type AvailabilitySlot = {
  startTime: string;
  endTime?: string;
  available: boolean;
};
