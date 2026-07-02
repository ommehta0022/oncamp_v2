import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  canCreatePosts: boolean;
  canCreateGroups: boolean;
  canManageInstitution: boolean;
  isGroupAdmin: boolean;
};

const STORAGE_KEY = "oncampus.role";
const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("normal_user");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v) setRoleState(v as Role);
      setHydrated(true);
    });
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    AsyncStorage.setItem(STORAGE_KEY, r);
  }, []);

  const canCreatePosts = role === "institution_admin" || role === "group_owner" || role === "group_admin" || role === "platform_admin";
  const canCreateGroups = role === "institution_admin" || role === "platform_admin";
  const canManageInstitution = role === "institution_admin" || role === "platform_admin";
  const isGroupAdmin = role === "group_owner" || role === "group_admin" || role === "moderator" || role === "platform_admin";

  if (!hydrated) return null;

  return (
    <RoleContext.Provider value={{ role, setRole, canCreatePosts, canCreateGroups, canManageInstitution, isGroupAdmin }}>
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
