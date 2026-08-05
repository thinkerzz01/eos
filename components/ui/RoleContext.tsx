'use client';

// Role is the AUTHORITATIVE server-derived role (from the `profiles` table),
// provided by the root layout. It is read-only on the client — there is no
// switcher. The database (RLS) is the real access lock; this only tailors which
// UI a user sees. (Closes audit finding C3: role is no longer a spoofable
// client-side toggle.)
import React, { createContext, useContext } from 'react';
import { UserRole } from '@/components/layout/Sidebar';

interface RoleContextType {
  role: UserRole;
}

const RoleContext = createContext<RoleContextType>({ role: 'student' });

export function RoleProvider({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  return <RoleContext.Provider value={{ role }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
