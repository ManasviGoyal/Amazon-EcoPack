import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Your App.js component
import './index.css'; // Your main CSS file, typically for Tailwind imports

// Get the root element from index.html
const rootElement = document.getElementById('root');

// Create a root and render the App component
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
