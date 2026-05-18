import React, { useState, useEffect } from 'react';
import { Card, Button } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { ChevronDown, Eye, EyeOff, Upload, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const GCPConfigPage: React.FC = () => {
  const { request, loading } = useApi();
  const [showSetupInstructions, setShowSetupInstructions] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [showFolderId, setShowFolderId] = useState(false);
  const [showSavedValues, setShowSavedValues] = useState(false);
  const [credentials, setCredentials] = useState({
    gcpServiceAccount: '',
    gcpDriveFolderId: '',
  });
  const [credentialStatus, setCredentialStatus] = useState<Record<string, boolean>>({
    gcpServiceAccount: false,
    gcpDriveFolderId: false,
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
      setCredentialStatus({
        gcpServiceAccount: data.status?.gcpServiceAccount || false,
        gcpDriveFolderId: data.status?.gcpDriveFolderId || false,
      });
      setSavedMasked({
        gcpServiceAccount: data.masked?.gcpServiceAccount || '',
        gcpDriveFolderId: data.masked?.gcpDriveFolderId || '',
      });
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
        url: '/credentials/gcp',
        data: dataToSend,
      });
      setCredentialStatus({
        gcpServiceAccount: result.status?.gcpServiceAccount || false,
        gcpDriveFolderId: result.status?.gcpDriveFolderId || false,
      });
      setSavedMasked({
        gcpServiceAccount: result.masked?.gcpServiceAccount || '',
        gcpDriveFolderId: result.masked?.gcpDriveFolderId || '',
      });
      toast.success('Google Cloud credentials saved successfully');
      setCredentials({ gcpServiceAccount: '', gcpDriveFolderId: '' });
      setShowSavedValues(true);
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.errors) {
        setValidationErrors(error.response.data.errors);
      }
    }
  };

  const handleLoadSaved = async () => {
    try {
      const data = await request({ method: 'GET', url: '/credentials' });
      setCredentialStatus({
        gcpServiceAccount: data.status?.gcpServiceAccount || false,
        gcpDriveFolderId: data.status?.gcpDriveFolderId || false,
      });
      setSavedMasked({
        gcpServiceAccount: data.masked?.gcpServiceAccount || '',
        gcpDriveFolderId: data.masked?.gcpDriveFolderId || '',
      });
      setShowSavedValues(true);
      toast.success('Saved credentials loaded');
    } catch (error) {
      console.error('Failed to load saved values');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setValidationErrors({ ...validationErrors, gcpServiceAccount: 'Please upload a .json file' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        JSON.parse(content);
        handleInputChange('gcpServiceAccount', content);
        toast.success('Service account JSON loaded from file');
      } catch {
        setValidationErrors({ ...validationErrors, gcpServiceAccount: 'File does not contain valid JSON' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const StatusIcon: React.FC<{ configured: boolean }> = ({ configured }) =>
    configured
      ? <CheckCircle className="w-4 h-4 text-green-600 inline mr-1" />
      : <XCircle className="w-4 h-4 text-gray-400 inline mr-1" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Google Cloud Configuration</h1>
        <p className="text-gray-600 mt-2">Upload your GCP service account JSON and configure your Google Drive folder for documents.</p>
      </div>

      {/* Saved Values Card (read-only) */}
      {showSavedValues && Object.values(credentialStatus).some(Boolean) && (
        <Card className="border border-green-200 bg-green-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-green-800">Your Saved Google Cloud Credentials</h3>
            <button onClick={() => setShowSavedValues(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-white rounded-lg border border-green-100">
              <p className="text-sm font-medium text-gray-700 mb-1"><StatusIcon configured={credentialStatus.gcpServiceAccount} />Service Account JSON</p>
              {credentialStatus.gcpServiceAccount ? (
                <pre className="text-xs font-mono text-gray-500 whitespace-pre-wrap max-h-40 overflow-y-auto bg-gray-50 p-2 rounded">
                  {savedMasked.gcpServiceAccount || '••••••••'}
                </pre>
              ) : (
                <p className="text-sm text-gray-400">Not configured</p>
              )}
            </div>
            <div className="p-3 bg-white rounded-lg border border-green-100">
              <p className="text-sm font-medium text-gray-700"><StatusIcon configured={credentialStatus.gcpDriveFolderId} />Google Drive Folder ID</p>
              <p className="text-sm font-mono text-gray-500 mt-1">
                {credentialStatus.gcpDriveFolderId ? savedMasked.gcpDriveFolderId || '••••••••' : 'Not configured'}
              </p>
            </div>
          </div>
          <p className="text-xs text-green-700 mt-3">To update, enter new values below and click Save.</p>
        </Card>
      )}

      {/* Input Form */}
      <Card>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Service Account JSON <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <textarea
                value={credentials.gcpServiceAccount}
                onChange={(e) => handleInputChange('gcpServiceAccount', e.target.value)}
                placeholder={credentialStatus.gcpServiceAccount ? 'Paste new JSON to update' : '{"type": "service_account", "project_id": "...", ...}'}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-xs ${
                  validationErrors.gcpServiceAccount ? 'border-red-400' : 'border-gray-300'
                }`}
                style={{
                  minHeight: '100px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  letterSpacing: showJson ? 'normal' : '0.3em',
                  color: showJson ? 'inherit' : 'transparent',
                  textShadow: showJson ? 'none' : '0 0 8px rgba(0,0,0,0.5)',
                  WebkitTextFillColor: showJson ? 'inherit' : 'transparent',
                }}
              />
              <button
                onClick={() => setShowJson(!showJson)}
                className="absolute right-3 top-3 p-2 hover:bg-gray-100 rounded text-gray-600"
              >
                {showJson ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                <Upload className="w-4 h-4" />
                Upload JSON File
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              <span className="text-xs text-gray-500">or paste the JSON content above</span>
            </div>
            {validationErrors.gcpServiceAccount ? (
              <p className="text-xs text-red-500 mt-1">{validationErrors.gcpServiceAccount}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                Download from console.cloud.google.com &gt; IAM & Admin &gt; Service Accounts &gt; Keys
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Google Drive Folder ID</label>
            <div className="relative">
              <input
                type={showFolderId ? 'text' : 'password'}
                value={credentials.gcpDriveFolderId}
                onChange={(e) => handleInputChange('gcpDriveFolderId', e.target.value)}
                placeholder={credentialStatus.gcpDriveFolderId ? 'Enter new ID to update' : 'Folder ID from URL'}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.gcpDriveFolderId ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              <button
                onClick={() => setShowFolderId(!showFolderId)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 hover:bg-gray-100 rounded text-gray-600"
              >
                {showFolderId ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {validationErrors.gcpDriveFolderId ? (
              <p className="text-xs text-red-500 mt-1">{validationErrors.gcpDriveFolderId}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-2">
                The folder ID from the URL: drive.google.com/drive/folders/<span className="font-semibold">THIS_PART</span>
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} loading={loading}>
              Save Google Cloud Credentials
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
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${credentialStatus.gcpServiceAccount ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            Service Account: {credentialStatus.gcpServiceAccount ? 'Configured' : 'Not Configured'}
          </span>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${credentialStatus.gcpDriveFolderId ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            Drive Folder ID: {credentialStatus.gcpDriveFolderId ? 'Configured' : 'Not Configured'}
          </span>
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
              <li>Go to <span className="font-semibold text-gray-900">console.cloud.google.com</span> &gt; IAM & Admin &gt; Service Accounts</li>
              <li>Create a service account with "Google Drive API" access</li>
              <li>Download the JSON key file</li>
              <li>Upload or paste the JSON content above</li>
              <li>Create a Google Drive folder for your documents</li>
              <li>Share the folder with the service account email (found in the JSON as <code className="bg-gray-100 px-1 rounded">client_email</code>)</li>
              <li>Copy the folder ID from the URL and paste above</li>
              <li>Click "Save Google Cloud Credentials"</li>
            </ol>
          </div>
        )}
      </Card>
    </div>
  );
};
