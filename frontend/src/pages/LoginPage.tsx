import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useApi } from '../hooks/useApi';
import { Button, Input } from '../components/ui';
import { ArrowRight, Shield } from 'lucide-react';
import { getKeycloakLoginUrl } from './KeycloakCallback';
import toast from 'react-hot-toast';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();
  const { request, loading } = useApi();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    if (!isLogin) {
      if (!formData.firstName) newErrors.firstName = 'First name is required';
      if (!formData.lastName) newErrors.lastName = 'Last name is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const response = await request({
        method: 'POST',
        url: endpoint,
        data: formData,
      });

      setToken(response.token);
      setUser(response.user);
      toast.success(isLogin ? 'Logged in successfully!' : 'Welcome! Account created.');
      navigate('/dashboard');
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || error?.message || 'Authentication failed';
      toast.error(errorMsg);
    }
  };

  const handleDemoLogin = async () => {
    try {
      const response = await request({
        method: 'POST',
        url: '/auth/demo-login',
        data: { email: 'demo@nova.local' },
      });
      setToken(response.token);
      setUser(response.user);
      toast.success('Demo mode activated!');
      navigate('/dashboard');
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || error?.message || 'Demo login failed';
      toast.error(errorMsg);
    }
  };

  const handleKeycloakLogin = () => {
    window.location.href = getKeycloakLoginUrl();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-500 to-purple-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-lg mb-4">
            <span className="text-2xl font-bold text-primary-600">N</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Nova</h1>
          <p className="text-primary-100 text-sm mt-2">Voice AI Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            {isLogin ? 'Welcome Back' : 'Get Started'}
          </h2>

          {/* Keycloak SSO */}
          <button
            onClick={handleKeycloakLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors mb-4"
          >
            <Shield className="w-5 h-5" />
            Sign in with Keycloak SSO
          </button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-gray-500">or continue with email</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  error={errors.firstName}
                  disabled={loading}
                />
                <Input
                  label="Last Name"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  error={errors.lastName}
                  disabled={loading}
                />
              </div>
            )}

            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={errors.email}
              disabled={loading}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              error={errors.password}
              disabled={loading}
            />

            <Button
              type="submit"
              loading={loading}
              className="w-full mt-2 flex items-center justify-center gap-2"
            >
              {isLogin ? 'Sign In' : 'Create Account'}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          {/* Toggle login/register */}
          <p className="text-center text-gray-600 text-sm mt-5">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setErrors({});
                setFormData({ email: '', password: '', firstName: '', lastName: '' });
              }}
              className="text-primary-600 font-semibold hover:underline ml-1"
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>

          {/* Demo */}
          <div className="mt-5 pt-5 border-t">
            <button
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
            >
              Try Demo (no account needed)
            </button>
          </div>
        </div>

        <p className="text-center text-white text-xs mt-8 opacity-75">
          &copy; {new Date().getFullYear()} Nova Voice AI. All rights reserved.
        </p>
      </div>
    </div>
  );
};
