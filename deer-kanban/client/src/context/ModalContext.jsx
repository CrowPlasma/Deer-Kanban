import React, { createContext, useState, useContext } from 'react';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

const ModalContext = createContext();

export const useModal = () => useContext(ModalContext);

export const ModalProvider = ({ children }) => {
  const [modalState, setModalState] = useState(null);

  const showConfirm = (title, message, type = 'danger') => {
    return new Promise((resolve) => {
      setModalState({
        type: 'confirm',
        variant: type,
        title,
        message,
        onConfirm: () => {
          setModalState(null);
          resolve(true);
        },
        onCancel: () => {
          setModalState(null);
          resolve(false);
        }
      });
    });
  };

  const showAlert = (title, message, type = 'info') => {
    return new Promise((resolve) => {
      setModalState({
        type: 'alert',
        variant: type,
        title,
        message,
        onConfirm: () => {
          setModalState(null);
          resolve(true);
        }
      });
    });
  };

  const showPrompt = (title, message, defaultValue = '') => {
    return new Promise((resolve) => {
      setModalState({
        type: 'prompt',
        variant: 'info',
        title,
        message,
        defaultValue,
        onConfirm: (val) => {
          setModalState(null);
          resolve(val);
        },
        onCancel: () => {
          setModalState(null);
          resolve(null);
        }
      });
    });
  };

  const renderIcon = (variant) => {
    switch(variant) {
      case 'danger': return <XCircle size={40} color="#ef4444" />;
      case 'warning': return <AlertCircle size={40} color="#f59e0b" />;
      case 'success': return <CheckCircle size={40} color="#10b981" />;
      default: return <Info size={40} color="var(--accent-blue)" />;
    }
  };

  return (
    <ModalContext.Provider value={{ showConfirm, showAlert, showPrompt }}>
      {children}
      {modalState && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center', padding: '32px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
              {renderIcon(modalState.variant)}
            </div>
            <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>{modalState.title}</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
              {modalState.message}
            </p>
            
            {modalState.type === 'prompt' && (
              <input 
                autoFocus
                type="text" 
                className="input" 
                defaultValue={modalState.defaultValue}
                id="prompt-input"
                style={{ width: '100%', marginBottom: '24px' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') modalState.onConfirm(e.target.value);
                  if (e.key === 'Escape') modalState.onCancel();
                }}
              />
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              {(modalState.type === 'confirm' || modalState.type === 'prompt') && (
                <button 
                  className="btn" 
                  onClick={modalState.onCancel}
                >
                  Cancelar
                </button>
              )}
              <button 
                className={`btn ${modalState.variant === 'danger' ? '' : 'btn-primary'}`} 
                style={modalState.variant === 'danger' ? { backgroundColor: '#ef4444', color: 'white', borderColor: 'transparent' } : {}}
                onClick={() => {
                  if (modalState.type === 'prompt') {
                    const val = document.getElementById('prompt-input').value;
                    modalState.onConfirm(val);
                  } else {
                    modalState.onConfirm();
                  }
                }}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};
