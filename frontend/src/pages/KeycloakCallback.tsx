import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useApi } from '../hooks/useApi';
import toast from 'react-hot-toast';

const KEYCLOAK_URL = (import.meta as any).env?.VITE_KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = (import.meta as any).env?.VITE_KEYCLOAK_REALM || 'nova';
const KEYCLOAK_CLIENT_ID = (import.meta as any).env?.VITE_KEYCLOAK_CLIENT_ID || 'nova-voice-portal';

export function getKeycloakLoginUrl(): string {
  const redirectUri = `${window.location.origin}/auth/keycloak/callback`;
  return `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth?client_id=${KEYCLOAK_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid profile email`;
}

export const KeycloakCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();
  const { request } = useApi();
  const [status, setStatus] = useState('Completing sign in...');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('Authentication was cancelled or failed.');
      toast.error('Keycloak login failed');
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    if (!code) {
      setStatus('No authorization code received.');
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    const exchangeCode = async () => {
      try {
        const redirectUri = `${window.location.origin}/auth/keycloak/callback`;
        const response = await request({
          method: 'POST',
          url: '/auth/keycloak',
          data: { code, redirectUri },
        });

        setToken(response.token);
        setUser(response.user);
        toast.success(`Welcome, ${response.user.firstName}!`);
        navigate('/dashboard');
      } catch (err: any) {
        const msg = err?.response?.data?.error || 'Keycloak login failed';
        setStatus(msg);
        toast.error(msg);
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    exchangeCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-700 font-medium">{status}</p>
      </div>
    </div>
  );
};
