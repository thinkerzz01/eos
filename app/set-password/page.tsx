// Server wrapper: forces dynamic rendering so the client set-password page
// (which builds a Supabase browser client at render time) is never statically
// prerendered at build. The actual UI lives in ./SetPasswordClient.
import { SetPasswordClient } from './SetPasswordClient';

export const dynamic = 'force-dynamic';

export default function SetPasswordPage() {
  return <SetPasswordClient />;
}
