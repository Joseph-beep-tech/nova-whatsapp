import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

// Pages
import { LoginPage } from './pages/LoginPage';
import { CredentialsPage } from './pages/CredentialsPage';
import { GCPConfigPage } from './pages/GCPConfigPage';
import { PromptsPage } from './pages/PromptsPage';
import { PhoneNumbersPage } from './pages/PhoneNumbersPage';
import { CreditsPage } from './pages/CreditsPage';
import { TestCallPage } from './pages/TestCallPage';
import { AutopilotPage } from './pages/AutopilotPage';
import { DashboardPage } from './pages/DashboardPage';
import { MCPToolsPage } from './pages/MCPToolsPage';
import { WhatsAppPage } from './pages/WhatsAppPage';
import { WhatsAppChatsPage } from './pages/WhatsAppChatsPage';
import { WhatsAppLeadsPage } from './pages/WhatsAppLeadsPage';
import { CallHistoryPage } from './pages/CallHistoryPage';
import { KeycloakCallback } from './pages/KeycloakCallback';

// Components
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';

const PrivateLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex h-screen bg-gray-100">
    <Sidebar />
    <div className="flex-1 overflow-auto">
      <Navbar />
      <main className="p-6 max-w-7xl mx-auto">{children}</main>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? (
    <PrivateLayout>{children}</PrivateLayout>
  ) : (
    <Navigate to="/login" />
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/keycloak/callback" element={<KeycloakCallback />} />

        <Route
          path="/credentials"
          element={
            <ProtectedRoute>
              <CredentialsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gcp-config"
          element={
            <ProtectedRoute>
              <GCPConfigPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/prompts"
          element={
            <ProtectedRoute>
              <PromptsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/phone-numbers"
          element={
            <ProtectedRoute>
              <PhoneNumbersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/credits"
          element={
            <ProtectedRoute>
              <CreditsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/test-call"
          element={
            <ProtectedRoute>
              <TestCallPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/autopilot"
          element={
            <ProtectedRoute>
              <AutopilotPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/call-history"
          element={
            <ProtectedRoute>
              <CallHistoryPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/whatsapp"
          element={
            <ProtectedRoute>
              <WhatsAppPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/whatsapp/:sessionId/chats"
          element={
            <ProtectedRoute>
              <WhatsAppChatsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/whatsapp/leads"
          element={
            <ProtectedRoute>
              <WhatsAppLeadsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/mcp-tools"
          element={
            <ProtectedRoute>
              <MCPToolsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>

      <Toaster position="top-right" />
    </Router>
  );
}
