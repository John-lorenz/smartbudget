import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('@smartbudget:user');
    const storedToken = localStorage.getItem('@smartbudget:token');

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  async function login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    const { user: userData, token } = response.data;

    localStorage.setItem('@smartbudget:token', token);
    localStorage.setItem('@smartbudget:user', JSON.stringify(userData));
    setUser(userData);
  }

  async function register(name, email, password) {
    const response = await api.post('/auth/register', { name, email, password });
    const { user: userData, token } = response.data;

    localStorage.setItem('@smartbudget:token', token);
    localStorage.setItem('@smartbudget:user', JSON.stringify(userData));
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('@smartbudget:token');
    localStorage.removeItem('@smartbudget:user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signed: !!user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
