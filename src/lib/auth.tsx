import { createContext, useContext, useState, ReactNode } from "react";

export type CurrentUser = {
  id: string;
  nome: string;
  email: string;
  perfil: "admin" | "gestor";
} | null;

type AuthContextType = {
  user: CurrentUser;
  setUser: (u: CurrentUser) => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser>(null);
  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
