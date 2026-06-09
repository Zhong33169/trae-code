import React from 'react';
import { AuthProvider } from './context/AuthContext';
import RecordQueue from './components/RecordQueue';
import './App.css';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <RecordQueue />
    </AuthProvider>
  );
};

export default App;
