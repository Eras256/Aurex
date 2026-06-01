'use client';

import { Eye, EyeOff, Check, RotateCcw, AlertTriangle, Play, Cpu, Server, Shield, Copy } from 'lucide-react';
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
type Status = 'Simulated' | 'Connected' | 'Invalid Key' | 'Custom Endpoint';
type ReasoningDetail = 'Compact' | 'Standard' | 'Full';

// Dependent model presets
const MODEL_PRESETS: Record<Exclude<Provider, 'Custom'>, string[]> = {
  OpenAI: ['gpt-5', 'gpt-4.1-mini', 'gpt-4o'],
  Anthropic: ['claude-sonnet', 'claude-haiku'],
  Gemini: ['gemini-2.5-pro', 'gemini-2.5-flash'],
};

export const AiEngineSettingsModal: React.FC<AiEngineSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { language } = useLanguage();

  // Translations dictionary
  const t = (key: string): string => {
    const dict: Record<string, { en: string; es: string }> = {
      title: {
        en: 'Quant Copilot Engine',
        es: 'Motor del Copiloto Cuantitativo',
      },
      subtitle: {
        en: 'Configure API endpoints and credentials for institutional advisory and copilot simulation.',
        es: 'Configure credenciales y endpoints de API para asesoramiento institucional y simulación del copiloto.',
      },
      provider: {
        en: 'Engine Provider',
        es: 'Proveedor de IA',
      },
      model: {
        en: 'Model Selection',
        es: 'Selección de Modelo',
      },
      modelMicrocopy: {
        en: 'Balance reasoning quality, speed, and cost.',
        es: 'Equilibra calidad de razonamiento, velocidad y costo.',
      },
      apiKey: {
        en: 'API Key',
        es: 'API Key',
      },
      baseUrl: {
        en: 'Base URL / Endpoint (Optional)',
        es: 'Base URL / Endpoint (Opcional)',
      },
      runtimeControls: {
        en: 'Runtime Controls',
        es: 'Controles de Ejecución',
      },
      streaming: {
        en: 'Streaming Response',
        es: 'Respuesta en Tiempo Real',
      },
      reasoningDetail: {
        en: 'Reasoning Detail',
        es: 'Detalle de Razonamiento',
      },
      statusLabel: {
        en: 'Connection Status',
        es: 'Estado de Conexión',
      },
      simulated: {
        en: 'Simulated',
        es: 'Simulado',
      },
      connected: {
        en: 'Connected',
        es: 'Conectado',
      },
      invalidKey: {
        en: 'Invalid Key',
        es: 'Key Inválida',
      },
      customEndpoint: {
        en: 'Custom Endpoint',
        es: 'Endpoint Custom',
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
        en: 'Reset to Simulated Mode',
        es: 'Restablecer Modo Simulado',
      },
      disclaimer: {
        en: 'Client-side API keys are for local testing or controlled demos only. Not recommended for production.',
        es: 'Las API keys en cliente son solo para pruebas locales o demos controladas. No se recomienda su uso en producción.',
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
      cancel: {
        en: 'Cancel',
        es: 'Cancelar',
      },
      copy: {
        en: 'Copy',
        es: 'Copiar',
      },
      copied: {
        en: 'Copied!',
        es: '¡Copiado!',
      },
      reasoningCompact: {
        en: 'Compact',
        es: 'Compacto',
      },
      reasoningStandard: {
        en: 'Standard',
        es: 'Estándar',
      },
      reasoningFull: {
        en: 'Full',
        es: 'Completo',
      },
    };

    return dict[key]?.[language] || key;
  };

  // Form State
  const [provider, setProvider] = useState<Provider>('OpenAI');
  const [model, setModel] = useState<string>('gpt-5');
  const [apiKey, setApiKey] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [status, setStatus] = useState<Status>('Simulated');
  const [streaming, setStreaming] = useState<boolean>(true);
  const [reasoningDetail, setReasoningDetail] = useState<ReasoningDetail>('Standard');
  
  // UI helper states
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedProvider = localStorage.getItem('aurex_ai_provider') as Provider || 'OpenAI';
      const savedModel = localStorage.getItem('aurex_ai_model') || 'gpt-5';
      const savedKey = localStorage.getItem('aurex_ai_key') || '';
      const savedBaseUrl = localStorage.getItem('aurex_ai_base_url') || '';
      const savedStatus = localStorage.getItem('aurex_ai_status') as Status || 'Simulated';
      const savedStreaming = localStorage.getItem('aurex_ai_streaming') !== 'false';
      const savedReasoning = localStorage.getItem('aurex_ai_reasoning_detail') as ReasoningDetail || 'Standard';

      setProvider(savedProvider);
      setModel(savedModel);
      setApiKey(savedKey);
      setBaseUrl(savedBaseUrl);
      setStatus(savedStatus);
      setStreaming(savedStreaming);
      setReasoningDetail(savedReasoning);
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

  // Copy API Key to clipboard
  const handleCopyKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Test Connection simulation
  const handleTestConnection = () => {
    if (isTesting) return;
    setIsTesting(true);
    setTestResult(null);

    // Simulate network delay
    setTimeout(() => {
      setIsTesting(false);
      
      const cleanedKey = apiKey.trim();
      const isInvalid = !cleanedKey || cleanedKey.length < 8 || cleanedKey.toLowerCase().includes('invalid') || cleanedKey.toLowerCase().includes('error');

      if (isInvalid) {
        setTestResult({
          success: false,
          msg: t('connectionFailed'),
        });
        setStatus('Invalid Key');
      } else {
        setTestResult({
          success: true,
          msg: t('connectionSuccess'),
        });
        setStatus(provider === 'Custom' ? 'Custom Endpoint' : 'Connected');
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
      localStorage.setItem('aurex_ai_streaming', String(streaming));
      localStorage.setItem('aurex_ai_reasoning_detail', reasoningDetail);

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
    setModel('gpt-5');
    setApiKey('');
    setBaseUrl('');
    setStatus('Simulated');
    setStreaming(true);
    setReasoningDetail('Standard');
    setTestResult(null);

    if (typeof window !== 'undefined') {
      localStorage.setItem('aurex_ai_provider', 'OpenAI');
      localStorage.setItem('aurex_ai_model', 'gpt-5');
      localStorage.setItem('aurex_ai_key', '');
      localStorage.setItem('aurex_ai_base_url', '');
      localStorage.setItem('aurex_ai_status', 'Simulated');
      localStorage.setItem('aurex_ai_streaming', 'true');
      localStorage.setItem('aurex_ai_reasoning_detail', 'Standard');

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
      {/*
        Mobile-first: full-width bottom-sheet on mobile, centered modal on desktop.
        IMPORTANT: the base DialogContent applies an unprefixed `translate-x-[-50%]` / `translate-y-[-50%]`.
        twMerge does NOT override an unprefixed class with a `sm:`-prefixed one, so we MUST reset the
        transform with unprefixed `translate-x-0 translate-y-0` here — otherwise the sheet is shifted
        50% of its width off-screen on mobile (it appears "cut in half" and is unscrollable).
        We then re-center on desktop with the `sm:` variants.
      */}
      <DialogContent className="fixed bottom-0 top-auto left-0 right-0 translate-x-0 translate-y-0 sm:bottom-auto sm:top-[50%] sm:left-[50%] sm:right-auto sm:translate-x-[-50%] sm:translate-y-[-50%] z-50 grid w-full sm:max-w-lg gap-4 border border-white/10 bg-slate-950 p-4 sm:p-6 shadow-2xl duration-200 rounded-t-2xl sm:rounded-xl text-slate-100 font-sans max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
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

        {/* Current status display (quantitative style) */}
        <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5 mt-1">
          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 uppercase tracking-wider">
            <Server className="w-3.5 h-3.5 text-slate-500" />
            {t('statusLabel')}:
          </span>
          <div className="flex items-center gap-2">
            <span className={`relative flex h-2 w-2 ${(status === 'Connected' || status === 'Custom Endpoint') ? 'inline-flex' : 'hidden'}`}>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span
              className={`font-mono text-[10px] uppercase font-extrabold px-2 py-0.5 rounded border tracking-wider ${
                status === 'Simulated'
                  ? 'bg-slate-800/80 text-slate-400 border-slate-700'
                  : (status === 'Connected' || status === 'Custom Endpoint')
                  ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-950/50 text-rose-400 border-rose-500/30 animate-pulse'
              }`}
            >
              {status === 'Simulated'
                ? t('simulated')
                : status === 'Connected'
                ? t('connected')
                : status === 'Custom Endpoint'
                ? t('customEndpoint')
                : t('invalidKey')}
            </span>
          </div>
        </div>

        {/* Configurations Fields */}
        <div className="space-y-4 my-1">
          
          {/* A. Engine Provider */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">{t('provider')}</label>
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

          {/* B. Model Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">{t('model')}</label>
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
            <span className="text-[10px] text-slate-500 font-sans italic pl-1">
              {t('modelMicrocopy')}
            </span>
          </div>

          {/* C. Credentials */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">{t('apiKey')}</label>
            <div className="relative flex gap-1 items-center">
              <div className="relative flex-1">
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

              {/* Copy Button (only visible when value exists) */}
              {apiKey.trim() && (
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="p-2 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 text-slate-400 hover:text-white transition-all flex items-center justify-center shrink-0 h-9 w-9"
                  title={isCopied ? t('copied') : t('copy')}
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Base URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">{t('baseUrl')}</label>
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
                  : 'Default endpoint URL'
              }
            />
          </div>

          {/* D. Runtime Controls */}
          <div className="border-t border-white/5 pt-3 mt-3">
            <h4 className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold mb-2">{t('runtimeControls')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/5 p-3 rounded-lg border border-white/5">
              
              {/* Streaming Toggle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">{t('streaming')}</label>
                <div className="flex bg-slate-900 p-0.5 rounded-lg border border-white/10 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setStreaming(true)}
                    className={`flex-1 text-center py-1 rounded font-bold font-mono transition-all ${
                      streaming ? 'bg-white/10 text-white border border-white/10' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ON
                  </button>
                  <button
                    type="button"
                    onClick={() => setStreaming(false)}
                    className={`flex-1 text-center py-1 rounded font-bold font-mono transition-all ${
                      !streaming ? 'bg-white/10 text-white border border-white/10' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    OFF
                  </button>
                </div>
              </div>

              {/* Reasoning Detail Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">{t('reasoningDetail')}</label>
                <div className="flex bg-slate-900 p-0.5 rounded-lg border border-white/10 text-[10px]">
                  {(['Compact', 'Standard', 'Full'] as ReasoningDetail[]).map((detail) => (
                    <button
                      key={detail}
                      type="button"
                      onClick={() => setReasoningDetail(detail)}
                      className={`flex-1 text-center py-1 rounded font-bold font-mono transition-all ${
                        reasoningDetail === detail
                          ? 'bg-white/10 text-white border border-white/10'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {detail === 'Compact'
                        ? t('reasoningCompact')
                        : detail === 'Standard'
                        ? t('reasoningStandard')
                        : t('reasoningFull')}
                    </button>
                  ))}
                </div>
              </div>

            </div>
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
            <Shield className={`w-4 h-4 shrink-0 mt-0.5 ${testResult.success ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span>{testResult.msg}</span>
          </div>
        )}

        {/* Disclaimer box */}
        <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
          <p className="text-[10px] text-amber-500/80 leading-relaxed font-sans font-medium">
            {t('disclaimer')}
          </p>
        </div>

        {/* F. Footer Actions */}
        <DialogFooter className="flex flex-col sm:flex-row gap-2 border-t border-white/5 pt-4 mt-1">
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

            {/* Cancel Button */}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-white/5 hover:bg-white/5 rounded-lg text-xs font-semibold font-mono text-slate-400 hover:text-white transition-all"
            >
              {t('cancel')}
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
