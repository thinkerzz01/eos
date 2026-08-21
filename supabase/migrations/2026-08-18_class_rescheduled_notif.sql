-- Allow the 'class_rescheduled' notification type so a teacher rescheduling a
-- missed/upcoming class can auto-notify the student via the notification queue.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'class_reminder', 'fee_due', 'grace_ending', 'demo_confirmed', 'payment_received',
    'monthly_report', 'follow_up', 'announcement', 'grace_expired_admin', 'class_rescheduled'
  ));
