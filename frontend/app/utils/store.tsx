import { createContext, useContext, useState } from "react";
import type { Role, User } from "./types";

interface UserContextValue {
  currentUser: User;
  setCurrentUser: (user: User) => void;
}

const USERS: User[] = [
  { id: "u1", name: "张登记", role: "registrar" as Role },
  { id: "u2", name: "李审核", role: "reviewer" as Role },
  { id: "u3", name: "王复核", role: "rechecker" as Role },
];

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User>(USERS[0]);

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}

export { USERS };
