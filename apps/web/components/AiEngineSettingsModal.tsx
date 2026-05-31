'use client';

import { Eye, EyeOff, Check, RotateCcw, AlertTriangle, Play, Cpu, Server, Shield } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { useLanguage } from '../app/LanguageContext';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';

interface AiEngineSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Provider = 'OpenAI' | 'Anthropic' | 'Gemini' | 'Custom';
type Status = 'Simulated' | 'Connected' | 'Invalid key';

// Dependent model presets
const MODEL_PRESETS: Record<Exclude<Provider, 'Custom'>, string[]> = {
  OpenAI: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  Anthropic: ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-haiku'],
  Gemini: ['gemini-1.5-pro', 'gemini-1.5-flash'],
};

export const AiEngineSettingsModal: React.FC<AiEngineSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { language } = useLanguage();

  // Translations
  const t = (key: string): string => {
    const dict: Record<string, { en: string; es: string }> = {
      title: {
        en: 'AI Engine Settings',
        es: 'Configuración del Motor de IA',
      },
      subtitle: {
        en: 'Configure API endpoints and credentials for institutional advisory and copilot simulation.',
        es: 'Configure credenciales y endpoints de API para asesoramiento institucional y simulación del copiloto.',
      },
      provider: {
        en: 'AI Provider',
        es: 'Proveedor de IA',
      },
      model: {
        en: 'Model Selection',
        es: 'Selección de Modelo',
      },
      apiKey: {
        en: 'API Key',
        es: 'API Key',
      },
      baseUrl: {
        en: 'Base URL (Optional)',
        es: 'Base URL (Opcional)',
      },
      statusLabel: {
        en: 'Current Status',
        es: 'Estado Actual',
      },
      simulated: {
        en: 'Simulated Mode',
        es: 'Modo Simulado',
      },
      connected: {
        en: 'Connected',
        es: 'Conectado',
      },
      invalidKey: {
        en: 'Invalid Key',
        es: 'Key Inválida',
      },
      testConnection: {
        en: 'Test Connection',
        es: 'Probar Conexión',
      },
      testing: {
        en: 'Testing...',
        es: 'Probando...',
      },
      savePreferences: {
        en: 'Save Preferences',
        es: 'Guardar Preferencias',
      },
      resetSimulated: {
        en: 'Reset to Simulated',
        es: 'Restablecer Simulado',
      },
      disclaimer: {
        en: 'Client-side API keys are demo-only and not recommended for production.',
        es: 'Las API keys del lado del cliente son solo para demostración y no se recomiendan para producción.',
      },
      successSaved: {
        en: 'Preferences saved successfully.',
        es: 'Preferencias guardadas con éxito.',
      },
      connectionSuccess: {
        en: 'Connection test passed successfully!',
        es: '¡Prueba de conexión exitosa!',
      },
      connectionFailed: {
        en: 'Connection test failed. Please verify API key format.',
        es: 'Error en prueba de conexión. Verifique el formato de la API key.',
      },
    };

    return dict[key]?.[language] || key;
  };

  // Form State
  const [provider, setProvider] = useState<Provider>('OpenAI');
  const [model, setModel] = useState<string>('gpt-4o');
  const [apiKey, setApiKey] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [status, setStatus] = useState<Status>('Simulated');
  
  // UI helper states
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedProvider = localStorage.getItem('aurex_ai_provider') as Provider || 'OpenAI';
      const savedModel = localStorage.getItem('aurex_ai_model') || 'gpt-4o';
      const savedKey = localStorage.getItem('aurex_ai_key') || '';
      const savedBaseUrl = localStorage.getItem('aurex_ai_base_url') || '';
      const savedStatus = localStorage.getItem('aurex_ai_status') as Status || 'Simulated';

      setProvider(savedProvider);
      setModel(savedModel);
      setApiKey(savedKey);
      setBaseUrl(savedBaseUrl);
      setStatus(savedStatus);
    }
  }, [isOpen]);

  // Adjust model automatically when provider changes
  const handleProviderChange = (newProvider: Provider) => {
    setProvider(newProvider);
    if (newProvider !== 'Custom') {
      setModel(MODEL_PRESETS[newProvider][0]);
    } else {
      setModel('llama-3-8b');
    }
    setTestResult(null);
  };

  // Test Connection simulation
  const handleTestConnection = () => {
    if (isTesting) return;
    setIsTesting(true);
    setTestResult(null);

    // Simulate network delay
    setTimeout(() => {
      setIsTesting(false);
      
      // Simple validation: key must exist and be > 8 characters. If it contains "invalid", "error" or is too short, fail.
      const cleanedKey = apiKey.trim();
      const isInvalid = !cleanedKey || cleanedKey.length < 8 || cleanedKey.toLowerCase().includes('invalid') || cleanedKey.toLowerCase().includes('error');

      if (isInvalid) {
        setTestResult({
          success: false,
          msg: t('connectionFailed'),
        });
        setStatus('Invalid key');
      } else {
        setTestResult({
          success: true,
          msg: t('connectionSuccess'),
        });
        setStatus('Connected');
      }
    }, 1200);
  };

  // Save Preferences
  const handleSavePreferences = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aurex_ai_provider', provider);
      localStorage.setItem('aurex_ai_model', model);
      localStorage.setItem('aurex_ai_key', apiKey);
      localStorage.setItem('aurex_ai_base_url', baseUrl);
      localStorage.setItem('aurex_ai_status', status);

      // Trigger a storage event to notify other components of the change
      window.dispatchEvent(new Event('storage'));
    }

    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1000);
  };

  // Reset to Simulated Mode
  const handleResetToSimulated = () => {
    setProvider('OpenAI');
    setModel('gpt-4o');
    setApiKey('');
    setBaseUrl('');
    setStatus('Simulated');
    setTestResult(null);

    if (typeof window !== 'undefined') {
      localStorage.setItem('aurex_ai_provider', 'OpenAI');
      localStorage.setItem('aurex_ai_model', 'gpt-4o');
      localStorage.setItem('aurex_ai_key', '');
      localStorage.setItem('aurex_ai_base_url', '');
      localStorage.setItem('aurex_ai_status', 'Simulated');

      window.dispatchEvent(new Event('storage'));
    }

    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border border-white/10 bg-slate-950 p-6 shadow-2xl rounded-xl max-w-lg overflow-hidden font-sans">
        <DialogHeader className="border-b border-white/5 pb-3">
          <div className="flex items-center gap-2 text-gold">
            <Cpu className="w-5 h-5 animate-pulse" />
            <DialogTitle className="text-sm font-bold font-mono tracking-wider uppercase text-white">
              {t('title')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-400 mt-1">
            {t('subtitle')}
          </DialogDescription>
        </DialogHeader>

        {/* Current status pill */}
        <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5 mt-2">
          <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-slate-500" />
            {t('statusLabel')}:
          </span>
          <div className="flex items-center gap-2">
            <span className={`relative flex h-2 w-2 ${status === 'Connected' ? 'inline-flex' : 'hidden'}`}>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span
              className={`font-mono text-xs uppercase font-bold px-2 py-0.5 rounded border ${
                status === 'Simulated'
                  ? 'bg-slate-800/80 text-slate-400 border-slate-700'
                  : status === 'Connected'
                  ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-950/50 text-rose-400 border-rose-500/30 animate-pulse'
              }`}
            >
              {status === 'Simulated'
                ? t('simulated')
                : status === 'Connected'
                ? t('connected')
                : t('invalidKey')}
            </span>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="space-y-4 my-2">
          {/* Provider Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-slate-300 font-semibold">{t('provider')}</label>
            <div className="grid grid-cols-4 gap-1 bg-white/5 p-1 rounded-lg border border-white/5">
              {(['OpenAI', 'Anthropic', 'Gemini', 'Custom'] as Provider[]).map((prov) => (
                <button
                  key={prov}
                  type="button"
                  onClick={() => handleProviderChange(prov)}
                  className={`text-[10px] font-mono py-1.5 rounded transition-all font-bold ${
                    provider === prov
                      ? 'bg-gold text-darkBg'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {prov}
                </button>
              ))}
            </div>
          </div>

          {/* Model selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-slate-300 font-semibold">{t('model')}</label>
            {provider !== 'Custom' ? (
              <select
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setTestResult(null);
                }}
                className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-gold/50 cursor-pointer"
              >
                {MODEL_PRESETS[provider as Exclude<Provider, 'Custom'>].map((m) => (
                  <option key={m} value={m} className="bg-slate-950">
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setTestResult(null);
                }}
                className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-gold/50"
                placeholder="e.g. llama-3-70b"
              />
            )}
          </div>

          {/* API Key */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-slate-300 font-semibold">{t('apiKey')}</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                className="w-full bg-slate-900 border border-white/10 rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-white focus:outline-none focus:border-gold/50"
                placeholder={
                  provider === 'OpenAI'
                    ? 'sk-...'
                    : provider === 'Anthropic'
                    ? 'sk-ant-...'
                    : 'AIzaSy...'
                }
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Base URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono text-slate-300 font-semibold">{t('baseUrl')}</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                setTestResult(null);
              }}
              className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-gold/50"
              placeholder={
                provider === 'Custom'
                  ? 'https://api.together.xyz/v1'
                  : 'Default URL'
              }
            />
          </div>
        </div>

        {/* Connection status notification */}
        {testResult && (
          <div
            className={`p-3 rounded-lg border text-xs font-mono flex items-start gap-2 animate-fadeIn ${
              testResult.success
                ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-950/20 text-rose-400 border-rose-500/20'
            }`}
          >
            <Shield className={`w-4 h-4 shrink-0 ${testResult.success ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span>{testResult.msg}</span>
          </div>
        )}

        {/* Disclaimer display */}
        <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
          <p className="text-[10px] text-amber-500/80 leading-relaxed font-sans">
            {t('disclaimer')}
          </p>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="flex flex-col sm:flex-row gap-2 border-t border-white/5 pt-4 mt-2">
          {/* Reset to Simulated Mode button on the left */}
          <button
            type="button"
            onClick={handleResetToSimulated}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold font-mono border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-200 transition-all hover:bg-slate-900/50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t('resetSimulated')}
          </button>

          <div className="flex flex-1 flex-col sm:flex-row justify-end gap-2">
            {/* Test Connection Button */}
            <button
              type="button"
              disabled={isTesting || !apiKey.trim()}
              onClick={handleTestConnection}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold font-mono border border-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-all bg-white/5 hover:bg-white/10 ${
                isTesting || !apiKey.trim() ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              {isTesting ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('testing')}
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-gold" />
                  {t('testConnection')}
                </>
              )}
            </button>

            {/* Save Preferences Button */}
            <button
              type="button"
              disabled={saveSuccess}
              onClick={handleSavePreferences}
              className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold font-mono transition-all text-darkBg font-bold ${
                saveSuccess
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gold hover:bg-gold-light hover:shadow-lg hover:shadow-gold/15 active:scale-[0.98]'
              }`}
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  {t('successSaved')}
                </>
              ) : (
                t('savePreferences')
              )}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
