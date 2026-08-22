// Server wrapper: forces dynamic rendering so the client login page (which
// builds a Supabase browser client at render time) is never statically
// prerendered at build. `export const dynamic` is only honored in a Server
// Component, which is why the actual UI lives in ./LoginClient.
import { LoginClient } from './LoginClient';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return <LoginClient />;
}
