// @ts-nocheck
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { unzipSync } from "fflate";
import readXlsxFile from "read-excel-file/browser";
import { API_BASE } from "../api";

export type UserMini = {
  id: string;
  username: string;
  name: string;
  email?: string | null;
  extension?: string | null;
  avatarUrl?: string | null;
  company?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
};

export type ReactionRaw = {
  id: string;
  emoji: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    name: string;
  };
};

export type ReactionItem = {
  emoji: string;
  count: number;
  reactedByMe?: boolean;
};

export type ReplyToMessage = {
  id: string;
  body?: string | null;
  contentType?: "TEXT" | "IMAGE" | "FILE" | "AUDIO";
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  sender?: {
    id: string;
    username: string;
    name: string;
    avatarUrl?: string | null;
  } | null;
};

export type Message = {
  id: string;
  createdAt: string;
  conversationId: string;
  senderId: string;
  body?: string | null;
  contentType?: "TEXT" | "IMAGE" | "FILE" | "AUDIO";
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  attachmentSize?: number | null;
  replyToId?: string | null;
  deletedAt?: string | null;
  sender?: UserMini | null;
  replyTo?: ReplyToMessage | null;
  reactions?: ReactionRaw[];
  isFavorited?: boolean;
};

export type ConversationListItem = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  otherUser: UserMini;
  lastMessage?: Message | null;
  unreadCount?: number;
  pinned?: boolean;
};


const ATTACHMENT_MOJIBAKE_MARKERS = /[ÃÂ�]/u;
const IMAGE_FILE_RE = /\.(png|jpe?g|webp|gif|bmp|svg|heic|heif|avif)([?#]|$)/i;
const VIDEO_FILE_RE = /\.(mp4|webm|ogg|ogv|mov|m4v|avi|mkv|3gp|mpeg?|mpg|wmv)([?#]|$)/i;
const AUDIO_FILE_RE = /\.(mp3|m4a|aac|wav|flac|oga|ogg|opus|weba|amr|mpga)([?#]|$)/i;
const SPREADSHEET_FILE_RE = /\.(xlsx|xlsm|xls|csv|ods|fods)([?#]|$)/i;
const SPREADSHEET_MIME_RE =
  /(application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.ms-excel\.sheet\.macroenabled\.12|application\/vnd\.ms-excel|application\/msexcel|application\/x-msexcel|application\/vnd\.oasis\.opendocument\.spreadsheet|application\/vnd\.oasis\.opendocument\.spreadsheet-flat-xml|text\/csv|application\/csv)/i;
const LEGACY_XLS_FILE_RE = /\.xls([?#]|$)/i;
const TEXT_DOCUMENT_FILE_RE = /\.(docx|docm|dotx|dotm|doc|odt|fodt|rtf|txt)([?#]|$)/i;
const TEXT_DOCUMENT_MIME_RE =
  /(application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/vnd\.ms-word\.document\.macroenabled\.12|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.template|application\/vnd\.ms-word\.template\.macroenabled\.12|application\/vnd\.oasis\.opendocument\.text|application\/vnd\.oasis\.opendocument\.text-flat-xml|application\/msword|application\/rtf|text\/rtf|text\/plain)/i;
const PRESENTATION_FILE_RE = /\.(pptx|pptm|ppsx|ppsm|potx|potm|ppt|odp|fodp)([?#]|$)/i;
const PRESENTATION_MIME_RE =
  /(application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation|application\/vnd\.ms-powerpoint\.presentation\.macroenabled\.12|application\/vnd\.openxmlformats-officedocument\.presentationml\.slideshow|application\/vnd\.ms-powerpoint\.slideshow\.macroenabled\.12|application\/vnd\.openxmlformats-officedocument\.presentationml\.template|application\/vnd\.ms-powerpoint\.template\.macroenabled\.12|application\/vnd\.oasis\.opendocument\.presentation|application\/vnd\.oasis\.opendocument\.presentation-flat-xml|application\/vnd\.ms-powerpoint)/i;
const MAX_CHAT_ATTACHMENT_BYTES = 250 * 1024 * 1024;
const SPREADSHEET_PREVIEW_MAX_ROWS = 5;
const SPREADSHEET_PREVIEW_MAX_COLS = 5;
const TEXT_DOCUMENT_PREVIEW_MAX_PARAGRAPHS = 7;
const PRESENTATION_PREVIEW_MAX_POINTS = 5;
const AUDIO_PLAYBACK_RATES = [1, 1.5, 2] as const;
const AUDIO_PLAYBACK_RATE_STORAGE_KEY = "bhash:audio-playback-rate";
const AUDIO_PLAYBACK_RATE_EVENT = "bhash:audio-playback-rate-change";

type SpreadsheetCellValue = string | number | boolean | Date | null;

type SpreadsheetPreviewData = {
  label: string;
  rows: string[][];
  columnCount: number;
  fallback?: boolean;
};

const spreadsheetPreviewCache = new Map<string, SpreadsheetPreviewData>();
const spreadsheetPreviewPending = new Map<string, Promise<SpreadsheetPreviewData>>();
let legacySpreadsheetReaderPromise: Promise<typeof import("@e965/xlsx")> | null = null;
const optimisticAudioMessageIds = new Set<string>();

type TextDocumentPreviewData = {
  label: string;
  paragraphs: string[];
  fallback?: boolean;
};

const textDocumentPreviewCache = new Map<string, TextDocumentPreviewData>();
const textDocumentPreviewPending = new Map<string, Promise<TextDocumentPreviewData>>();

type PresentationPreviewData = {
  label: string;
  title: string;
  bullets: string[];
  slideCount: number;
  fallback?: boolean;
};

const presentationPreviewCache = new Map<string, PresentationPreviewData>();
const presentationPreviewPending = new Map<string, Promise<PresentationPreviewData>>();

function attachmentMojibakeScore(value: string) {
  let score = 0;
  for (const char of value) {
    if (char === "�") score += 4;
    if (char === "Ã" || char === "Â") score += 2;
  }
  return score;
}

function decodeLatin1AsUtf8(value: string) {
  if (typeof TextDecoder === "undefined") return value;
  const bytes = Uint8Array.from([...value].map((char) => char.charCodeAt(0) & 0xff));
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function normalizeAttachmentDisplayName(value?: string | null) {
  const raw = String(value ?? "").replace(/\0/g, "").trim();
  if (!raw) return "";

  const normalized = raw.normalize("NFC");
  if (!ATTACHMENT_MOJIBAKE_MARKERS.test(normalized)) return normalized;

  try {
    const decoded = decodeLatin1AsUtf8(normalized).replace(/\0/g, "").trim().normalize("NFC");
    if (!decoded) return normalized;
    return attachmentMojibakeScore(decoded) < attachmentMojibakeScore(normalized) ? decoded : normalized;
  } catch {
    return normalized;
  }
}

function isPdfAttachment(message: Partial<Message>) {
  const mime = String(message.attachmentMime ?? "").toLowerCase();
  const name = normalizeAttachmentDisplayName(message.attachmentName).toLowerCase();
  const url = String(message.attachmentUrl ?? "").toLowerCase();
  return mime.includes("pdf") || name.endsWith(".pdf") || url.includes(".pdf");
}

function isSpreadsheetAttachment(message: Partial<Message>) {
  if (message.contentType !== "FILE") return false;
  const mime = String(message.attachmentMime ?? "").toLowerCase();
  const name = normalizeAttachmentDisplayName(message.attachmentName).toLowerCase();
  const url = String(message.attachmentUrl ?? "").toLowerCase();
  return SPREADSHEET_MIME_RE.test(mime) || SPREADSHEET_FILE_RE.test(name) || SPREADSHEET_FILE_RE.test(url);
}

function isTextDocumentAttachment(message: Partial<Message>) {
  if (message.contentType !== "FILE") return false;
  if (isPdfAttachment(message) || isSpreadsheetAttachment(message)) return false;
  const mime = String(message.attachmentMime ?? "").toLowerCase();
  const name = normalizeAttachmentDisplayName(message.attachmentName).toLowerCase();
  const url = String(message.attachmentUrl ?? "").toLowerCase();
  return TEXT_DOCUMENT_MIME_RE.test(mime) || TEXT_DOCUMENT_FILE_RE.test(name) || TEXT_DOCUMENT_FILE_RE.test(url);
}

function isPresentationAttachment(message: Partial<Message>) {
  if (message.contentType !== "FILE") return false;
  if (isPdfAttachment(message) || isSpreadsheetAttachment(message) || isTextDocumentAttachment(message)) {
    return false;
  }
  const mime = String(message.attachmentMime ?? "").toLowerCase();
  const name = normalizeAttachmentDisplayName(message.attachmentName).toLowerCase();
  const url = String(message.attachmentUrl ?? "").toLowerCase();
  return PRESENTATION_MIME_RE.test(mime) || PRESENTATION_FILE_RE.test(name) || PRESENTATION_FILE_RE.test(url);
}

function attachmentStorageKind(message: Partial<Message>) {
  const url = String(message.attachmentUrl ?? "").toLowerCase();
  if (url.includes("/chat-files/")) return "file";
  if (url.includes("/chat-media/")) return "media";
  return null;
}

function hasImageFileSignature(message: Partial<Message>) {
  const mime = String(message.attachmentMime ?? "").toLowerCase();
  const name = normalizeAttachmentDisplayName(message.attachmentName).toLowerCase();
  const url = String(message.attachmentUrl ?? "").toLowerCase();
  return mime.startsWith("image/") || IMAGE_FILE_RE.test(name) || IMAGE_FILE_RE.test(url);
}

function hasVideoFileSignature(message: Partial<Message>) {
  const mime = String(message.attachmentMime ?? "").toLowerCase();
  const name = normalizeAttachmentDisplayName(message.attachmentName).toLowerCase();
  const url = String(message.attachmentUrl ?? "").toLowerCase();
  return mime.startsWith("video/") || VIDEO_FILE_RE.test(name) || VIDEO_FILE_RE.test(url);
}

function hasAudioFileSignature(message: Partial<Message>) {
  const mime = String(message.attachmentMime ?? "").toLowerCase();
  const name = normalizeAttachmentDisplayName(message.attachmentName).toLowerCase();
  const url = String(message.attachmentUrl ?? "").toLowerCase();
  return mime.startsWith("audio/") || AUDIO_FILE_RE.test(name) || AUDIO_FILE_RE.test(url);
}

function isImageAttachment(message: Partial<Message>) {
  const storageKind = attachmentStorageKind(message);
  if (storageKind === "file") return false;
  if (message.contentType === "IMAGE") return true;
  if (message.contentType === "FILE" || message.contentType === "AUDIO") return false;
  return hasImageFileSignature(message);
}

function isVideoAttachment(message: Partial<Message>) {
  const storageKind = attachmentStorageKind(message);
  if (storageKind === "file") return false;
  if (message.contentType === "FILE" || message.contentType === "AUDIO") return false;
  return hasVideoFileSignature(message);
}

function isMediaAttachment(message: Partial<Message>) {
  return isVideoAttachment(message) || isImageAttachment(message);
}

function isAudioMessageAttachment(message: Partial<Message>) {
  if (message.contentType === "AUDIO") return true;
  if (message.id && optimisticAudioMessageIds.has(message.id) && hasAudioFileSignature(message)) return true;
  const url = String(message.attachmentUrl ?? "").toLowerCase();
  return url.includes("/chat-audio/") && hasAudioFileSignature(message);
}

function isAudioDocumentAttachment(message: Partial<Message>) {
  return message.contentType === "FILE" && hasAudioFileSignature(message) && !isAudioMessageAttachment(message);
}

function isImageDocumentPreview(message: Partial<Message>) {
  return message.contentType === "FILE" && hasImageFileSignature(message);
}

function isVideoDocumentPreview(message: Partial<Message>) {
  return message.contentType === "FILE" && hasVideoFileSignature(message);
}

function isVideoFileLike(file?: File | null) {
  if (!file) return false;
  const type = String(file.type ?? "").toLowerCase();
  const name = String(file.name ?? "").toLowerCase();
  return type.startsWith("video/") || VIDEO_FILE_RE.test(name);
}

function isImageFileLike(file?: File | null) {
  if (!file) return false;
  const type = String(file.type ?? "").toLowerCase();
  const name = String(file.name ?? "").toLowerCase();
  return type.startsWith("image/") || IMAGE_FILE_RE.test(name);
}

function isMediaFileLike(file?: File | null) {
  return isVideoFileLike(file) || isImageFileLike(file);
}

function isAudioFileLike(file?: File | null) {
  if (!file) return false;
  const type = String(file.type ?? "").toLowerCase();
  const name = String(file.name ?? "").toLowerCase();
  return type.startsWith("audio/") || AUDIO_FILE_RE.test(name);
}

function buildPdfPreviewUrl(raw?: string | null) {
  const absolute = toAbsoluteUrl(raw);
  if (!absolute) return null;
  const [base] = absolute.split("#");
  return `${base}#toolbar=0&navpanes=0&scrollbar=0&page=1&view=FitH`;
}

function buildSpreadsheetPreviewLabel(value?: string | null) {
  const normalized = normalizeAttachmentDisplayName(value);
  const label = normalized ? normalized.replace(/\.[^.]+$/, "").trim() : "";
  return label || "Planilha";
}

function buildTextDocumentPreviewLabel(value?: string | null) {
  const normalized = normalizeAttachmentDisplayName(value);
  const label = normalized ? normalized.replace(/\.[^.]+$/, "").trim() : "";
  return label || "Documento";
}

function buildPresentationPreviewLabel(value?: string | null) {
  const normalized = normalizeAttachmentDisplayName(value);
  const label = normalized ? normalized.replace(/\.[^.]+$/, "").trim() : "";
  return label || "Apresentacao";
}

function formatSpreadsheetCellValue(value: SpreadsheetCellValue) {
  if (value == null) return "";
  if (value instanceof Date) return value.toLocaleDateString("pt-BR");
  const normalized = String(value).replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > 36 ? `${normalized.slice(0, 33)}...` : normalized;
}

function buildSpreadsheetFallbackPreview(
  attachmentName?: string | null,
  message = "Previa indisponivel"
): SpreadsheetPreviewData {
  return {
    label: buildSpreadsheetPreviewLabel(attachmentName),
    columnCount: 4,
    rows: [
      [message, "", "", ""],
      ["", "", "", ""],
      ["", "", "", ""],
      ["", "", "", ""],
    ],
    fallback: true,
  };
}

function buildSpreadsheetPreviewFromRows(
  sourceRows: SpreadsheetCellValue[][],
  attachmentName?: string | null
): SpreadsheetPreviewData {
  const previewRows = sourceRows
    .map((row) => row.map((cell) => formatSpreadsheetCellValue(cell)))
    .filter((row) => row.some((cell) => cell.length > 0))
    .slice(0, SPREADSHEET_PREVIEW_MAX_ROWS);

  if (!previewRows.length) {
    return buildSpreadsheetFallbackPreview(attachmentName, "Planilha vazia");
  }

  const widestRow = previewRows.reduce((max, row) => Math.max(max, row.length), 0);
  const columnCount = Math.max(4, Math.min(SPREADSHEET_PREVIEW_MAX_COLS, widestRow || 1));

  return {
    label: buildSpreadsheetPreviewLabel(attachmentName),
    columnCount,
    rows: previewRows.map((row) =>
      Array.from({ length: columnCount }, (_, index) => row[index] ?? "")
    ),
  };
}

async function getLegacySpreadsheetReader() {
  if (!legacySpreadsheetReaderPromise) {
    legacySpreadsheetReaderPromise = Promise.all([
      import("@e965/xlsx"),
      import("@e965/xlsx/dist/cpexcel"),
    ]).then(([xlsx, cptable]) => {
      xlsx.set_cptable(cptable);
      return xlsx;
    });
  }

  return legacySpreadsheetReaderPromise;
}

async function parseLegacyXlsPreviewRows(buffer: ArrayBuffer) {
  const xlsx = await getLegacySpreadsheetReader();
  const workbook = xlsx.read(buffer, {
    type: "array",
    dense: true,
    cellText: true,
    cellDates: true,
    sheetRows: SPREADSHEET_PREVIEW_MAX_ROWS,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [] as SpreadsheetCellValue[][];
  const firstSheet = workbook.Sheets[firstSheetName];
  if (!firstSheet) return [] as SpreadsheetCellValue[][];

  const rows = xlsx.utils.sheet_to_json<SpreadsheetCellValue[]>(firstSheet, {
    header: 1,
    raw: false,
    blankrows: false,
    defval: "",
  });

  return rows
    .slice(0, SPREADSHEET_PREVIEW_MAX_ROWS)
    .map((row) => row.slice(0, SPREADSHEET_PREVIEW_MAX_COLS));
}

function detectCsvDelimiter(line: string) {
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestScore = -1;
  for (const delimiter of candidates) {
    const score = line.split(delimiter).length;
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }
  return best;
}

function parseCsvPreviewRows(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r\n|\n|\r/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, SPREADSHEET_PREVIEW_MAX_ROWS);

  if (!lines.length) return [] as SpreadsheetCellValue[][];

  const delimiter = detectCsvDelimiter(lines[0] ?? ",");
  return lines.map((line) =>
    line
      .split(delimiter)
      .slice(0, SPREADSHEET_PREVIEW_MAX_COLS)
      .map((cell) => cell.trim())
  );
}

function getXmlAttrByLocalName(element: Element, localName: string) {
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.localName === localName) return attribute.value;
  }
  return null;
}

function normalizeSpreadsheetText(value?: string | null) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function extractOdsCellValue(cell: Element): SpreadsheetCellValue {
  if (cell.localName === "covered-table-cell") return "";

  const paragraphs = Array.from(cell.children)
    .filter((child): child is Element => child.nodeType === 1 && child.localName === "p")
    .map((paragraph) => normalizeSpreadsheetText(paragraph.textContent))
    .filter(Boolean);

  const valueType = getXmlAttrByLocalName(cell, "value-type") ?? "";
  if (valueType === "float" || valueType === "currency" || valueType === "percentage") {
    return getXmlAttrByLocalName(cell, "value") ?? paragraphs.join(" ");
  }
  if (valueType === "boolean") {
    return getXmlAttrByLocalName(cell, "boolean-value") ?? paragraphs.join(" ");
  }
  if (valueType === "date") {
    return getXmlAttrByLocalName(cell, "date-value") ?? paragraphs.join(" ");
  }
  if (valueType === "time") {
    return getXmlAttrByLocalName(cell, "time-value") ?? paragraphs.join(" ");
  }
  if (valueType === "string") {
    return paragraphs.join(" ");
  }

  const stringValue = getXmlAttrByLocalName(cell, "string-value");
  if (stringValue) return stringValue;
  if (paragraphs.length) return paragraphs.join(" ");
  return normalizeSpreadsheetText(cell.textContent);
}

function parseOdsPreviewRowsFromXml(xmlText: string) {
  if (typeof DOMParser === "undefined") return [] as SpreadsheetCellValue[][];

  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  if (xml.getElementsByTagName("parsererror").length) return [] as SpreadsheetCellValue[][];

  const firstSheet = Array.from(xml.getElementsByTagName("*")).find((node) => node.localName === "table");
  if (!firstSheet) return [] as SpreadsheetCellValue[][];

  const rows: SpreadsheetCellValue[][] = [];
  const rowElements = Array.from(firstSheet.children).filter(
    (child): child is Element => child.nodeType === 1 && child.localName === "table-row"
  );

  for (const rowElement of rowElements) {
    const rowRepeatRaw = Number.parseInt(getXmlAttrByLocalName(rowElement, "number-rows-repeated") ?? "1", 10);
    const rowRepeat = Number.isFinite(rowRepeatRaw) && rowRepeatRaw > 0 ? rowRepeatRaw : 1;
    const values: SpreadsheetCellValue[] = [];

    const cellElements = Array.from(rowElement.children).filter(
      (child): child is Element =>
        child.nodeType === 1 && (child.localName === "table-cell" || child.localName === "covered-table-cell")
    );

    for (const cell of cellElements) {
      const columnRepeatRaw = Number.parseInt(getXmlAttrByLocalName(cell, "number-columns-repeated") ?? "1", 10);
      const columnRepeat = Number.isFinite(columnRepeatRaw) && columnRepeatRaw > 0 ? columnRepeatRaw : 1;
      const value = extractOdsCellValue(cell);

      for (let index = 0; index < columnRepeat && values.length < SPREADSHEET_PREVIEW_MAX_COLS; index += 1) {
        values.push(value);
      }

      if (values.length >= SPREADSHEET_PREVIEW_MAX_COLS) break;
    }

    for (let index = 0; index < rowRepeat && rows.length < SPREADSHEET_PREVIEW_MAX_ROWS; index += 1) {
      rows.push([...values]);
    }

    if (rows.length >= SPREADSHEET_PREVIEW_MAX_ROWS) break;
  }

  return rows;
}

function parseOdsPreviewRowsFromArchive(buffer: ArrayBuffer) {
  try {
    const archive = unzipSync(new Uint8Array(buffer));
    const contentXml = archive["content.xml"];
    if (!contentXml) return [] as SpreadsheetCellValue[][];
    const xmlText = new TextDecoder("utf-8").decode(contentXml);
    return parseOdsPreviewRowsFromXml(xmlText);
  } catch {
    return [] as SpreadsheetCellValue[][];
  }
}

async function loadSpreadsheetPreview(
  rawUrl?: string | null,
  attachmentName?: string | null,
  attachmentMime?: string | null
) {
  const absolute = toAbsoluteUrl(rawUrl);
  if (!absolute) return buildSpreadsheetFallbackPreview(attachmentName);
  const cached = spreadsheetPreviewCache.get(absolute);
  if (cached) return cached;

  const pending = spreadsheetPreviewPending.get(absolute);
  if (pending) return pending;

  const promise = (async () => {
    const lowerMime = String(attachmentMime ?? "").toLowerCase();
    const lowerName = normalizeAttachmentDisplayName(attachmentName).toLowerCase();
    const lowerUrl = absolute.toLowerCase();
    const isCsv = lowerMime.includes("csv") || lowerName.endsWith(".csv") || lowerUrl.includes(".csv");
    const isLegacyXls =
      (lowerMime.includes("vnd.ms-excel") ||
        lowerMime.includes("application/msexcel") ||
        lowerMime.includes("application/x-msexcel") ||
        LEGACY_XLS_FILE_RE.test(lowerName) ||
        LEGACY_XLS_FILE_RE.test(lowerUrl)) &&
      !lowerName.endsWith(".xlsx") &&
      !lowerName.endsWith(".xlsm") &&
      !lowerUrl.includes(".xlsx") &&
      !lowerUrl.includes(".xlsm");
    const isFlatOds =
      lowerMime.includes("spreadsheet-flat-xml") ||
      lowerName.endsWith(".fods") ||
      lowerUrl.includes(".fods");
    const isOds =
      lowerMime.includes("vnd.oasis.opendocument.spreadsheet") ||
      lowerName.endsWith(".ods") ||
      lowerUrl.includes(".ods");

    try {
      const response = await fetch(absolute, { credentials: "include" });
      if (!response.ok) {
        return buildSpreadsheetFallbackPreview(attachmentName);
      }

      if (isCsv) {
        const text = await response.text();
        return buildSpreadsheetPreviewFromRows(parseCsvPreviewRows(text), attachmentName);
      }

      if (isFlatOds) {
        const xmlText = await response.text();
        return buildSpreadsheetPreviewFromRows(parseOdsPreviewRowsFromXml(xmlText), attachmentName);
      }

      if (isOds) {
        const buffer = await response.arrayBuffer();
        return buildSpreadsheetPreviewFromRows(parseOdsPreviewRowsFromArchive(buffer), attachmentName);
      }

      if (isLegacyXls) {
        const buffer = await response.arrayBuffer();
        return buildSpreadsheetPreviewFromRows(await parseLegacyXlsPreviewRows(buffer), attachmentName);
      }

      const blob = await response.blob();
      const rows = (await readXlsxFile(blob)) as SpreadsheetCellValue[][];
      return buildSpreadsheetPreviewFromRows(rows, attachmentName);
    } catch {
      return buildSpreadsheetFallbackPreview(attachmentName);
    }
  })();

  spreadsheetPreviewPending.set(absolute, promise);

  try {
    const resolved = await promise;
    spreadsheetPreviewCache.set(absolute, resolved);
    return resolved;
  } finally {
    spreadsheetPreviewPending.delete(absolute);
  }
}

function spreadsheetColumnLabel(index: number) {
  let label = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    current = Math.floor((current - 1) / 26);
  }
  return label;
}

function normalizeDocumentParagraphText(value?: string | null) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
}

function buildTextDocumentFallbackPreview(
  attachmentName?: string | null,
  message = "Previa indisponivel"
): TextDocumentPreviewData {
  return {
    label: buildTextDocumentPreviewLabel(attachmentName),
    paragraphs: [message],
    fallback: true,
  };
}

function buildTextDocumentPreviewFromParagraphs(
  paragraphs: string[],
  attachmentName?: string | null
): TextDocumentPreviewData {
  const normalized = paragraphs
    .map((paragraph) => normalizeDocumentParagraphText(paragraph))
    .filter(Boolean)
    .slice(0, TEXT_DOCUMENT_PREVIEW_MAX_PARAGRAPHS);

  if (!normalized.length) {
    return buildTextDocumentFallbackPreview(attachmentName, "Documento vazio");
  }

  return {
    label: buildTextDocumentPreviewLabel(attachmentName),
    paragraphs: normalized,
  };
}

type PresentationSlidePreview = {
  title: string;
  bullets: string[];
};

function buildPresentationFallbackPreview(
  attachmentName?: string | null,
  message = "Previa indisponivel"
): PresentationPreviewData {
  return {
    label: buildPresentationPreviewLabel(attachmentName),
    title: "Apresentacao",
    bullets: [message],
    slideCount: 1,
    fallback: true,
  };
}

function buildPresentationPreviewFromSlides(
  slides: PresentationSlidePreview[],
  attachmentName?: string | null
): PresentationPreviewData {
  const usableSlides = slides.filter((slide) => slide.title || slide.bullets.length);
  if (!usableSlides.length) {
    return buildPresentationFallbackPreview(attachmentName, "Apresentacao vazia");
  }

  const firstSlide = usableSlides[0];
  const bullets = firstSlide.bullets.filter(Boolean).slice(0, PRESENTATION_PREVIEW_MAX_POINTS);

  return {
    label: buildPresentationPreviewLabel(attachmentName),
    title: firstSlide.title || "Apresentacao",
    bullets,
    slideCount: usableSlides.length,
  };
}

function extractWordParagraphText(paragraph: Element): string {
  let result = "";
  const stack = Array.from(paragraph.childNodes).reverse();

  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (node.nodeType !== 1) continue;
    const element = node as Element;
    if (element.localName === "t") {
      result += element.textContent ?? "";
      continue;
    }
    if (element.localName === "tab") {
      result += "    ";
      continue;
    }
    if (element.localName === "br" || element.localName === "cr") {
      result += " ";
      continue;
    }
    stack.push(...Array.from(element.childNodes).reverse());
  }

  return normalizeDocumentParagraphText(result);
}

function parseDocxPreviewParagraphsFromXml(xmlText: string) {
  if (typeof DOMParser === "undefined") return [] as string[];

  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  if (xml.getElementsByTagName("parsererror").length) return [] as string[];

  return Array.from(xml.getElementsByTagName("*"))
    .filter((node) => node.localName === "p")
    .map((paragraph) => extractWordParagraphText(paragraph))
    .filter(Boolean)
    .slice(0, TEXT_DOCUMENT_PREVIEW_MAX_PARAGRAPHS);
}

function extractOpenTextParagraphsFromXml(xmlText: string) {
  if (typeof DOMParser === "undefined") return [] as string[];

  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  if (xml.getElementsByTagName("parsererror").length) return [] as string[];

  return Array.from(xml.getElementsByTagName("*"))
    .filter((node) => node.localName === "p" || node.localName === "h")
    .map((node) => normalizeDocumentParagraphText(node.textContent))
    .filter(Boolean)
    .slice(0, TEXT_DOCUMENT_PREVIEW_MAX_PARAGRAPHS);
}

function extractPresentationParagraphText(paragraph: Element) {
  let result = "";
  const stack = Array.from(paragraph.childNodes).reverse();

  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (node.nodeType !== 1) continue;
    const element = node as Element;
    if (element.localName === "t") {
      result += element.textContent ?? "";
      continue;
    }
    if (element.localName === "tab") {
      result += "    ";
      continue;
    }
    if (element.localName === "br") {
      result += " ";
      continue;
    }
    stack.push(...Array.from(element.childNodes).reverse());
  }

  return normalizeDocumentParagraphText(result);
}

function buildPresentationSlideFromParagraphs(paragraphs: string[]): PresentationSlidePreview {
  const normalized = paragraphs.map((paragraph) => normalizeDocumentParagraphText(paragraph)).filter(Boolean);
  return {
    title: normalized[0] ?? "",
    bullets: normalized.slice(1, 1 + PRESENTATION_PREVIEW_MAX_POINTS),
  };
}

function parsePptSlideFromXml(xmlText: string): PresentationSlidePreview | null {
  if (typeof DOMParser === "undefined") return null;

  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  if (xml.getElementsByTagName("parsererror").length) return null;

  const paragraphs = Array.from(xml.getElementsByTagName("*"))
    .filter((node) => node.localName === "p")
    .map((paragraph) => extractPresentationParagraphText(paragraph))
    .filter(Boolean);

  if (!paragraphs.length) return null;
  return buildPresentationSlideFromParagraphs(paragraphs);
}

function parsePptxSlidesFromArchive(buffer: ArrayBuffer) {
  try {
    const archive = unzipSync(new Uint8Array(buffer));
    const slideEntries = Object.keys(archive)
      .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
      .sort((a, b) => {
        const aIndex = Number.parseInt(a.match(/slide(\d+)\.xml/i)?.[1] ?? "0", 10);
        const bIndex = Number.parseInt(b.match(/slide(\d+)\.xml/i)?.[1] ?? "0", 10);
        return aIndex - bIndex;
      });

    return slideEntries
      .map((entry) => {
        const xmlText = new TextDecoder("utf-8").decode(archive[entry]);
        return parsePptSlideFromXml(xmlText);
      })
      .filter((slide): slide is PresentationSlidePreview => !!slide);
  } catch {
    return [] as PresentationSlidePreview[];
  }
}

function parseOpenPresentationSlidesFromXml(xmlText: string) {
  if (typeof DOMParser === "undefined") return [] as PresentationSlidePreview[];

  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  if (xml.getElementsByTagName("parsererror").length) return [] as PresentationSlidePreview[];

  return Array.from(xml.getElementsByTagName("*"))
    .filter((node) => node.localName === "page")
    .map((page) => {
      const paragraphs = Array.from(page.getElementsByTagName("*"))
        .filter((node) => node.localName === "p" || node.localName === "h")
        .map((node) => normalizeDocumentParagraphText(node.textContent))
        .filter(Boolean);

      return paragraphs.length ? buildPresentationSlideFromParagraphs(paragraphs) : null;
    })
    .filter((slide): slide is PresentationSlidePreview => !!slide);
}

function parseOdpSlidesFromArchive(buffer: ArrayBuffer) {
  try {
    const archive = unzipSync(new Uint8Array(buffer));
    const contentXml = archive["content.xml"];
    if (!contentXml) return [] as PresentationSlidePreview[];
    const xmlText = new TextDecoder("utf-8").decode(contentXml);
    return parseOpenPresentationSlidesFromXml(xmlText);
  } catch {
    return [] as PresentationSlidePreview[];
  }
}

function parseRtfPreviewParagraphs(text: string) {
  const decodedHex = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );
  const normalized = decodedHex
    .replace(/\\par[d]?/gi, "\n")
    .replace(/\\line/gi, "\n")
    .replace(/\\tab/gi, "    ")
    .replace(/\\u-?\d+\??/g, " ")
    .replace(/\\[a-z]+\d* ?/gi, " ")
    .replace(/[{}]/g, " ")
    .replace(/\\\\/g, "\\");

  return normalized
    .split(/\r\n|\n|\r/g)
    .map((line) => normalizeDocumentParagraphText(line))
    .filter(Boolean)
    .slice(0, TEXT_DOCUMENT_PREVIEW_MAX_PARAGRAPHS);
}

function parsePlainTextPreviewParagraphs(text: string) {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r\n|\n|\r/g)
    .map((line) => normalizeDocumentParagraphText(line))
    .filter(Boolean)
    .slice(0, TEXT_DOCUMENT_PREVIEW_MAX_PARAGRAPHS);
}

function parseDocxPreviewFromArchive(buffer: ArrayBuffer) {
  try {
    const archive = unzipSync(new Uint8Array(buffer));
    const documentXml = archive["word/document.xml"];
    if (!documentXml) return [] as string[];
    const xmlText = new TextDecoder("utf-8").decode(documentXml);
    return parseDocxPreviewParagraphsFromXml(xmlText);
  } catch {
    return [] as string[];
  }
}

function parseOdtPreviewFromArchive(buffer: ArrayBuffer) {
  try {
    const archive = unzipSync(new Uint8Array(buffer));
    const contentXml = archive["content.xml"];
    if (!contentXml) return [] as string[];
    const xmlText = new TextDecoder("utf-8").decode(contentXml);
    return extractOpenTextParagraphsFromXml(xmlText);
  } catch {
    return [] as string[];
  }
}

async function loadTextDocumentPreview(
  rawUrl?: string | null,
  attachmentName?: string | null,
  attachmentMime?: string | null
) {
  const absolute = toAbsoluteUrl(rawUrl);
  if (!absolute) return buildTextDocumentFallbackPreview(attachmentName);
  const cached = textDocumentPreviewCache.get(absolute);
  if (cached) return cached;

  const pending = textDocumentPreviewPending.get(absolute);
  if (pending) return pending;

  const promise = (async () => {
    const lowerMime = String(attachmentMime ?? "").toLowerCase();
    const lowerName = normalizeAttachmentDisplayName(attachmentName).toLowerCase();
    const lowerUrl = absolute.toLowerCase();
    const isPlainText = lowerMime.includes("text/plain") || lowerName.endsWith(".txt") || lowerUrl.includes(".txt");
    const isRtf =
      lowerMime.includes("rtf") || lowerName.endsWith(".rtf") || lowerUrl.includes(".rtf");
    const isFlatOdt =
      lowerMime.includes("text-flat-xml") || lowerName.endsWith(".fodt") || lowerUrl.includes(".fodt");
    const isOdt =
      lowerMime.includes("vnd.oasis.opendocument.text") || lowerName.endsWith(".odt") || lowerUrl.includes(".odt");
    const isDocxFamily =
      lowerMime.includes("wordprocessingml") ||
      lowerMime.includes("ms-word.document.macroenabled.12") ||
      lowerName.endsWith(".docx") ||
      lowerName.endsWith(".docm") ||
      lowerName.endsWith(".dotx") ||
      lowerName.endsWith(".dotm") ||
      lowerUrl.includes(".docx") ||
      lowerUrl.includes(".docm") ||
      lowerUrl.includes(".dotx") ||
      lowerUrl.includes(".dotm");
    const isLegacyDoc =
      lowerMime.includes("application/msword") || lowerName.endsWith(".doc") || lowerUrl.includes(".doc");

    try {
      const response = await fetch(absolute, { credentials: "include" });
      if (!response.ok) {
        return buildTextDocumentFallbackPreview(attachmentName);
      }

      if (isPlainText) {
        const text = await response.text();
        return buildTextDocumentPreviewFromParagraphs(parsePlainTextPreviewParagraphs(text), attachmentName);
      }

      if (isRtf) {
        const text = await response.text();
        return buildTextDocumentPreviewFromParagraphs(parseRtfPreviewParagraphs(text), attachmentName);
      }

      if (isFlatOdt) {
        const xmlText = await response.text();
        return buildTextDocumentPreviewFromParagraphs(extractOpenTextParagraphsFromXml(xmlText), attachmentName);
      }

      if (isOdt) {
        const buffer = await response.arrayBuffer();
        return buildTextDocumentPreviewFromParagraphs(parseOdtPreviewFromArchive(buffer), attachmentName);
      }

      if (isDocxFamily) {
        const buffer = await response.arrayBuffer();
        return buildTextDocumentPreviewFromParagraphs(parseDocxPreviewFromArchive(buffer), attachmentName);
      }

      if (isLegacyDoc) {
        return buildTextDocumentFallbackPreview(attachmentName, "Previa parcial para DOC indisponivel");
      }

      return buildTextDocumentFallbackPreview(attachmentName);
    } catch {
      return buildTextDocumentFallbackPreview(attachmentName);
    }
  })();

  textDocumentPreviewPending.set(absolute, promise);

  try {
    const resolved = await promise;
    textDocumentPreviewCache.set(absolute, resolved);
    return resolved;
  } finally {
    textDocumentPreviewPending.delete(absolute);
  }
}

async function loadPresentationPreview(
  rawUrl?: string | null,
  attachmentName?: string | null,
  attachmentMime?: string | null
) {
  const absolute = toAbsoluteUrl(rawUrl);
  if (!absolute) return buildPresentationFallbackPreview(attachmentName);
  const cached = presentationPreviewCache.get(absolute);
  if (cached) return cached;

  const pending = presentationPreviewPending.get(absolute);
  if (pending) return pending;

  const promise = (async () => {
    const lowerMime = String(attachmentMime ?? "").toLowerCase();
    const lowerName = normalizeAttachmentDisplayName(attachmentName).toLowerCase();
    const lowerUrl = absolute.toLowerCase();
    const isFlatOdp =
      lowerMime.includes("presentation-flat-xml") || lowerName.endsWith(".fodp") || lowerUrl.includes(".fodp");
    const isOdp =
      lowerMime.includes("vnd.oasis.opendocument.presentation") ||
      lowerName.endsWith(".odp") ||
      lowerUrl.includes(".odp");
    const isPptxFamily =
      lowerMime.includes("presentationml") ||
      lowerMime.includes("ms-powerpoint.presentation.macroenabled.12") ||
      lowerMime.includes("ms-powerpoint.slideshow.macroenabled.12") ||
      lowerName.endsWith(".pptx") ||
      lowerName.endsWith(".pptm") ||
      lowerName.endsWith(".ppsx") ||
      lowerName.endsWith(".ppsm") ||
      lowerName.endsWith(".potx") ||
      lowerName.endsWith(".potm") ||
      lowerUrl.includes(".pptx") ||
      lowerUrl.includes(".pptm") ||
      lowerUrl.includes(".ppsx") ||
      lowerUrl.includes(".ppsm") ||
      lowerUrl.includes(".potx") ||
      lowerUrl.includes(".potm");
    const isLegacyPpt =
      lowerMime.includes("vnd.ms-powerpoint") || lowerName.endsWith(".ppt") || lowerUrl.includes(".ppt");

    try {
      const response = await fetch(absolute, { credentials: "include" });
      if (!response.ok) {
        return buildPresentationFallbackPreview(attachmentName);
      }

      if (isFlatOdp) {
        const xmlText = await response.text();
        return buildPresentationPreviewFromSlides(parseOpenPresentationSlidesFromXml(xmlText), attachmentName);
      }

      if (isOdp) {
        const buffer = await response.arrayBuffer();
        return buildPresentationPreviewFromSlides(parseOdpSlidesFromArchive(buffer), attachmentName);
      }

      if (isPptxFamily) {
        const buffer = await response.arrayBuffer();
        return buildPresentationPreviewFromSlides(parsePptxSlidesFromArchive(buffer), attachmentName);
      }

      if (isLegacyPpt) {
        return buildPresentationFallbackPreview(attachmentName, "Previa parcial para PPT indisponivel");
      }

      return buildPresentationFallbackPreview(attachmentName);
    } catch {
      return buildPresentationFallbackPreview(attachmentName);
    }
  })();

  presentationPreviewPending.set(absolute, promise);

  try {
    const resolved = await promise;
    presentationPreviewCache.set(absolute, resolved);
    return resolved;
  } finally {
    presentationPreviewPending.delete(absolute);
  }
}

function SpreadsheetPreview({
  attachmentUrl,
  attachmentName,
  attachmentMime,
}: {
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
}) {
  const fallbackPreview = useMemo(
    () => buildSpreadsheetFallbackPreview(attachmentName, ""),
    [attachmentName]
  );
  const [preview, setPreview] = useState<SpreadsheetPreviewData>(fallbackPreview);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const nextFallback = buildSpreadsheetFallbackPreview(attachmentName, "");
    setPreview(nextFallback);
    setLoading(true);

    void loadSpreadsheetPreview(attachmentUrl, attachmentName, attachmentMime).then((data) => {
      if (cancelled) return;
      setPreview(data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [attachmentMime, attachmentName, attachmentUrl]);

  return (
    <div
      className={`chat-sheetPreview ${loading ? "is-loading" : ""} ${preview.fallback ? "is-fallback" : ""}`}
    >
      <div
        className="chat-sheetPreview__table"
        style={{ gridTemplateColumns: `34px repeat(${preview.columnCount}, minmax(0, 1fr))` }}
      >
        <div className="chat-sheetPreview__corner" aria-hidden="true" />
        {Array.from({ length: preview.columnCount }, (_, index) => (
          <div key={`sheet-col-${preview.label}-${index}`} className="chat-sheetPreview__colHeader">
            {spreadsheetColumnLabel(index)}
          </div>
        ))}
        {preview.rows.map((row, rowIndex) => (
          <Fragment key={`sheet-row-${preview.label}-${rowIndex}`}>
            <div className="chat-sheetPreview__rowHeader">{rowIndex + 1}</div>
            {Array.from({ length: preview.columnCount }, (_, colIndex) => {
              const cellValue = row[colIndex] ?? "";
              return (
                <div
                  key={`sheet-cell-${preview.label}-${rowIndex}-${colIndex}`}
                  className={`chat-sheetPreview__cell ${
                    rowIndex === 0 ? "chat-sheetPreview__cell--headerRow" : ""
                  } ${!cellValue ? "is-empty" : ""} ${
                    preview.fallback && rowIndex === 0 && colIndex === 0 ? "chat-sheetPreview__cell--note" : ""
                  }`}
                >
                  {cellValue}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function TextDocumentPreview({
  attachmentUrl,
  attachmentName,
  attachmentMime,
}: {
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
}) {
  const fallbackPreview = useMemo(
    () => buildTextDocumentFallbackPreview(attachmentName, ""),
    [attachmentName]
  );
  const [preview, setPreview] = useState<TextDocumentPreviewData>(fallbackPreview);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const nextFallback = buildTextDocumentFallbackPreview(attachmentName, "");
    setPreview(nextFallback);
    setLoading(true);

    void loadTextDocumentPreview(attachmentUrl, attachmentName, attachmentMime).then((data) => {
      if (cancelled) return;
      setPreview(data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [attachmentMime, attachmentName, attachmentUrl]);

  return (
    <div
      className={`chat-textDocPreview ${loading ? "is-loading" : ""} ${preview.fallback ? "is-fallback" : ""}`}
    >
      <div className="chat-textDocPreview__page">
        <div className="chat-textDocPreview__body">
          {preview.paragraphs.map((paragraph, index) => (
            <div
              key={`text-doc-${preview.label}-${index}`}
              className={`chat-textDocPreview__line ${index === 0 ? "chat-textDocPreview__line--lead" : ""}`}
            >
              {paragraph}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PresentationPreview({
  attachmentUrl,
  attachmentName,
  attachmentMime,
}: {
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
}) {
  const fallbackPreview = useMemo(
    () => buildPresentationFallbackPreview(attachmentName, ""),
    [attachmentName]
  );
  const [preview, setPreview] = useState<PresentationPreviewData>(fallbackPreview);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const nextFallback = buildPresentationFallbackPreview(attachmentName, "");
    setPreview(nextFallback);
    setLoading(true);

    void loadPresentationPreview(attachmentUrl, attachmentName, attachmentMime).then((data) => {
      if (cancelled) return;
      setPreview(data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [attachmentMime, attachmentName, attachmentUrl]);

  return (
    <div
      className={`chat-presentationPreview ${loading ? "is-loading" : ""} ${preview.fallback ? "is-fallback" : ""}`}
    >
      <div className="chat-presentationPreview__slide">
        <div className="chat-presentationPreview__accent" aria-hidden="true" />
        <div className="chat-presentationPreview__title">{preview.title}</div>
        <div className="chat-presentationPreview__body">
          {preview.bullets.map((bullet, index) => (
            <div key={`presentation-${preview.label}-${index}`} className="chat-presentationPreview__bullet">
              {bullet}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function fmtTime(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatAudioClock(seconds?: number | null) {
  const safe = Math.max(0, Number(seconds ?? 0));
  if (!Number.isFinite(safe)) return "0:00";
  const rounded = Math.floor(safe);
  const minutes = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function normalizeAudioPlaybackRate(value?: number | string | null) {
  const numeric = Number(value ?? 1);
  return AUDIO_PLAYBACK_RATES.find((rate) => Math.abs(rate - numeric) < 0.001) ?? 1;
}

function formatAudioPlaybackRate(rate: (typeof AUDIO_PLAYBACK_RATES)[number]) {
  return `${rate.toFixed(1)}x`;
}

function readStoredAudioPlaybackRate() {
  if (typeof window === "undefined") return 1 as (typeof AUDIO_PLAYBACK_RATES)[number];
  try {
    return normalizeAudioPlaybackRate(window.localStorage.getItem(AUDIO_PLAYBACK_RATE_STORAGE_KEY));
  } catch {
    return 1 as (typeof AUDIO_PLAYBACK_RATES)[number];
  }
}

function persistAudioPlaybackRate(rate: (typeof AUDIO_PLAYBACK_RATES)[number]) {
  const normalized = normalizeAudioPlaybackRate(rate);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(AUDIO_PLAYBACK_RATE_STORAGE_KEY, String(normalized));
    } catch {}
    window.dispatchEvent(
      new CustomEvent(AUDIO_PLAYBACK_RATE_EVENT, {
        detail: normalized,
      })
    );
  }
  return normalized;
}

function rememberOptimisticAudioMessageId(messageId?: string | null) {
  const normalized = String(messageId ?? "").trim();
  if (!normalized) return;
  optimisticAudioMessageIds.add(normalized);
  if (optimisticAudioMessageIds.size <= 200) return;
  const oldest = optimisticAudioMessageIds.values().next().value;
  if (oldest) optimisticAudioMessageIds.delete(oldest);
}

function AudioMessagePlayer({
  attachmentUrl,
  attachmentName,
  createdAt,
  showMeta = true,
}: {
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  createdAt?: string | null;
  showMeta?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<(typeof AUDIO_PLAYBACK_RATES)[number]>(() =>
    readStoredAudioPlaybackRate()
  );
  const [hasStartedPlayback, setHasStartedPlayback] = useState(playbackRate !== 1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncState = () => {
      setCurrentTime(audio.currentTime || 0);
      setDuration(audio.duration || 0);
      if ((audio.currentTime || 0) > 0) setHasStartedPlayback(true);
    };
    const handlePlay = () => {
      setIsPlaying(true);
      setHasStartedPlayback(true);
    };
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration || 0);
    };

    audio.addEventListener("loadedmetadata", syncState);
    audio.addEventListener("durationchange", syncState);
    audio.addEventListener("timeupdate", syncState);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    syncState();

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", syncState);
      audio.removeEventListener("durationchange", syncState);
      audio.removeEventListener("timeupdate", syncState);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [attachmentUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncStoredRate = (event?: Event) => {
      const nextRate =
        event && "detail" in event
          ? normalizeAudioPlaybackRate((event as CustomEvent<number>).detail)
          : readStoredAudioPlaybackRate();
      setPlaybackRate(nextRate);
    };

    window.addEventListener(AUDIO_PLAYBACK_RATE_EVENT, syncStoredRate as EventListener);
    window.addEventListener("storage", syncStoredRate);
    return () => {
      window.removeEventListener(AUDIO_PLAYBACK_RATE_EVENT, syncStoredRate as EventListener);
      window.removeEventListener("storage", syncStoredRate);
    };
  }, []);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const displayName = normalizeAttachmentDisplayName(attachmentName) || "Áudio";
  const displayedTime =
    currentTime > 0 && (!duration || currentTime < duration) ? currentTime : duration || currentTime;
  const showRateTag = hasStartedPlayback || playbackRate !== 1;
  const thumbLeft =
    progress <= 0 ? "0px" : progress >= 100 ? "calc(100% - 14px)" : `calc(${progress}% - 7px)`;

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      setHasStartedPlayback(true);
      try {
        await audio.play();
      } catch {}
      return;
    }

    audio.pause();
  }

  function seekAudio(event: ReactMouseEvent<HTMLButtonElement>) {
    const audio = audioRef.current;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!audio || !rect.width || !duration) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  }

  function cyclePlaybackRate() {
    setPlaybackRate((current) => {
      const currentIndex = AUDIO_PLAYBACK_RATES.indexOf(current);
      const nextRate = AUDIO_PLAYBACK_RATES[(currentIndex + 1) % AUDIO_PLAYBACK_RATES.length] ?? 1;
      if (audioRef.current) audioRef.current.playbackRate = nextRate;
      return persistAudioPlaybackRate(nextRate);
    });
  }

  return (
    <div className="chat-audioCard" title={displayName}>
      <audio ref={audioRef} src={toAbsoluteUrl(attachmentUrl) ?? ""} preload="metadata" />
      {showRateTag ? (
        <button
          type="button"
          className="chat-audioCard__rate"
          onClick={cyclePlaybackRate}
          aria-label={`Velocidade atual ${formatAudioPlaybackRate(playbackRate)}`}
          title="Alterar velocidade"
        >
          {formatAudioPlaybackRate(playbackRate)}
        </button>
      ) : (
        <span className="chat-audioCard__marker" aria-hidden="true">
          <HeadphonesIcon />
        </span>
      )}

      <button
        type="button"
        className="chat-audioCard__play"
        onClick={() => void togglePlayback()}
        aria-label={isPlaying ? "Pausar áudio" : "Reproduzir áudio"}
        title={isPlaying ? "Pausar áudio" : "Reproduzir áudio"}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div className="chat-audioCard__main">
        <button
          type="button"
          className="chat-audioCard__track"
          onClick={seekAudio}
          title="Ir para este ponto"
          aria-label="Linha do tempo do áudio"
        >
          <span className="chat-audioCard__trackBase" aria-hidden="true" />
          <span className="chat-audioCard__trackFill" style={{ width: `${progress}%` }} aria-hidden="true" />
          <span className="chat-audioCard__trackThumb" style={{ left: thumbLeft }} aria-hidden="true" />
        </button>

        <div className="chat-audioCard__footer">
          <span className="chat-audioCard__duration">{formatAudioClock(displayedTime)}</span>
        </div>
      </div>

      {showMeta && createdAt ? (
        <div className="chat-audioCard__meta">
          <span>{fmtTime(createdAt)}</span>
        </div>
      ) : null}
    </div>
  );
}

function mediaLabel(message: Partial<Message>) {
  if (isAudioMessageAttachment(message)) return "Áudio";
  if (isVideoAttachment(message)) return "Vídeo";
  if (isImageAttachment(message)) return "Imagem";
  if (message.contentType === "FILE") return normalizeAttachmentDisplayName(message.attachmentName) || "Arquivo";
  return "Mensagem";
}

function AttachmentKindIcon({ message }: { message: Partial<Message> }) {
  if (isAudioMessageAttachment(message) || isAudioDocumentAttachment(message)) return <HeadphonesIcon />;
  return <FileIcon />;
}

function attachmentTypeLabel(message: Partial<Message>) {
  const name = normalizeAttachmentDisplayName(message.attachmentName);
  const ext = name.includes(".") ? name.split(".").pop()?.trim().toUpperCase() ?? "" : "";
  if (ext && ext.length <= 6) return ext;

  const mime = String(message.attachmentMime ?? "").toLowerCase().trim();
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return mime.slice("image/".length).toUpperCase();
  if (mime.startsWith("video/")) return mime.slice("video/".length).toUpperCase();
  if (mime.startsWith("audio/")) return mime.slice("audio/".length).toUpperCase();

  return "ARQ";
}

function attachmentDownloadName(message: Partial<Message>) {
  const normalized = normalizeAttachmentDisplayName(message.attachmentName);
  if (normalized) return normalized;
  if (isAudioMessageAttachment(message) || isAudioDocumentAttachment(message)) return "audio";
  if (isVideoAttachment(message)) return "video";
  if (isImageAttachment(message)) return "imagem";
  return "arquivo";
}

const REMOVED_ATTACHMENT_NOTICE_GENERIC =
  "Esta imagem ou documento foi apagado pelo administrador segundo a política de backup de arquivos.";
const REMOVED_ATTACHMENT_NOTICE_IMAGE =
  "Essa imagem foi apagada pelo administrador segundo a política de backup de arquivos.";
const REMOVED_ATTACHMENT_NOTICE_FILE =
  "Esse documento foi apagado pelo administrador segundo a política de backup de arquivos.";

function stripAttachmentRemovalNotice(value?: string | null) {
  let text = String(value ?? "");
  text = text.replace(REMOVED_ATTACHMENT_NOTICE_IMAGE, "");
  text = text.replace(REMOVED_ATTACHMENT_NOTICE_FILE, "");
  text = text.replace(REMOVED_ATTACHMENT_NOTICE_GENERIC, "");
  return text.trim();
}

function toAbsoluteUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (/^(https?:)?\/\//i.test(url)) {
    try {
      const resolved = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
      const isLoopbackHost = /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|::1|\[::1\])$/i.test(
        resolved.hostname
      );
      if (!isLoopbackHost) return resolved.toString();

      const apiResolved = new URL(
        API_BASE,
        typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
      );
      return `${apiResolved.origin}${resolved.pathname}${resolved.search}${resolved.hash}`;
    } catch {
      return url;
    }
  }
  return url.startsWith("/") ? `${API_BASE}${url}` : `${API_BASE}/${url}`;
}

function conversationRankTimestamp(conv: ConversationListItem) {
  const raw = conv.lastMessage?.createdAt ?? conv.updatedAt ?? conv.createdAt;
  if (!raw) return 0;
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function sortConversationItems(items: ConversationListItem[]) {
  return [...items].sort((a, b) => {
    const pinDiff = Number(!!b.pinned) - Number(!!a.pinned);
    if (pinDiff !== 0) return pinDiff;
    return conversationRankTimestamp(b) - conversationRankTimestamp(a);
  });
}

function escapeRegExp(v: string) {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aggregateReactions(raw?: ReactionRaw[], myId?: string | null): ReactionItem[] {
  if (!raw?.length) return [];
  const map = new Map<string, ReactionItem>();

  for (const item of raw) {
    const current = map.get(item.emoji);
    if (current) {
      current.count += 1;
      if (item.userId === myId) current.reactedByMe = true;
    } else {
      map.set(item.emoji, {
        emoji: item.emoji,
        count: 1,
        reactedByMe: item.userId === myId,
      });
    }
  }

  return Array.from(map.values());
}

function replyPreviewText(msg?: ReplyToMessage | null) {
  if (!msg) return "Mensagem";
  if (msg.body?.trim()) return msg.body.trim();
  if (isAudioMessageAttachment(msg)) return "Áudio";
  if (isMediaAttachment(msg)) return isVideoAttachment(msg) ? "Vídeo" : "Imagem";
  if (msg.contentType === "FILE") return normalizeAttachmentDisplayName(msg.attachmentName) || "Arquivo";
  return "Mensagem";
}

function messagePreviewText(msg: Partial<Message>) {
  const body = (msg.body ?? "").trim();
  if (body) return body;
  if (isAudioMessageAttachment(msg)) return "Áudio";
  if (isMediaAttachment(msg)) return isVideoAttachment(msg) ? "Vídeo" : "Imagem";
  const attachmentName = normalizeAttachmentDisplayName(msg.attachmentName);
  if (msg.contentType === "FILE") return attachmentName ? `Arquivo: ${attachmentName}` : "Arquivo";
  return "";
}

function messageSearchableText(msg: Partial<Message>) {
  return [
    msg.body ?? "",
    normalizeAttachmentDisplayName(msg.attachmentName),
    isAudioMessageAttachment(msg) ? "audio áudio" : "",
    isVideoAttachment(msg) ? "video" : isImageAttachment(msg) ? "imagem" : "",
  ]
    .join(" ")
    .trim();
}

function messageNotificationPreview(msg: Message) {
  const body = msg.body?.trim();
  if (body) return body.length > 120 ? `${body.slice(0, 117)}...` : body;
  if (isAudioMessageAttachment(msg)) return "Áudio";
  if (isMediaAttachment(msg)) return isVideoAttachment(msg) ? "Vídeo" : "Imagem";
  const attachmentName = normalizeAttachmentDisplayName(msg.attachmentName);
  if (msg.contentType === "FILE") return attachmentName ? `Arquivo: ${attachmentName}` : "Arquivo";
  return "Nova mensagem";
}

function HighlightText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const q = query.trim();
  if (!q) return <>{text}</>;

  const safe = escapeRegExp(q);
  const re = new RegExp(`(${safe})`, "gi");
  const parts = text.split(re);

  return (
    <>
      {parts.map((part, idx) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={`${part}-${idx}`} className="chat-hl">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${idx}`}>{part}</span>
        )
      )}
    </>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function SmileIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M8 14c1 1.4 2.3 2 4 2s3-.6 4-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}

function HeadphonesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M4.5 12a7.5 7.5 0 0 1 15 0"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M5.5 12.3h2.1c.5 0 .9.4.9.9v4.1c0 .5-.4.9-.9.9H6.3a1.8 1.8 0 0 1-1.8-1.8v-2.3c0-1 .8-1.8 1.8-1.8Z"
        fill="currentColor"
      />
      <path
        d="M16.4 12.3h2.1c1 0 1.8.8 1.8 1.8v2.3a1.8 1.8 0 0 1-1.8 1.8h-1.3c-.5 0-.9-.4-.9-.9v-4.1c0-.5.4-.9.9-.9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M8.2 6.7a1 1 0 0 1 1.53-.84l8.18 5.3a1 1 0 0 1 0 1.68l-8.18 5.3A1 1 0 0 1 8.2 17.3V6.7Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <rect x="7" y="6" width="3.5" height="12" rx="1.2" />
      <rect x="13.5" y="6" width="3.5" height="12" rx="1.2" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <path d="M21 16l-5-5-6 6-2-2-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M8 3h6l5 5v13H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" />
      <path d="M14 3v6h6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export {
  normalizeAttachmentDisplayName,
  isPdfAttachment,
  isSpreadsheetAttachment,
  isTextDocumentAttachment,
  isPresentationAttachment,
  isImageAttachment,
  isVideoAttachment,
  isMediaAttachment,
  isAudioMessageAttachment,
  isAudioDocumentAttachment,
  isImageDocumentPreview,
  isVideoDocumentPreview,
  buildPdfPreviewUrl,
  attachmentDownloadName,
  attachmentTypeLabel,
  replyPreviewText,
  messagePreviewText,
  stripAttachmentRemovalNotice,
  toAbsoluteUrl,
  SpreadsheetPreview,
  TextDocumentPreview,
  PresentationPreview,
  AudioMessagePlayer,
  AttachmentKindIcon,
  HeadphonesIcon,
  PlayIcon,
  PauseIcon,
  FileIcon,
};
