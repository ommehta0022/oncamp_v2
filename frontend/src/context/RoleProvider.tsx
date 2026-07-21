import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter, Platform } from "react-native";
import { api, SESSION_EXPIRED_EVENT, SessionUser } from "@/src/lib/api";

export type Role =
  | "normal_user"
  | "institution_admin"
  | "group_owner"
  | "group_admin"
  | "moderator"
  | "platform_admin";

type RoleContextValue = {
  role: Role;
  setRole: (r: Role) => void;
  user: SessionUser | null;
  refreshUser: () => Promise<void>;
  canCreatePosts: boolean;
  canCreateGroups: boolean;
  canManageInstitution: boolean;
  isGroupAdmin: boolean;
};

const STORAGE_KEY = "oncampus.role";
const USER_CACHE_KEY = "oncampus.user";
const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("normal_user");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(USER_CACHE_KEY)]).then(([storedRole, storedUser]) => {
      if (storedUser) {
        const parsed = JSON.parse(storedUser) as SessionUser;
        setUser(parsed);
        setRoleState(resolveRole(parsed, storedRole as Role | null));
      } else if (storedRole) {
        setRoleState(storedRole as Role);
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    const clearCachedIdentity = () => {
      setUser(null);
      setRoleState("normal_user");
    };

    let subscription: { remove: () => void } | null = null;
    if (Platform.OS === "web") {
      window.addEventListener(SESSION_EXPIRED_EVENT, clearCachedIdentity);
    } else {
      subscription = DeviceEventEmitter.addListener(SESSION_EXPIRED_EVENT, clearCachedIdentity);
    }

    return () => {
      if (Platform.OS === "web") {
        window.removeEventListener(SESSION_EXPIRED_EVENT, clearCachedIdentity);
      } else {
        subscription?.remove();
      }
    };
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const nextUser = await api.auth.me();
      setUser(nextUser);
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(nextUser));
      const nextRole = resolveRole(nextUser, null);
      setRoleState(nextRole);
      await AsyncStorage.setItem(STORAGE_KEY, nextRole);
    } catch (e: any) {
      if (e?.code === "UNAUTHENTICATED" || e?.status === 401 || e?.message === "Authentication failed") {
        setUser(null);
        setRoleState("normal_user");
        await AsyncStorage.removeItem(USER_CACHE_KEY);
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
      throw e;
    }
  }, []);

  const setRole = useCallback((r: Role) => {
    if (!__DEV__) return;
    setRoleState(r);
    AsyncStorage.setItem(STORAGE_KEY, r);
  }, []);

  const canCreatePosts = !!user?.canCreatePosts || role === "institution_admin" || role === "group_owner" || role === "group_admin" || role === "platform_admin";
  const canCreateGroups = !!user?.canCreateGroups || role === "institution_admin" || role === "platform_admin";
  const canManageInstitution = role === "institution_admin" || role === "platform_admin";
  const isGroupAdmin = role === "group_owner" || role === "group_admin" || role === "moderator" || role === "platform_admin";

  if (!hydrated) return null;

  return (
    <RoleContext.Provider value={{ role, setRole, user, refreshUser, canCreatePosts, canCreateGroups, canManageInstitution, isGroupAdmin }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}

export const ROLE_LABELS: Record<Role, string> = {
  normal_user: "Normal user",
  institution_admin: "Institution admin",
  group_owner: "Group owner",
  group_admin: "Group admin",
  moderator: "Moderator",
  platform_admin: "Platform admin",
};

function resolveRole(user: SessionUser, storedRole: Role | null): Role {
  const roles = user.roles || [];
  if (roles.includes("platform_admin")) return "platform_admin";
  if (roles.includes("institution_admin") || user.accountType === "institution_admin") return "institution_admin";
  if (roles.includes("group_owner")) return "group_owner";
  if (roles.includes("group_admin")) return "group_admin";
  if (roles.includes("moderator")) return "moderator";
  if (__DEV__ && storedRole) return storedRole;
  return "normal_user";
}
