'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  CloudUpload,
  Cpu,
  Layers,
  Link2,
  Loader2,
  Play,
  Plus,
  Power,
  Settings2,
  Sparkles,
  Trash2,
  Tv,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type Model = {
  id: number;
  name: string;
  size_mb?: number;
  created_at?: string;
  architecture?: string;
  processor_type?: string;
  sensor?: string;
  config?: {
    model_hash?: string;
    metadata?: ModelMetadata;
    processor?: string;
    rule_type?: string;
    rules?: Array<{ when: string; label: string; confidence?: number }>;
    else?: string;
    actuator?: {
      type: string;
      url?: string;
      entity_id?: string;
      positive_action?: string;
      negative_action?: string;
      action_kind?: string;
    };
  };
};

type ModelMetadata = {
  schema: string;
  name: string;
  version: string;
  inputs?: Array<Record<string, unknown>>;
  output?: { kind: 'logits' | 'probabilities'; path: Array<string | number> };
  class_names: string[];
};

type Device = { device_uuid: string; device_name: string; online: boolean };
type Deployment = {
  deployment_id: string;
  model_id: number;
  model_name: string;
  device_id: string;
  device_name: string;
  status: string;
  activation?: { enabled?: boolean; requested?: boolean; status?: string; message?: string };
};

const defaultInputs = JSON.stringify(
  [{ sensor: 'radar', representation: 'raw_adc', frames: 10, shape: [1, 10, 128], fit: 'left_pad_latest', normalization: { kind: 'none' } }],
  null,
  2
);

const SUPPORTED_SENSORS = [
  { key: 'camera', name: 'Camera (Built-in / USB)', icon: Tv, metrics: ['face_detection'] },
  { key: 'sense_hat', name: 'Sense HAT (Environmental & IMU)', icon: Cpu, metrics: ['temperature_c', 'humidity_percent', 'pressure_mbar', 'accel_g', 'gyro_rads', 'compass_ut'] },
  { key: 'dreamhat_radar', name: 'Radar (BGT60TR13C mmWave)', icon: Zap, metrics: ['snr_db', 'snr_mean', 'target_count'] },
  { key: 'esp32_csi', name: 'WiFi CSI (Spatial Sensing)', icon: Sparkles, metrics: ['csi_rolling_var', 'csi_amplitude_mean'] },
];

function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  return fetch(`/api/proxy${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    cache: 'no-store',
  }).then(async (response) => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) throw new Error(body.detail || body.error || 'Request failed');
    return body as T;
  });
}

export default function ModelsPage() {
  const { user } = useAuth();
  const token = user?.token || '';
  const [models, setModels] = useState<Model[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'rule' | 'ml'>('rule');

  // ML / DL TorchScript Form State
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [classes, setClasses] = useState('class-a, class-b');
  const [inputs, setInputs] = useState(defaultInputs);
  const [outputKind, setOutputKind] = useState<'logits' | 'probabilities'>('logits');
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);

  // Rule-Based Sensor Model Form State
  const [ruleName, setRuleName] = useState('');
  const [ruleSensor, setRuleSensor] = useState('camera');
  const [ruleKind, setRuleKind] = useState<'face_detection' | 'threshold'>('face_detection');
  const [metric, setMetric] = useState('temperature_c');
  const [operator, setOperator] = useState('>');
  const [thresholdVal, setThresholdVal] = useState('30.0');
  const [posLabel, setPosLabel] = useState('face_detected');
  const [negLabel, setNegLabel] = useState('no_face');

  // Actuator Plugin Form State
  const [attachActuator, setAttachActuator] = useState(false);
  const [actuatorType, setActuatorType] = useState<'home_assistant' | 'device_action' | 'webhook'>('home_assistant');
  const [haUrl, setHaUrl] = useState('http://homeassistant.local:8123');
  const [haToken, setHaToken] = useState('');
  const [haEntityId, setHaEntityId] = useState('light.office');
  const [haPosAction, setHaPosAction] = useState('homeassistant.turn_on');
  const [haNegAction, setHaNegAction] = useState('homeassistant.turn_off');
  const [deviceActionKind, setDeviceActionKind] = useState('sensehat_matrix');
  const [webhookUrl, setWebhookUrl] = useState('');

  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [modelResult, deviceResult, deploymentResult] = await Promise.all([
        request<{ models: Model[] }>('/datasets/models', token),
        request<{ devices: Device[] }>('/device/list', token),
        request<{ deployments: Deployment[] }>('/datasets/models/deployments', token),
      ]);
      setModels(modelResult.models || []);
      setDevices(deviceResult.devices || []);
      setDeployments(deploymentResult.deployments || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load models');
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  // Adjust defaults when sensor changes
  useEffect(() => {
    if (ruleSensor === 'camera') {
      setRuleKind('face_detection');
      setPosLabel('face_detected');
      setNegLabel('no_face');
    } else {
      setRuleKind('threshold');
      if (ruleSensor === 'sense_hat') {
        setMetric('temperature_c');
        setThresholdVal('30.0');
        setPosLabel('overheating');
        setNegLabel('normal');
      } else if (ruleSensor === 'dreamhat_radar') {
        setMetric('snr_db');
        setThresholdVal('8.0');
        setPosLabel('occupied');
        setNegLabel('empty');
      } else if (ruleSensor === 'esp32_csi') {
        setMetric('csi_rolling_var');
        setThresholdVal('0.4');
        setPosLabel('motion_detected');
        setNegLabel('calm');
      }
    }
  }, [ruleSensor]);

  const metadata = useMemo<ModelMetadata | null>(() => {
    try {
      const classNames = classes.split(',').map((value) => value.trim()).filter(Boolean);
      const parsedInputs = JSON.parse(inputs);
      if (!name.trim() || !version.trim() || classNames.length < 2 || !Array.isArray(parsedInputs) || !parsedInputs.length) return null;
      return { schema: 'thoth-model/v1', name: name.trim(), version: version.trim(), inputs: parsedInputs, output: { kind: outputKind, path: [] }, class_names: classNames };
    } catch {
      return null;
    }
  }, [classes, inputs, name, outputKind, version]);

  const uploadTorchscript = () => {
    if (!token || !file || !metadata) {
      setMessage('Choose a TorchScript file and complete valid metadata.');
      return;
    }
    const form = new FormData();
    form.append('model', file);
    form.append('metadata', JSON.stringify(metadata));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/proxy/datasets/models/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) setUploadPercent(Math.round((event.loaded * 100) / event.total));
    };
    xhr.onload = () => {
      const body = JSON.parse(xhr.responseText || '{}');
      if (xhr.status >= 200 && xhr.status < 300) {
        setMessage(`Validated ${body.validation?.output_dimension} output classes and saved.`);
        setFile(null);
        void refresh();
      } else {
        setMessage(body.detail || 'Validation failed');
      }
      setUploadPercent(null);
    };
    xhr.onerror = () => {
      setMessage('Model transfer failed');
      setUploadPercent(null);
    };
    setUploadPercent(0);
    xhr.send(form);
  };

  const createRuleModel = async () => {
    if (!ruleName.trim()) {
      setMessage('Provide a descriptive name for the rule model.');
      return;
    }
    setIsSubmitting(true);
    try {
      let rules = [];
      if (ruleKind === 'face_detection') {
        rules = [{ when: 'faces_count > 0', label: posLabel || 'face_detected', confidence: 0.95 }];
      } else {
        rules = [{ when: `${metric} ${operator} ${thresholdVal}`, label: posLabel || 'occupied', confidence: 0.9 }];
      }

      let actuatorConfig = null;
      if (attachActuator) {
        if (actuatorType === 'home_assistant') {
          actuatorConfig = {
            type: 'home_assistant',
            url: haUrl.trim(),
            token: haToken.trim(),
            entity_id: haEntityId.trim(),
            positive_action: haPosAction.trim(),
            negative_action: haNegAction.trim(),
            trigger_labels: [posLabel],
          };
        } else if (actuatorType === 'device_action') {
          actuatorConfig = {
            type: 'device_action',
            action_kind: deviceActionKind,
          };
        } else if (actuatorType === 'webhook') {
          actuatorConfig = {
            type: 'webhook',
            url: webhookUrl.trim(),
          };
        }
      }

      const payload = {
        name: ruleName.trim(),
        sensor: ruleSensor,
        rule_type: ruleKind,
        rules,
        else: negLabel || 'normal',
        actuator: actuatorConfig,
        params: ruleKind === 'threshold' ? { [metric]: parseFloat(thresholdVal) || 0 } : {},
      };

      await request('/datasets/models/rule', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setMessage(`Rule model "${ruleName}" created and added to library.`);
      setRuleName('');
      void refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create rule model');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deploy = async (modelId: number) => {
    if (!selectedDevices.length) {
      setMessage('Select at least one device.');
      return;
    }
    const outcomes = await Promise.allSettled(
      selectedDevices.map((deviceId) =>
        request(`/datasets/models/${modelId}/deploy`, token, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model_id: modelId, device_id: deviceId }),
        })
      )
    );
    const failed = outcomes.filter((item) => item.status === 'rejected').length;
    setMessage(failed ? `${outcomes.length - failed} deployed; ${failed} failed.` : `Queued for ${outcomes.length} device(s).`);
    void refresh();
  };

  const activate = async (deployment: Deployment, enabled: boolean) => {
    try {
      await request(`/datasets/models/deployments/${deployment.deployment_id}/activation`, token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      setMessage(`${enabled ? 'Enable' : 'Disable'} command queued.`);
      void refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Activation failed');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <div className="text-xs font-bold uppercase tracking-[.2em] text-cyan-700">Model Ecosystem</div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">Models & Actuators</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Build modular sensor pipelines: deploy ML/DL TorchScript networks or sensor rule models (like OpenCV face recognition or environmental thresholds), then attach actuator plugins (Home Assistant, device controls, webhooks) to trigger downstream actions on predictions.
        </p>
      </header>

      {/* Model Creation Section with Tabs */}
      <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
        <div className="flex border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('rule')}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'rule'
                ? 'border-cyan-600 text-cyan-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="h-4 w-4" />
            Add Rule-Based Sensor Model
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ml')}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'ml'
                ? 'border-cyan-600 text-cyan-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="h-4 w-4" />
            Upload TorchScript ML/DL Model
          </button>
        </div>

        {activeTab === 'rule' ? (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-slate-600">
              Create a non-ML rule model mapped to any supported sensor. Works on commodity devices (built-in camera on laptops) as well as dedicated nodes (Sense HAT, mmWave Radar, CSI).
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium">
                Model name
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-950"
                  placeholder="e.g. Laptop Face Detector, Sense HAT Overheat Alert"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                />
              </label>

              <label className="text-sm font-medium">
                Target Sensor Modality
                <select
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-slate-950"
                  value={ruleSensor}
                  onChange={(e) => setRuleSensor(e.target.value)}
                >
                  {SUPPORTED_SENSORS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              {ruleSensor === 'camera' ? (
                <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 md:col-span-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-cyan-950">
                    <Tv className="h-4 w-4 text-cyan-700" />
                    OpenCV Human Face Recognition
                  </div>
                  <p className="mt-1 text-xs text-cyan-900">
                    Analyzes camera frames via Haar Cascade face detection. Emits <strong>{posLabel}</strong> when a person/face is detected in view, or <strong>{negLabel}</strong> when absent.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="text-xs font-medium text-slate-700">
                      Positive Prediction Label
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-950"
                        value={posLabel}
                        onChange={(e) => setPosLabel(e.target.value)}
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-700">
                      Negative / Else Label
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-950"
                        value={negLabel}
                        onChange={(e) => setNegLabel(e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                  <div className="text-sm font-semibold text-slate-900">Sensor Metric Threshold Rule</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="text-xs font-medium text-slate-700">
                      Sensor Metric
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-950"
                        value={metric}
                        onChange={(e) => setMetric(e.target.value)}
                      >
                        {SUPPORTED_SENSORS.find((s) => s.key === ruleSensor)?.metrics.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-slate-700">
                      Condition Operator
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-950"
                        value={operator}
                        onChange={(e) => setOperator(e.target.value)}
                      >
                        <option value=">">&gt; (greater than)</option>
                        <option value=">=">&gt;= (greater or equal)</option>
                        <option value="<">&lt; (less than)</option>
                        <option value="<=">&lt;= (less or equal)</option>
                        <option value="==">== (equal)</option>
                      </select>
                    </label>
                    <label className="text-xs font-medium text-slate-700">
                      Threshold Value
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-950"
                        value={thresholdVal}
                        onChange={(e) => setThresholdVal(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="text-xs font-medium text-slate-700">
                      When Triggered Emits
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-950"
                        value={posLabel}
                        onChange={(e) => setPosLabel(e.target.value)}
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-700">
                      Otherwise Emits
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-950"
                        value={negLabel}
                        onChange={(e) => setNegLabel(e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Modular Actuator Plugin Setup */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 md:col-span-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-900">
                  <input
                    type="checkbox"
                    checked={attachActuator}
                    onChange={(e) => setAttachActuator(e.target.checked)}
                    className="h-4 w-4 accent-cyan-600"
                  />
                  <span>Attach Downstream Actuator Plugin (Home Assistant, Robothand / Motor, Webhook)</span>
                </label>
                {attachActuator && (
                  <div className="mt-4 space-y-3 border-t border-slate-200 pt-3">
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-xs font-medium">
                        <input
                          type="radio"
                          name="actType"
                          checked={actuatorType === 'home_assistant'}
                          onChange={() => setActuatorType('home_assistant')}
                        />
                        Home Assistant Plugin
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-medium">
                        <input
                          type="radio"
                          name="actType"
                          checked={actuatorType === 'device_action'}
                          onChange={() => setActuatorType('device_action')}
                        />
                        Device Actuator (Motor / Robothand / LED)
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-medium">
                        <input
                          type="radio"
                          name="actType"
                          checked={actuatorType === 'webhook'}
                          onChange={() => setActuatorType('webhook')}
                        />
                        Webhook
                      </label>
                    </div>

                    {actuatorType === 'home_assistant' && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-medium">
                          Home Assistant Base URL
                          <input
                            className="mt-1 w-full rounded border p-2 text-xs font-mono"
                            value={haUrl}
                            onChange={(e) => setHaUrl(e.target.value)}
                          />
                        </label>
                        <label className="text-xs font-medium">
                          Entity ID (Light / Switch / Automation)
                          <input
                            className="mt-1 w-full rounded border p-2 text-xs font-mono"
                            placeholder="light.living_room or switch.desk"
                            value={haEntityId}
                            onChange={(e) => setHaEntityId(e.target.value)}
                          />
                        </label>
                        <label className="text-xs font-medium">
                          On Trigger Action
                          <input
                            className="mt-1 w-full rounded border p-2 text-xs font-mono"
                            value={haPosAction}
                            onChange={(e) => setHaPosAction(e.target.value)}
                          />
                        </label>
                        <label className="text-xs font-medium">
                          On Clear Action
                          <input
                            className="mt-1 w-full rounded border p-2 text-xs font-mono"
                            value={haNegAction}
                            onChange={(e) => setHaNegAction(e.target.value)}
                          />
                        </label>
                        <label className="text-xs font-medium sm:col-span-2">
                          Long-Lived Access Token (optional if local bridge configured)
                          <input
                            type="password"
                            className="mt-1 w-full rounded border p-2 text-xs font-mono"
                            placeholder="eyJhbGciOi..."
                            value={haToken}
                            onChange={(e) => setHaToken(e.target.value)}
                          />
                        </label>
                      </div>
                    )}

                    {actuatorType === 'device_action' && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-medium">
                          Actuator Target
                          <select
                            className="mt-1 w-full rounded border p-2 text-xs"
                            value={deviceActionKind}
                            onChange={(e) => setDeviceActionKind(e.target.value)}
                          >
                            <option value="sensehat_matrix">Sense HAT 8x8 LED Matrix</option>
                            <option value="motor">Motor Controller</option>
                            <option value="robothand">Robotic Hand / Gripper</option>
                            <option value="buzzer">Audio Alert / Buzzer</option>
                          </select>
                        </label>
                        <p className="text-xs text-slate-500 pt-6">
                          Dispatches hardware actuation on the node when predictions match positive state.
                        </p>
                      </div>
                    )}

                    {actuatorType === 'webhook' && (
                      <div>
                        <label className="text-xs font-medium">
                          Webhook URL
                          <input
                            className="mt-1 w-full rounded border p-2 text-xs font-mono"
                            placeholder="https://maker.ifttt.com/trigger/... or automation URL"
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={createRuleModel}
              disabled={!ruleName.trim() || isSubmitting}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Save and Register Model
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium">
                Model name
                <input className="mt-1 w-full rounded-xl border p-2.5" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="text-sm font-medium">
                Version
                <input className="mt-1 w-full rounded-xl border p-2.5" value={version} onChange={(event) => setVersion(event.target.value)} />
              </label>
              <label className="text-sm font-medium md:col-span-2">
                Class names
                <input className="mt-1 w-full rounded-xl border p-2.5" value={classes} onChange={(event) => setClasses(event.target.value)} />
              </label>
              <label className="text-sm font-medium md:col-span-2">
                Ordered input metadata
                <textarea className="mt-1 min-h-48 w-full rounded-xl border p-3 font-mono text-xs" value={inputs} onChange={(event) => setInputs(event.target.value)} />
              </label>
              <label className="text-sm font-medium">
                Output
                <select className="mt-1 w-full rounded-xl border p-2.5" value={outputKind} onChange={(event) => setOutputKind(event.target.value as 'logits' | 'probabilities')}>
                  <option value="logits">Logits</option>
                  <option value="probabilities">Probabilities</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                TorchScript .pt/.pth
                <input className="mt-1 block w-full text-sm" type="file" accept=".pt,.pth" onChange={(event) => setFile(event.target.files?.[0] || null)} />
              </label>
            </div>
            <button
              onClick={uploadTorchscript}
              disabled={!file || !metadata || uploadPercent !== null}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {uploadPercent !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
              {uploadPercent !== null ? `Transferring ${uploadPercent}%` : 'Validate and save'}
            </button>
          </div>
        )}
      </section>

      {/* Model Deployment Section */}
      <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Deploy to Devices</h2>
        <p className="mt-1 text-xs text-slate-500">
          Select target node(s) below to install models on edge hardware (Pi or laptop).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {devices.map((device) => (
            <label
              key={device.device_uuid}
              className={`flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                selectedDevices.includes(device.device_uuid)
                  ? 'border-cyan-600 bg-cyan-50 text-cyan-950'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <input
                className="mr-2 accent-cyan-600"
                type="checkbox"
                checked={selectedDevices.includes(device.device_uuid)}
                onChange={(event) =>
                  setSelectedDevices((current) =>
                    event.target.checked ? [...current, device.device_uuid] : current.filter((id) => id !== device.device_uuid)
                  )
                }
              />
              {device.device_name} · {device.online ? 'online' : 'offline'}
            </label>
          ))}
          {!devices.length && <p className="text-sm text-slate-500">No registered devices.</p>}
        </div>

        <div className="mt-5 space-y-3">
          {models.map((model) => {
            const isRule = model.processor_type === 'rule' || model.architecture === 'rule';
            const actuator = model.config?.actuator;
            return (
              <article key={model.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-950">{model.name}</h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        isRule
                          ? 'border border-amber-300 bg-amber-50 text-amber-900'
                          : 'border border-cyan-300 bg-cyan-50 text-cyan-900'
                      }`}
                    >
                      {isRule ? `Rule (${model.sensor || 'sensor'})` : 'TorchScript ML/DL'}
                    </span>
                    {actuator && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-900">
                        <Zap className="h-3 w-3" />
                        {actuator.type === 'home_assistant'
                          ? `HA: ${actuator.entity_id || 'entity'}`
                          : actuator.action_kind || actuator.type}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {isRule
                      ? `Rule type: ${model.config?.rule_type || 'threshold'} · classes: ${(model.config?.metadata?.class_names || []).join(', ') || 'binary'}`
                      : `${model.config?.metadata?.version || '1.0.0'} · ${model.size_mb ? `${model.size_mb.toFixed(2)} MB` : 'weights'} · ${model.config?.model_hash?.slice(0, 12) || ''}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void deploy(model.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800"
                  >
                    <Play className="h-4 w-4" />
                    Deploy
                  </button>
                  <button
                    onClick={async () => {
                      await request(`/datasets/models/${model.id}`, token, { method: 'DELETE' });
                      void refresh();
                    }}
                    aria-label={`Delete ${model.name}`}
                    className="rounded-lg border border-slate-300 bg-white p-2 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
          {!models.length ? <p className="text-sm text-slate-500">No models in library.</p> : null}
        </div>
      </section>

      {/* Deployment Runtime Status */}
      <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Delivery and Runtime Status</h2>
        <div className="mt-4 space-y-3">
          {deployments.map((item) => (
            <article key={item.deployment_id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-slate-700" />
                  <strong>{item.model_name}</strong>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{item.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {item.device_name} · runtime {item.activation?.status || 'disabled'}
                </p>
                {item.activation?.message ? <p className="text-xs text-red-700">{item.activation.message}</p> : null}
              </div>
              <button
                disabled={item.status !== 'delivered'}
                onClick={() => void activate(item, !(item.activation?.enabled ?? item.activation?.requested))}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40"
              >
                <Power className="h-4 w-4" />
                {item.activation?.enabled || item.activation?.requested ? 'Disable' : 'Enable'}
              </button>
            </article>
          ))}
          {!deployments.length ? <p className="text-sm text-slate-500">No deployments yet.</p> : null}
        </div>
      </section>

      {message ? (
        <div
          aria-live="polite"
          className="fixed bottom-20 right-5 z-50 flex max-w-sm items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm text-white shadow-xl"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {message}
        </div>
      ) : null}
    </div>
  );
}

