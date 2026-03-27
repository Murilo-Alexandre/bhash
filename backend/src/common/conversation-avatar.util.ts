import * as fs from 'fs';
import { promises as fsp } from 'fs';
import * as path from 'path';
import { normalizeUploadedFileName } from './upload-filename.util';

function slug(value?: string | null) {
  const normalized = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'conversation';
}

export function safeConversationImageExt(original: string) {
  const ext = path.extname(normalizeUploadedFileName(original) || '').toLowerCase();
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') return ext;
  return '.png';
}

export function conversationAvatarFileBase(conversationId: string, fallbackName?: string | null) {
  return `${slug(fallbackName)}_${slug(conversationId)}_avatar`;
}

export function conversationAvatarUploadsDir() {
  return path.join(process.cwd(), 'public', 'uploads', 'conversation-avatars');
}

export function ensureConversationAvatarUploadsDir() {
  const dir = conversationAvatarUploadsDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function safeConversationAvatarPathFromUrl(raw?: string | null) {
  const value = String(raw ?? '').trim();
  if (!value.startsWith('/static/uploads/conversation-avatars/')) return null;
  const filename = value.slice('/static/uploads/conversation-avatars/'.length).replace(/\\/g, '/');
  const normalized = path.posix.normalize(filename);
  if (!normalized || normalized === '.' || normalized.startsWith('..')) return null;
  return path.join(conversationAvatarUploadsDir(), normalized);
}

export async function deleteConversationAvatarFileSafe(filePath?: string | null) {
  if (!filePath) return;
  try {
    await fsp.unlink(filePath);
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err;
  }
}

export async function deleteConversationAvatarVariantsByBase(base: string, keepFilename?: string) {
  const dir = conversationAvatarUploadsDir();
  let files: string[] = [];
  try {
    files = await fsp.readdir(dir);
  } catch (err: any) {
    if (err?.code === 'ENOENT') return;
    throw err;
  }

  const keep = String(keepFilename ?? '').toLowerCase();
  const allowedExt = new Set(['.png', '.jpg', '.jpeg', '.webp']);

  await Promise.all(
    files
      .filter((name) => {
        if (!name.toLowerCase().startsWith(base.toLowerCase())) return false;
        const ext = path.extname(name).toLowerCase();
        if (!allowedExt.has(ext)) return false;
        if (keep && name.toLowerCase() === keep) return false;
        return true;
      })
      .map((name) => deleteConversationAvatarFileSafe(path.join(dir, name))),
  );
}
