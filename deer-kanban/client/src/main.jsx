import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { ModalProvider } from './context/ModalContext';
import { SettingsProvider } from './context/SettingsContext';
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
    <AuthProvider>
      <SettingsProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </SettingsProvider>
    </AuthProvider>
)
