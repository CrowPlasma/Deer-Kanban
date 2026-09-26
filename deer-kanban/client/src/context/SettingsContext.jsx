import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from './AuthContext';

export const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);
  const { user } = useContext(AuthContext);

  const fetchSettings = async () => {
    if (!user) {
      setSettings(null);
      return;
    }
    try {
      const res = await axios.get('/api/settings');
      setSettings(res.data);
    } catch (e) {
      console.error('Error fetching settings', e);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user]);

  return (
    <SettingsContext.Provider value={{ settings, fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};
