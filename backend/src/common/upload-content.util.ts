import * as fs from 'fs/promises';
import * as path from 'path';
import { isLikelyImageFile } from './upload-filename.util';

const SIGNATURE_READ_BYTES = 512;
const HTML_LIKE_RE = /^\s*(?:<!doctype\s+html|<html\b|<head\b|<body\b|<script\b)/i;

type KnownImageKind = 'gif' | 'png' | 'jpeg' | 'webp' | 'bmp' | 'svg';

function hasPrefix(buffer: Buffer, prefix: number[]) {
  if (buffer.length < prefix.length) return false;
  return prefix.every((value, index) => buffer[index] === value);
}

function detectImageKind(buffer: Buffer): KnownImageKind | null {
  if (buffer.length >= 6) {
    const gifHeader = buffer.subarray(0, 6).toString('ascii');
    if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') return 'gif';
  }

  if (hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (hasPrefix(buffer, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (buffer.length >= 12) {
    const riff = buffer.subarray(0, 4).toString('ascii');
    const webp = buffer.subarray(8, 12).toString('ascii');
    if (riff === 'RIFF' && webp === 'WEBP') return 'webp';
  }
  if (hasPrefix(buffer, [0x42, 0x4d])) return 'bmp';

  const text = buffer.toString('utf8').replace(/^\uFEFF/, '').trimStart();
  if (/^<svg[\s>]/i.test(text) || /^<\?xml[\s\S]*?<svg[\s>]/i.test(text)) return 'svg';

  return null;
}

function looksLikeHtmlDocument(buffer: Buffer) {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '').trimStart();
  return HTML_LIKE_RE.test(text);
}

function expectedImageKindFromNameOrMime(input?: {
  mimetype?: string | null;
  originalname?: string | null;
  filename?: string | null;
}) {
  const ext = path.extname(String(input?.originalname ?? input?.filename ?? '')).toLowerCase();
  if (ext === '.gif') return 'gif' as const;
  if (ext === '.png') return 'png' as const;
  if (ext === '.jpg' || ext === '.jpeg') return 'jpeg' as const;
  if (ext === '.webp') return 'webp' as const;
  if (ext === '.bmp') return 'bmp' as const;
  if (ext === '.svg') return 'svg' as const;

  const mime = String(input?.mimetype ?? '').toLowerCase();
  if (mime === 'image/gif') return 'gif' as const;
  if (mime === 'image/png') return 'png' as const;
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpeg' as const;
  if (mime === 'image/webp') return 'webp' as const;
  if (mime === 'image/bmp') return 'bmp' as const;
  if (mime === 'image/svg+xml') return 'svg' as const;

  return null;
}

export async function validateUploadedChatAttachment(file?: Express.Multer.File) {
  if (!file?.path || !isLikelyImageFile(file)) return null;

  const buffer = await fs.readFile(file.path).then((data) => data.subarray(0, SIGNATURE_READ_BYTES));
  const expectedKind = expectedImageKindFromNameOrMime(file);
  const actualKind = detectImageKind(buffer);

  if (looksLikeHtmlDocument(buffer)) {
    return 'O arquivo enviado não é uma imagem/GIF válido. Parece uma página da web salva no navegador. Baixe o arquivo original e tente novamente.';
  }

  if (expectedKind && actualKind !== expectedKind) {
    return `O arquivo enviado não corresponde a um ${expectedKind.toUpperCase()} válido. Baixe o arquivo original e tente novamente.`;
  }

  if (expectedKind && !actualKind) {
    return 'O arquivo enviado não é uma imagem válida. Baixe o arquivo original e tente novamente.';
  }

  return null;
}

export async function removeUploadedChatAttachment(file?: Express.Multer.File) {
  if (!file?.path) return;
  try {
    await fs.unlink(file.path);
  } catch {
    // Best effort cleanup for rejected uploads.
  }
}
