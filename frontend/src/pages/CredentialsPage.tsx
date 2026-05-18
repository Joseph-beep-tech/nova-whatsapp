import React, { useState, useEffect } from 'react';
import { Card, Button } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { Eye, EyeOff, ChevronDown, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const CredentialsPage: React.FC = () => {
  const { request, loading } = useApi();
  const [showSecrets, setShowSecrets] = useState(false);
  const [showSetupInstructions, setShowSetupInstructions] = useState(false);
  const [showSavedValues, setShowSavedValues] = useState(false);
  const [credentials, setCredentials] = useState({
    openaiApiKey: '',
    openaiSigningSecret: '',
    openaiProjectId: '',
  });
  const [twilioCreds, setTwilioCreds] = useState({
    twilioAccountSid: '',
    twilioAuthToken: '',
  });
  const [credentialStatus, setCredentialStatus] = useState<Record<string, boolean>>({
    openaiApiKey: false,
    openaiSigningSecret: false,
    openaiProjectId: false,
    twilioAccountSid: false,
    twilioAuthToken: false,
  });
  const [savedMasked, setSavedMasked] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const fetchStatus = async () => {
    try {
      const data = await request({ method: 'GET', url: '/credentials' });
      setCredentialStatus(data.status || {});
      setSavedMasked(data.masked || {});
    } catch (error) {
      console.error('Failed to load credential status');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setCredentials({ ...credentials, [field]: value });
    if (validationErrors[field]) {
      setValidationErrors({ ...validationErrors, [field]: '' });
    }
  };

  const handleSave = async () => {
    try {
      setValidationErrors({});
      const dataToSend: Record<string, string> = {};
      for (const [key, value] of Object.entries(credentials)) {
        if (value.trim()) {
          dataToSend[key] = value.trim();
        }
      }

      if (Object.keys(dataToSend).length === 0) {
        toast.error('Enter at least one credential to save');
        return;
      }

      const result = await request({
        method: 'PUT',
        url: '/credentials',
        data: dataToSend,
      });
      setCredentialStatus(result.status || {});
      setSavedMasked(result.masked || {});
      toast.success('Credentials saved successfully');
      setCredentials({ openaiApiKey: '', openaiSigningSecret: '', openaiProjectId: '' });
      setShowSavedValues(true);
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.errors) {
        setValidationErrors(error.response.data.errors);
      }
    }
  };

  const handleSaveTwilio = async () => {
    try {
      setValidationErrors({});
      const dataToSend: Record<string, string> = {};
      for (const [key, value] of Object.entries(twilioCreds)) {
        if (value.trim()) dataToSend[key] = value.trim();
      }
      if (Object.keys(dataToSend).length === 0) {
        toast.error('Enter your Twilio Account SID and Auth Token');
        return;
      }
      const result = await request({
        method: 'PUT',
        url: '/credentials/twilio',
        data: dataToSend,
      });
      setCredentialStatus(result.status || {});
      setSavedMasked(result.masked || {});
      toast.success('Twilio credentials saved — phone-number purchase is unlocked');
      setTwilioCreds({ twilioAccountSid: '', twilioAuthToken: '' });
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.errors) {
        setValidationErrors(error.response.data.errors);
      } else {
        toast.error('Failed to save Twilio credentials');
      }
    }
  };

  const handleLoadSaved = async () => {
    try {
      const data = await request({ method: 'GET', url: '/credentials' });
      setCredentialStatus(data.status || {});
      setSavedMasked(data.masked || {});
      setShowSavedValues(true);
      toast.success('Saved credentials loaded');
    } catch (error) {
      console.error('Failed to load saved values');
    }
  };

  const StatusIcon: React.FC<{ configured: boolean }> = ({ configured }) =>
    configured
      ? <CheckCircle className="w-4 h-4 text-green-600 inline mr-1" />
      : <XCircle className="w-4 h-4 text-gray-400 inline mr-1" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI Credentials</h1>
        <p className="text-gray-600 mt-2">Enter your OpenAI API credentials for Voice AI. These are stored encrypted and never shared.</p>
      </div>

      {/* Saved Values Card (read-only view) */}
      {showSavedValues && Object.values(credentialStatus).some(Boolean) && (
        <Card className="border border-green-200 bg-green-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-green-800">Your Saved Credentials</h3>
            <button onClick={() => setShowSavedValues(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-100">
              <div>
                <p className="text-sm font-medium text-gray-700"><StatusIcon configured={credentialStatus.openaiApiKey} />API Key</p>
                <p className="text-sm font-mono text-gray-500 mt-1">
                  {credentialStatus.openaiApiKey ? savedMasked.openaiApiKey || '••••••••' : 'Not configured'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-100">
              <div>
                <p className="text-sm font-medium text-gray-700"><StatusIcon configured={credentialStatus.openaiSigningSecret} />Signing Secret</p>
                <p className="text-sm font-mono text-gray-500 mt-1">
                  {credentialStatus.openaiSigningSecret ? savedMasked.openaiSigningSecret || '••••••••' : 'Not configured'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-100">
              <div>
                <p className="text-sm font-medium text-gray-700"><StatusIcon configured={credentialStatus.openaiProjectId} />Project ID</p>
                <p className="text-sm font-mono text-gray-500 mt-1">
                  {credentialStatus.openaiProjectId ? savedMasked.openaiProjectId || '••••••••' : 'Not configured'}
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs text-green-700 mt-3">To update, enter new values below and click Save.</p>
        </Card>
      )}

      {/* Input Form */}
      <Card>
        <h2 className="text-xl font-semibold text-gray-900 mb-6">OpenAI Configuration</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">API Key *</label>
            <div className="relative">
              <input
                type={showSecrets ? 'text' : 'password'}
                value={credentials.openaiApiKey}
                onChange={(e) => handleInputChange('openaiApiKey', e.target.value)}
                placeholder={credentialStatus.openaiApiKey ? 'Enter new key to update' : 'Paste your API key here'}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.openaiApiKey ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              <button
                onClick={() => setShowSecrets(!showSecrets)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              >
                {showSecrets ? <EyeOff className="w-5 h-5 text-gray-600" /> : <Eye className="w-5 h-5 text-gray-600" />}
              </button>
            </div>
            {validationErrors.openaiApiKey ? (
              <p className="text-xs text-red-500 mt-1">{validationErrors.openaiApiKey}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                Go to platform.openai.com &gt; API Keys &gt; Create new secret key
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Signing Secret *</label>
            <input
              type="password"
              value={credentials.openaiSigningSecret}
              onChange={(e) => handleInputChange('openaiSigningSecret', e.target.value)}
              placeholder={credentialStatus.openaiSigningSecret ? 'Enter new secret to update' : 'Paste your signing secret here'}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.openaiSigningSecret ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {validationErrors.openaiSigningSecret ? (
              <p className="text-xs text-red-500 mt-1">{validationErrors.openaiSigningSecret}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                Settings &gt; Signing &gt; Copy your signing secret
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project ID</label>
            <input
              type="text"
              value={credentials.openaiProjectId}
              onChange={(e) => handleInputChange('openaiProjectId', e.target.value)}
              placeholder={credentialStatus.openaiProjectId ? 'Enter new ID to update' : 'Paste your project ID here'}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                validationErrors.openaiProjectId ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {validationErrors.openaiProjectId ? (
              <p className="text-xs text-red-500 mt-1">{validationErrors.openaiProjectId}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                Settings &gt; Project &gt; Copy your Project ID
              </p>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <Button onClick={handleSave} loading={loading}>
              Save Credentials
            </Button>
            <button
              onClick={handleLoadSaved}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Load Saved Values
            </button>
          </div>
        </div>
      </Card>

      {/* Status Badges */}
      <Card>
        <div className="flex flex-wrap gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${credentialStatus.openaiApiKey ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            API Key: {credentialStatus.openaiApiKey ? 'Configured' : 'Not Configured'}
          </span>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${credentialStatus.openaiSigningSecret ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            Signing Secret: {credentialStatus.openaiSigningSecret ? 'Configured' : 'Not Configured'}
          </span>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${credentialStatus.openaiProjectId ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            Project ID: {credentialStatus.openaiProjectId ? 'Configured' : 'Not Configured'}
          </span>
        </div>
      </Card>

      {/* Twilio Configuration (powers number search + purchase) */}
      <Card>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Twilio Configuration</h2>
        <p className="text-sm text-gray-500 mb-6">
          Enter your Twilio credentials to search & purchase phone numbers from inside the portal.
          Without these, you can still bring an existing Twilio number — but you'll have to configure its
          Voice URL by hand on the Twilio console.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Account SID *</label>
            <input
              type="text"
              value={twilioCreds.twilioAccountSid}
              onChange={(e) => {
                setTwilioCreds({ ...twilioCreds, twilioAccountSid: e.target.value });
                if (validationErrors.twilioAccountSid) setValidationErrors({ ...validationErrors, twilioAccountSid: '' });
              }}
              placeholder={credentialStatus.twilioAccountSid ? 'Enter new SID to update' : 'AC...'}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm ${
                validationErrors.twilioAccountSid ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {validationErrors.twilioAccountSid ? (
              <p className="text-xs text-red-500 mt-1">{validationErrors.twilioAccountSid}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                Twilio Console &gt; Account &gt; API keys &amp; tokens &gt; Account SID
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Auth Token *</label>
            <input
              type={showSecrets ? 'text' : 'password'}
              value={twilioCreds.twilioAuthToken}
              onChange={(e) => {
                setTwilioCreds({ ...twilioCreds, twilioAuthToken: e.target.value });
                if (validationErrors.twilioAuthToken) setValidationErrors({ ...validationErrors, twilioAuthToken: '' });
              }}
              placeholder={credentialStatus.twilioAuthToken ? 'Enter new token to update' : 'Twilio Auth Token'}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm ${
                validationErrors.twilioAuthToken ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {validationErrors.twilioAuthToken ? (
              <p className="text-xs text-red-500 mt-1">{validationErrors.twilioAuthToken}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                Twilio Console &gt; Account &gt; API keys &amp; tokens &gt; Auth Token
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 mt-6">
            <Button onClick={handleSaveTwilio} loading={loading}>
              Save Twilio Credentials
            </Button>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              credentialStatus.twilioAccountSid && credentialStatus.twilioAuthToken
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {credentialStatus.twilioAccountSid && credentialStatus.twilioAuthToken
                ? 'Twilio: Configured'
                : 'Twilio: Not Configured'}
            </span>
          </div>
        </div>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <button
          onClick={() => setShowSetupInstructions(!showSetupInstructions)}
          className="w-full flex items-center justify-between p-0 hover:opacity-75 transition-opacity"
        >
          <h3 className="text-lg font-semibold text-gray-900">Setup Instructions</h3>
          <ChevronDown className={`w-5 h-5 text-gray-600 transition-transform ${showSetupInstructions ? 'rotate-180' : ''}`} />
        </button>
        {showSetupInstructions && (
          <div className="space-y-3 text-sm text-gray-700 mt-4 pt-4 border-t border-gray-200">
            <ol className="list-decimal list-inside space-y-2 text-gray-600">
              <li>Go to <span className="font-semibold text-gray-900">platform.openai.com</span> &gt; API Keys &gt; Create new secret key</li>
              <li>Copy the key and paste it in the "API Key" field above</li>
              <li>Go to Settings &gt; Signing &gt; Copy your signing secret</li>
              <li>Go to Settings &gt; Project &gt; Copy your Project ID</li>
              <li>Click "Save Credentials" to store all three values</li>
            </ol>
          </div>
        )}
      </Card>
    </div>
  );
};
