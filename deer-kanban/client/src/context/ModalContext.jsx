import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle, Info, XCircle, Users } from 'lucide-react';

const PromptInput = ({ defaultValue, options, onConfirm, onCancel }) => {
  const [val, setVal] = useState(defaultValue);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = (options || []).filter(opt => {
    const label = opt.label || opt.value || opt;
    // Extraer solo la última parte después de la coma para la búsqueda actual
    const parts = val.split(',');
    const currentSearch = parts[parts.length - 1].trim();
    if (!currentSearch) return true; // si no hay texto actual, mostrar todos
    return label.toLowerCase().includes(currentSearch.toLowerCase());
  });

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', marginBottom: '24px', textAlign: 'left' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input 
          autoFocus
          type="text" 
          className="input" 
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          id="prompt-input"
          style={{ flex: 1, margin: 0 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setShowDropdown(false);
              onConfirm(val);
            }
            if (e.key === 'Escape') onCancel();
          }}
          autoComplete="off"
          placeholder={options?.length > 0 ? "Ej. correo1@a.com, correo2@b.com..." : ""}
        />
        {options?.length > 0 && (
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setShowDropdown(!showDropdown)}
            title="Ver directorio de miembros"
          >
            <Users size={18} />
          </button>
        )}
      </div>

      {showDropdown && options?.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'var(--bg-primary, #ffffff)',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          maxHeight: '180px',
          overflowY: 'auto',
          zIndex: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          marginTop: '4px'
        }}>
          {filtered.length > 0 ? filtered.map((opt, i) => (
            <div 
              key={i}
              onMouseDown={(e) => {
                e.preventDefault();
                if (!opt.disabled) {
                  const parts = val.split(',');
                  parts[parts.length - 1] = parts.length > 1 ? ' ' + (opt.value || opt) : (opt.value || opt);
                  setVal(parts.join(','));
                  setShowDropdown(false);
                  document.getElementById('prompt-input').focus();
                }
              }}
              style={{ 
                padding: '10px 12px', 
                cursor: opt.disabled ? 'not-allowed' : 'pointer', 
                borderBottom: '1px solid var(--border-color)', 
                fontSize: '13px', 
                color: opt.disabled ? 'var(--text-secondary)' : 'var(--text-primary)',
                opacity: opt.disabled ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center'
              }}
              onMouseOver={(e) => { if (!opt.disabled) e.currentTarget.style.background = 'var(--bg-secondary, #f1f5f9)' }}
              onMouseOut={(e) => { if (!opt.disabled) e.currentTarget.style.background = 'transparent' }}
            >
              {opt.label || opt.value || opt}
            </div>
          )) : (
            <div style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>Sin coincidencias</div>
          )}
        </div>
      )}
    </div>
  );
};

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

  const showPrompt = (title, message, defaultValue = '', options = []) => {
    return new Promise((resolve) => {
      setModalState({
        type: 'prompt',
        variant: 'info',
        title,
        message,
        defaultValue,
        options,
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
          <div className="modal-content" style={{ maxWidth: modalState.type === 'prompt' ? '550px' : '400px', textAlign: 'center', padding: '32px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
              {renderIcon(modalState.variant)}
            </div>
            <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>{modalState.title}</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
              {modalState.message}
            </p>
            
            {modalState.type === 'prompt' && (
              <PromptInput 
                defaultValue={modalState.defaultValue}
                options={modalState.options}
                onConfirm={modalState.onConfirm}
                onCancel={modalState.onCancel}
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
                    // Si el usuario da clic en el botón de aceptar, onConfirm se dispara con el valor actual del input
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
