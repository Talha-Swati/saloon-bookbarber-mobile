import { NotificationItem } from '@/types';

// Demo fixtures for the notifications screen only, shown when the __DEV__-guarded
// demo-auth bypass is active (see constants/demoAuth.ts). The former `categories`,
// `salons`, `bookings` and `services` fixtures here had no importers left once every
// screen moved onto real Supabase reads, so they were removed.
export const notifications: NotificationItem[] = [
  { id: 'n1', type: 'confirmed', title: 'Booking confirmed', message: 'Your appointment at The Gentlemen’s Lounge is confirmed.', time: '2 min ago', read: false },
  { id: 'n2', type: 'reminder', title: 'Appointment tomorrow', message: 'Your haircut is tomorrow at 5:30 PM.', time: '1 hour ago', read: false },
  { id: 'n3', type: 'payment', title: 'Deposit received', message: 'PKR 450 deposit was recorded for booking BB-B1.', time: 'Yesterday', read: true },
  { id: 'n4', type: 'rescheduled', title: 'Booking rescheduled', message: 'Your appointment was moved to Friday at 5:30 PM.', time: '2 days ago', read: true },
  { id: 'n5', type: 'cancelled', title: 'Booking cancelled', message: 'Your previous booking at N-Gents Salon was cancelled.', time: '12 Aug', read: true },
  { id: 'n6', type: 'review', title: 'How was your visit?', message: 'Review your completed Classic Haircut at N-Gents Salon.', time: '19 Aug', read: false },
];
