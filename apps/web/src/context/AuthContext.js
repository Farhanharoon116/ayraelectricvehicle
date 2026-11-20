import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from "react";
import { fetchApi } from "../lib/api";
const AuthContext = createContext(undefined);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const fetchCurrentUser = async () => {
        try {
            const data = await fetchApi("/api/auth/me");
            setUser(data.user);
        }
        catch {
            setUser(null);
        }
        finally {
            setIsLoading(false);
        }
    };
    useEffect(() => {
        fetchCurrentUser();
    }, []);
    const login = async (email, password) => {
        const data = await fetchApi("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });
        setUser(data.user);
    };
    const logout = async () => {
        await fetchApi("/api/auth/logout", { method: "POST" });
        setUser(null);
    };
    return (_jsx(AuthContext.Provider, { value: {
            user,
            isLoading,
            login,
            logout,
            refetchUser: fetchCurrentUser,
        }, children: children }));
}
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
