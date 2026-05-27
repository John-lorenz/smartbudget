import { createContext, useContext, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext({});

function getStoredUser() {
  const storedUser = localStorage.getItem('@smartbudget:user');
  const storedToken = localStorage.getItem('@smartbudget:token');

  if (!storedUser || !storedToken) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch {
    localStorage.removeItem('@smartbudget:user');
    localStorage.removeItem('@smartbudget:token');
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const loading = false;

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

  async function refreshUser() {
    const { data } = await api.get('/auth/me');
    localStorage.setItem('@smartbudget:user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  return (
    <AuthContext.Provider value={{ user, loading, signed: !!user, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook mantido aqui para preservar os imports já existentes no projeto.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
