import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async (config: any) => {
    setLoading(true);
    setError(null);
    try {
      console.log('[API Request]', config.method?.toUpperCase(), config.url);
      const response = await api(config);
      console.log('[API Response]', config.url, response.data);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'An error occurred';
      console.error('[API Error]', config.url, message);
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { request, loading, error };
};
