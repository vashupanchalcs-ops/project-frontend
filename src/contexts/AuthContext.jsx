import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "../services/firebase";
import { AuthContext } from "./auth-context";

const PROFILE_KEY = "swiftflix_profile";
const PROFILES = [
  { id: "p1", name: "Alex", avatar: "https://api.dicebear.com/9.x/thumbs/svg?seed=Alex" },
  { id: "p2", name: "Maya", avatar: "https://api.dicebear.com/9.x/thumbs/svg?seed=Maya" },
  { id: "p3", name: "Family", avatar: "https://api.dicebear.com/9.x/thumbs/svg?seed=Family" },
  { id: "p4", name: "Kids", avatar: "https://api.dicebear.com/9.x/thumbs/svg?seed=Kids" },
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeProfile, setActiveProfile] = useState(
    () => JSON.parse(localStorage.getItem(PROFILE_KEY) || "null")
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setActiveProfile(null);
        localStorage.removeItem(PROFILE_KEY);
      }
      setLoading(false);
    });

    return unsub;
  }, []);

  const signup = (email, password) => createUserWithEmailAndPassword(auth, email, password);
  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);

  const logout = async () => {
    await signOut(auth);
    setActiveProfile(null);
    localStorage.removeItem(PROFILE_KEY);
  };

  const selectProfile = (profile) => {
    setActiveProfile(profile);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      signup,
      login,
      logout,
      profiles: PROFILES,
      activeProfile,
      selectProfile,
    }),
    [user, loading, activeProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
