"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, signInAnonymously } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "./firebase";
import { apiPost } from "./api";

export interface TenantUser {
  id: string;
  name: string;
  firebase_uid: string;
}

interface AuthContextType {
  user: User | null;
  tenant: TenantUser | null;
  loading: boolean;
  signup: (email: string, password: string, tenantName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginAnonymous: () => Promise<void>;
  logout: () => Promise<void>;
  refreshTenant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<TenantUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Ref tracks current tenant so onAuthStateChanged can skip redundant re-fetches
  const tenantRef = useRef<TenantUser | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Firebase fires onAuthStateChanged on every token refresh (~hourly).
        // If we already have a valid tenant for this user, don't re-fetch — that
        // would risk clearing the tenant if the network call fails.
        if (tenantRef.current?.firebase_uid === firebaseUser.uid) {
          setLoading(false);
          return;
        }

        let profile: TenantUser | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            profile = await apiPost<TenantUser>("/api/auth/profile", {
              firebase_uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              tenant_name: "",
            });
            break;
          } catch {
            if (attempt < 2) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          }
        }
        if (profile) {
          tenantRef.current = profile;
          setTenant(profile);
        }
        // If all retries fail and we have no profile, only clear tenant
        // when we're certain the user logged out (firebaseUser === null below).
        // Keeping stale tenant is safer than randomly ejecting the user.
      } else {
        tenantRef.current = null;
        setTenant(null);
      }

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signup = async (email: string, password: string, tenantName: string) => {
    let uid: string;
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      uid = credential.user.uid;
    } catch (err: unknown) {
      if (err instanceof FirebaseError && err.code === "auth/email-already-in-use") {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        uid = credential.user.uid;
      } else {
        throw err;
      }
    }
    try {
      await apiPost("/api/auth/signup", { email, tenant_name: tenantName, firebase_uid: uid });
    } catch (err: unknown) {
      if (!(err instanceof Error && err.message?.includes("409"))) throw err;
    }
    const profile = await apiPost<TenantUser>("/api/auth/profile", {
      email, tenant_name: tenantName, firebase_uid: uid,
    });
    tenantRef.current = profile;
    setTenant(profile);
  };

  const login = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const profile = await apiPost<TenantUser>("/api/auth/profile", {
      email,
      tenant_name: "",
      firebase_uid: credential.user.uid,
    });
    tenantRef.current = profile;
    setTenant(profile);
  };

  const loginAnonymous = async () => {
    await signInAnonymously(auth);
  };

  const logout = async () => {
    tenantRef.current = null;
    setTenant(null);
    await signOut(auth);
  };

  const refreshTenant = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    const profile = await apiPost<TenantUser>("/api/auth/profile", {
      firebase_uid: firebaseUser.uid,
      email: firebaseUser.email || "",
      tenant_name: "",
    });
    tenantRef.current = profile;
    setTenant(profile);
  };

  return (
    <AuthContext.Provider value={{ user, tenant, loading, signup, login, loginAnonymous, logout, refreshTenant }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
