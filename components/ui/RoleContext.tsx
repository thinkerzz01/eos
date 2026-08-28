'use client';

// Role is the AUTHORITATIVE server-derived role (from the `profiles` table),
// provided by the root layout. It is read-only on the client - there is no
// switcher. The database (RLS) is the real access lock; this only tailors which
// UI a user sees. (Closes audit finding C3: role is no longer a spoofable
// client-side toggle.)
import React, { createContext, useContext } from 'react';
import { UserRole } from '@/components/layout/Sidebar';

interface RoleContextType {
  role: UserRole;
  // The signed-in user's own display name (from profiles). '' when unknown.
  name: string;
}

const RoleContext = createContext<RoleContextType>({ role: 'student', name: '' });

export function RoleProvider({
  role,
  name = '',
  children,
}: {
  role: UserRole;
  name?: string;
  children: React.ReactNode;
}) {
  return <RoleContext.Provider value={{ role, name }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
