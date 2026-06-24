import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { contentTypeForLocalFile, listLocalLabelFiles, localPathForRelative } from '@/lib/localLabelFiles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://web-production-d7d37.up.railway.app';
const NORMALIZED_BACKEND_BASE_URL = BACKEND_BASE_URL.replace(/\/$/, '');
const API_BASE_URL = NORMALIZED_BACKEND_BASE_URL.endsWith('/api')
  ? NORMALIZED_BACKEND_BASE_URL
  : `${NORMALIZED_BACKEND_BASE_URL}/api`;

function safeUploadName(relativePath: string): string {
  return relativePath
    .split(/[\\/]+/)
    .filter(Boolean)
    .join('__')
    .replace(/[^A-Za-z0-9._-]+/g, '_');
}

async function backendJson(pathname: string, authorization: string | null, body: unknown, method = 'POST') {
  const response = await fetch(`${API_BASE_URL}${pathname}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.error || `${method} ${pathname} failed with ${response.status}`);
  }
  return payload;
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ success: false, error: 'Missing authorization header' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const selectedLabels = Array.isArray(body.labels)
      ? body.labels.map((label: unknown) => String(label || '').trim()).filter(Boolean)
      : [];
    const datasetName = String(body.name || selectedLabels.join(' + ') || 'Local labeled dataset').trim();

    if (!selectedLabels.length) {
      return NextResponse.json({ success: false, error: 'Select at least one label' }, { status: 400 });
    }

    const selected = listLocalLabelFiles()
      .filter((group) => selectedLabels.includes(group.label))
      .flatMap((group) => group.files);

    if (!selected.length) {
      return NextResponse.json({ success: false, error: 'Selected labels have no local data files' }, { status: 400 });
    }

    const created = await backendJson('/datasets/create', authorization, {
      name: datasetName,
      description: `Local labels from thoth/data: ${selectedLabels.join(', ')}`,
    });
    const datasetId = created?.dataset?.id;
    if (!datasetId) throw new Error('Dataset creation did not return an id');

    const uploadedFiles: Array<{ file_id: number; label: string }> = [];
    const errors: string[] = [];

    for (const file of selected) {
      try {
        const filePath = localPathForRelative(file.relativePath);
        if (!filePath || !fs.existsSync(filePath)) {
          errors.push(`${file.relativePath}: missing`);
          continue;
        }
        const stat = fs.statSync(filePath);
        if (!stat.isFile() || stat.size === 0) {
          errors.push(`${file.relativePath}: empty or not a file`);
          continue;
        }
        const content = fs.readFileSync(filePath).toString('base64');
        const upload = await backendJson('/file/upload', authorization, {
          filename: safeUploadName(file.relativePath),
          content,
          content_type: contentTypeForLocalFile(filePath),
          is_base64: true,
          metadata: {
            labels: [file.label],
            primary_label: file.label,
            source: 'thoth/data',
            source_path: file.relativePath,
            minute: file.minute,
            original_filename: path.basename(filePath),
          },
        });
        const fileId = upload?.file_id;
        if (fileId) uploadedFiles.push({ file_id: fileId, label: file.label });
      } catch (error) {
        errors.push(`${file.relativePath}: ${error instanceof Error ? error.message : 'upload failed'}`);
      }
    }

    if (!uploadedFiles.length) {
      throw new Error(`No files uploaded. ${errors.join('; ')}`);
    }

    const attached = await backendJson(`/datasets/${datasetId}/files`, authorization, { files: uploadedFiles });

    return NextResponse.json({
      success: true,
      dataset: created.dataset,
      uploaded_count: uploadedFiles.length,
      attached,
      errors,
    });
  } catch (error) {
    console.error('Error creating local label dataset:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create dataset' },
      { status: 500 }
    );
  }
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
