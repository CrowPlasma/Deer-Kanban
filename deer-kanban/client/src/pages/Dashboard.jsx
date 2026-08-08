import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import KanbanBoard from '../components/KanbanBoard';
import AdminPanel from '../components/AdminPanel';

const Dashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const [currentBoardId, setCurrentBoardId] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);

  return (
    <div className="app-container">
      <Sidebar 
        onSelectBoard={(id) => { setCurrentBoardId(id); setShowAdmin(false); }} 
        currentBoardId={currentBoardId} 
        user={user}
        onAdminClick={() => setShowAdmin(true)}
      />
      <div className="main-content">
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px' }}>
          {/* Header area, currently empty since logout moved to sidebar */}
        </div>
        
        {showAdmin ? (
          <div style={{ padding: '24px', width: '100%', overflowY: 'auto' }}>
            <AdminPanel />
          </div>
        ) : currentBoardId ? (
          <KanbanBoard boardId={currentBoardId} user={user} />
        ) : (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            background: "url('/colorful_poly_deer.jpg') center/cover no-repeat",
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'var(--bg-body)',
              opacity: 0.75
            }}></div>
            <div className="card" style={{ position: 'relative', padding: '48px 64px', textAlign: 'center', zIndex: 1 }}>
              <p style={{ margin: 0, fontSize: '18px', fontWeight: '500', color: 'var(--text-primary)' }}>
                Selecciona o crea un tablero para comenzar.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
