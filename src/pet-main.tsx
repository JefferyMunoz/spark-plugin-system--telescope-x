import React from 'react';
import { createRoot } from 'react-dom/client';
import PetView from './components/Pet/PetView';
import './index.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(<PetView />);
