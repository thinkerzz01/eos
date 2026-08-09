// Tickets - SERVER Component (real, RLS-authorized rows -> client UI).
import { getTickets } from '@/lib/data/tickets';
import { TicketsClient } from './TicketsClient';

export const dynamic = 'force-dynamic';

export default async function TicketsPage() {
  const tickets = await getTickets();
  return <TicketsClient initialTickets={tickets} />;
}
