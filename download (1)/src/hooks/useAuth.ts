"use client";

import { useContext } from 'react';
import { AuthContext, type AuthContextType } from '@/context/AuthContext';
import { useFirebase } from '@/firebase';

// This file is now redundant and can be removed, but we keep it for now to avoid breaking imports
// The functionality has been moved directly into components that need it.
export const useLegacyAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export { useAuth } from '@/firebase';
