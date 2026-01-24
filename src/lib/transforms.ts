import CryptoJS from 'crypto-js';
import dayjs from 'dayjs';

export interface TransformResult {
  success: boolean;
  result: string;
  error?: string;
}

export const transforms = {
  base64Decode: (input: string): TransformResult => {
    try {
      const result = atob(input.trim());
      return { success: true, result };
    } catch {
      return { success: false, result: '', error: '无效的 Base64 字符串' };
    }
  },

  base64Encode: (input: string): TransformResult => {
    try {
      const result = btoa(unescape(encodeURIComponent(input)));
      return { success: true, result };
    } catch {
      return { success: false, result: '', error: '编码失败，请检查输入' };
    }
  },

  urlDecode: (input: string): TransformResult => {
    try {
      const result = decodeURIComponent(input);
      return { success: true, result };
    } catch {
      return { success: false, result: '', error: '无效的 URL 编码' };
    }
  },

  urlEncode: (input: string): TransformResult => {
    try {
      const result = encodeURIComponent(input);
      return { success: true, result };
    } catch {
      return { success: false, result: '', error: '编码失败' };
    }
  },

  md5: (input: string): TransformResult => {
    const result = CryptoJS.MD5(input).toString();
    return { success: true, result };
  },

  sha256: (input: string): TransformResult => {
    const result = CryptoJS.SHA256(input).toString();
    return { success: true, result };
  },

  timestampToDate: (input: string): TransformResult => {
    try {
      const ts = parseInt(input.trim());
      if (isNaN(ts)) throw new Error('Not a number');
      const multiplier = input.length > 11 ? 1 : 1000;
      const d = dayjs(ts * multiplier);
      if (!d.isValid()) throw new Error('Invalid date');
      const result = d.format('YYYY-MM-DD HH:mm:ss');
      return { success: true, result };
    } catch {
      return { success: false, result: '', error: '无效的时间戳' };
    }
  },

  dateToTimestamp: (input: string): TransformResult => {
    try {
      const d = dayjs(input.trim());
      if (!d.isValid()) throw new Error('Invalid date');
      const result = Math.floor(d.valueOf() / 1000).toString();
      return { success: true, result };
    } catch {
      return { success: false, result: '', error: '无效的日期格式' };
    }
  },

  jsonFormat: (input: string): TransformResult => {
    try {
      const parsed = JSON.parse(input);
      const result = JSON.stringify(parsed, null, 2);
      return { success: true, result };
    } catch {
      return { success: false, result: '', error: '无效的 JSON 格式' };
    }
  },

  jsonMinify: (input: string): TransformResult => {
    try {
      const parsed = JSON.parse(input);
      const result = JSON.stringify(parsed);
      return { success: true, result };
    } catch {
      return { success: false, result: '', error: '无效的 JSON 格式' };
    }
  },

  toCamelCase: (input: string): TransformResult => {
    const result = input
      .replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase())
      .replace(/^(.)/, c => c.toLowerCase());
    return { success: true, result };
  },

  toSnakeCase: (input: string): TransformResult => {
    const result = input
      .replace(/([A-Z])/g, '_$1')
      .replace(/[-\s]+/g, '_')
      .replace(/^_/, '')
      .toLowerCase();
    return { success: true, result };
  },

  toKebabCase: (input: string): TransformResult => {
    const result = input
      .replace(/([A-Z])/g, '-$1')
      .replace(/[_\s]+/g, '-')
      .replace(/^-/, '')
      .toLowerCase();
    return { success: true, result };
  },

  toPascalCase: (input: string): TransformResult => {
    const result = input
      .replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase())
      .replace(/^(.)/, c => c.toUpperCase());
    return { success: true, result };
  },

  toUpperCase: (input: string): TransformResult => {
    return { success: true, result: input.toUpperCase() };
  },

  toLowerCase: (input: string): TransformResult => {
    return { success: true, result: input.toLowerCase() };
  },

  unicodeEncode: (input: string): TransformResult => {
    const result = input
      .split('')
      .map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
      .join('');
    return { success: true, result };
  },

  unicodeDecode: (input: string): TransformResult => {
    try {
      const result = input.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      );
      return { success: true, result };
    } catch {
      return { success: false, result: '', error: '无效的 Unicode 编码' };
    }
  },

  hexEncode: (input: string): TransformResult => {
    const result = input
      .split('')
      .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(' ');
    return { success: true, result };
  },

  hexDecode: (input: string): TransformResult => {
    try {
      const hex = input.replace(/\s+/g, '');
      let result = '';
      for (let i = 0; i < hex.length; i += 2) {
        result += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
      }
      return { success: true, result };
    } catch {
      return { success: false, result: '', error: '无效的 Hex 编码' };
    }
  },
};

export type TransformId = 
  | 'base64-decode' | 'base64-encode'
  | 'url-decode' | 'url-encode'
  | 'json-format' | 'json-minify'
  | 'md5' | 'sha256'
  | 'timestamp-to-date' | 'date-to-timestamp'
  | 'camel-case' | 'snake-case' | 'kebab-case' | 'pascal-case'
  | 'uppercase' | 'lowercase'
  | 'unicode-encode' | 'unicode-decode'
  | 'hex-encode' | 'hex-decode';

export interface QuickAction {
  id: TransformId;
  label: string;
  icon: string;
  fn: (input: string) => TransformResult;
  category: 'encode' | 'format' | 'hash' | 'time' | 'case';
}

export const quickActions: QuickAction[] = [
  { id: 'base64-decode', label: 'Base64 解码', icon: '🔓', fn: transforms.base64Decode, category: 'encode' },
  { id: 'base64-encode', label: 'Base64 编码', icon: '🔒', fn: transforms.base64Encode, category: 'encode' },
  { id: 'url-decode', label: 'URL 解码', icon: '🔗', fn: transforms.urlDecode, category: 'encode' },
  { id: 'url-encode', label: 'URL 编码', icon: '🔗', fn: transforms.urlEncode, category: 'encode' },
  { id: 'json-format', label: 'JSON 格式化', icon: '📋', fn: transforms.jsonFormat, category: 'format' },
  { id: 'json-minify', label: 'JSON 压缩', icon: '📦', fn: transforms.jsonMinify, category: 'format' },
  { id: 'md5', label: 'MD5', icon: '🔐', fn: transforms.md5, category: 'hash' },
  { id: 'sha256', label: 'SHA256', icon: '🔐', fn: transforms.sha256, category: 'hash' },
  { id: 'timestamp-to-date', label: '时间戳→日期', icon: '📅', fn: transforms.timestampToDate, category: 'time' },
  { id: 'date-to-timestamp', label: '日期→时间戳', icon: '⏱️', fn: transforms.dateToTimestamp, category: 'time' },
  { id: 'camel-case', label: 'camelCase', icon: '🐪', fn: transforms.toCamelCase, category: 'case' },
  { id: 'snake-case', label: 'snake_case', icon: '🐍', fn: transforms.toSnakeCase, category: 'case' },
  { id: 'kebab-case', label: 'kebab-case', icon: '🍢', fn: transforms.toKebabCase, category: 'case' },
  { id: 'pascal-case', label: 'PascalCase', icon: '🏔️', fn: transforms.toPascalCase, category: 'case' },
];

export const primaryActions = quickActions.slice(0, 8);
