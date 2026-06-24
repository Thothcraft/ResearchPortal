'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  Check,
  Database,
  Download,
  RefreshCw,
  Trash2,
} from 'lucide-react';

type CloudFile = {
  file_id: number;
  filename: string;
  size: number;
  uploaded_at: string;
  device_id?: string | null;
  metadata?: Record<string, any>;
  labels?: string[];
};

type Device = {
  device_uuid: string;
  device_name: string;
};

type DeviceFile = {
  id: number;
  filename: string;
  size?: number;
  on_cloud: boolean;
  upload_requested: boolean;
};

type MinuteFile = {
  filename: string;
  relativePath: string;
  path: string;
  size: number;
  modified: string;
  contentType: string;
};

type LocalMinute = {
  minute: string;
  minuteName: string;
  relativePath: string;
  path: string;
  modified: string;
  created: string;
  labels: string[];
  fileCount: number;
  totalSize: number;
  files: MinuteFile[];
};

type Dataset = {
  id: number;
  name: string;
  description?: string | null;
  file_count?: number;
  label_counts?: Record<string, number>;
  labels?: string[];
};

type LabelGroup = {
  label: string;
  cloudFiles: CloudFile[];
  localFiles: Array<DeviceFile & { deviceId: string; deviceName: string }>;
  localMinutes: LocalMinute[];
};

function parseLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)));
}

function labelsFromPath(filename: string): string[] {
  const parts = filename.split('/').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2 && /^\d{8}_\d{4}$/.test(parts[1])) return [parts[0]];
  if (parts.length >= 3 && parts[0] === 'data') return [parts[1]];
  return [];
}

function humanBytes(bytes?: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export default function TrainingPage() {
  const { get, delete: del } = useApi();
  const { user } = useAuth();
  const toast = useToast();

  const [cloudFiles, setCloudFiles] = useState<CloudFile[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceFiles, setDeviceFiles] = useState<Record<string, DeviceFile[]>>({});
  const [localLabelGroups, setLocalLabelGroups] = useState<Array<{ label: string; minutes: LocalMinute[]; minuteCount: number; fileCount: number; totalSize: number }>>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [datasetName, setDatasetName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [fileRes, deviceRes, datasetRes] = await Promise.all([
        get('/file/files?limit=500').catch(() => ({ files: [] })),
        get('/device/list?include_offline=true').catch(() => ({ devices: [] })),
        get('/datasets/list').catch(() => ({ datasets: [] })),
      ]);
      const labelRes = await fetch('/api/data/labels', { cache: 'no-store' })
        .then((response) => response.json())
        .catch(() => ({ labels: [] }));

      const remoteDevices = Array.isArray(deviceRes?.devices) ? deviceRes.devices : [];
      setCloudFiles(Array.isArray(fileRes?.files) ? fileRes.files : []);
      setDevices(remoteDevices);
      setDatasets(Array.isArray(datasetRes?.datasets) ? datasetRes.datasets : []);

      const localLabels = Array.isArray(labelRes?.labels) ? labelRes.labels : [];
      setLocalLabelGroups(localLabels.map((group: any) => ({
        label: String(group?.label || '').trim(),
        minutes: Array.isArray(group?.minutes) ? group.minutes : [],
        minuteCount: Number(group?.minuteCount || 0),
        fileCount: Number(group?.fileCount || 0),
        totalSize: Number(group?.totalSize || 0),
      })).filter((group) => group.label).sort((a, b) => a.label.localeCompare(b.label)));

      const fileEntries = await Promise.all(
        remoteDevices.map(async (device: Device) => {
          const response = await get(`/device/${device.device_uuid}/files`).catch(() => null);
          return [device.device_uuid, Array.isArray(response?.files) ? response.files : []] as const;
        })
      );
      setDeviceFiles(Object.fromEntries(fileEntries));
    } catch (err) {
      toast.error('Load failed', err instanceof Error ? err.message : 'Unable to load training data');
    } finally {
      setLoading(false);
    }
  }, [get, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const labelGroups = useMemo(() => {
    const groups = new Map<string, LabelGroup>();
    const ensure = (label: string) => {
      const existing = groups.get(label);
      if (existing) return existing;
      const group = { label, cloudFiles: [], localFiles: [], localMinutes: [] };
      groups.set(label, group);
      return group;
    };

    localLabelGroups.forEach((group) => {
      ensure(group.label).localMinutes.push(...group.minutes);
    });

    cloudFiles.forEach((file) => {
      const labels = Array.from(new Set([
        ...parseLabels(file.labels),
        ...parseLabels(file.metadata?.labels),
        ...labelsFromPath(file.filename),
      ]));
      labels.forEach((label) => ensure(label).cloudFiles.push(file));
    });

    devices.forEach((device) => {
      (deviceFiles[device.device_uuid] || []).forEach((file) => {
        labelsFromPath(file.filename).forEach((label) => {
          ensure(label).localFiles.push({
            ...file,
            deviceId: device.device_uuid,
            deviceName: device.device_name || device.device_uuid,
          });
        });
      });
    });

    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [cloudFiles, deviceFiles, devices, localLabelGroups]);

  const selectedGroups = labelGroups.filter((group) => selectedLabels.includes(group.label));
  const selectedCloudFiles = selectedGroups.flatMap((group) => group.cloudFiles);
  const selectedLocalDataFiles = Array.from(new Map(
    selectedGroups.flatMap((group) => group.localMinutes.flatMap((minute) => minute.files))
      .map((file) => [file.relativePath, file] as const)
  ).values());

  const toggleLabel = (label: string) => {
    setSelectedLabels((current) => (
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label]
    ));
  };

  const deleteAllDatasets = useCallback(async () => {
    await Promise.all(datasets.map((dataset) => del(`/datasets/${dataset.id}`).catch(() => null)));
  }, [datasets, del]);

  const createDataset = async () => {
    if (!selectedLabels.length) {
      toast.info('Select labels', 'Choose at least one label to build a dataset');
      return;
    }
    if (!selectedLocalDataFiles.length) {
      toast.info('No local data', 'Selected labels have no labeled minutes under thoth/data.');
      return;
    }

    setBusy(true);
    try {
      await deleteAllDatasets();
      const name = datasetName.trim() || selectedLabels.join(' + ');
      const response = await fetch('/api/data/labels/create-dataset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
        },
        body: JSON.stringify({ name, labels: selectedLabels }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Dataset creation failed');
      toast.success('Dataset created', `${name} contains ${payload.uploaded_count || selectedLocalDataFiles.length} uploaded files`);
      setSelectedLabels([]);
      setDatasetName('');
      await loadData();
    } catch (err) {
      toast.error('Dataset failed', err instanceof Error ? err.message : 'Unable to create dataset');
    } finally {
      setBusy(false);
    }
  };

  const downloadDataset = async (dataset: Dataset) => {
    try {
      const response = await fetch(`/api/proxy/datasets/${dataset.id}/download`, {
        headers: user?.token ? { Authorization: `Bearer ${user.token}` } : undefined,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${dataset.name || `dataset_${dataset.id}`}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Download failed', err instanceof Error ? err.message : 'Unable to download dataset');
    }
  };

  const deleteDataset = async (dataset: Dataset) => {
    setBusy(true);
    try {
      await del(`/datasets/${dataset.id}`);
      toast.success('Dataset deleted', dataset.name);
      await loadData();
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Unable to delete dataset');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
        Loading training data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Training</div>
            <h1 className="mt-1 text-3xl font-semibold text-slate-950">Dataset builder</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Build one dataset by selecting labels from local folders under thoth/data. Creating a new dataset removes the old datasets first.
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">Labels</h2>
              <p className="mt-1 text-sm text-slate-500">Select labels to combine into the next dataset.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {selectedLabels.length} selected
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {labelGroups.map((group) => {
              const selected = selectedLabels.includes(group.label);
              const localOnlyCount = group.localFiles.filter((file) => !file.on_cloud).length;
              const localMinuteCount = group.localMinutes.length;
              const localFileCount = group.localMinutes.reduce((sum, minute) => sum + minute.fileCount, 0);
              return (
                <button
                  key={group.label}
                  type="button"
                  onClick={() => toggleLabel(group.label)}
                  className={`rounded-2xl border p-4 text-left transition ${selected ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-950 hover:border-slate-300'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">{group.label}</div>
                      <div className={`mt-1 text-sm ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
                        {localMinuteCount} labeled minutes · {localFileCount} local files · {group.cloudFiles.length} cloud files · {localOnlyCount} waiting
                      </div>
                    </div>
                    {selected && <Check className="h-5 w-5 text-emerald-300" />}
                  </div>
                  <div className={`mt-3 text-xs ${selected ? 'text-slate-400' : 'text-slate-500'}`}>
                    {humanBytes(group.localMinutes.reduce((sum, minute) => sum + minute.totalSize, 0))}
                  </div>
                </button>
              );
            })}
            {!labelGroups.length && (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                No labeled minutes found under thoth/data.
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-950">New dataset</h2>
            <input
              value={datasetName}
              onChange={(event) => setDatasetName(event.target.value)}
              placeholder="Dataset name"
              className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-950 outline-none focus:border-slate-400"
            />
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <div className="flex justify-between"><span>Labels</span><span className="font-medium text-slate-950">{selectedLabels.length}</span></div>
              <div className="flex justify-between"><span>Files to upload</span><span className="font-medium text-slate-950">{selectedLocalDataFiles.length}</span></div>
              <div className="flex justify-between"><span>Cloud files</span><span className="font-medium text-slate-950">{selectedCloudFiles.length}</span></div>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={createDataset}
                disabled={busy || !selectedLabels.length || !selectedLocalDataFiles.length}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Database className="h-4 w-4" />
                Create dataset
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold text-slate-950">Datasets</h2>
              <button
                type="button"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await deleteAllDatasets();
                    await loadData();
                    toast.success('Datasets cleared', 'All existing datasets were deleted');
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy || !datasets.length}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Clear all
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {datasets.map((dataset) => (
                <article key={dataset.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="font-semibold text-slate-950">{dataset.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{dataset.file_count || 0} files</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => downloadDataset(dataset)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDataset(dataset)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </article>
              ))}
              {!datasets.length && (
                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No datasets yet.
                </div>
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
