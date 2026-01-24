export type InputType = 
  | 'base64' 
  | 'json' 
  | 'url-encoded' 
  | 'timestamp' 
  | 'variable-name'
  | 'date-string'
  | 'hex'
  | 'unicode'
  | 'text';

export interface DetectionResult {
  types: InputType[];
  confidence: Record<InputType, number>;
}

export function detectInputType(input: string): DetectionResult {
  const types: InputType[] = [];
  const confidence: Record<string, number> = {};
  const trimmed = input.trim();
  
  if (!trimmed) {
    return { types: ['text'], confidence: { text: 1 } };
  }

  if (/^[A-Za-z0-9+/]+=*$/.test(trimmed) && trimmed.length >= 4) {
    try {
      const decoded = atob(trimmed);
      if (decoded.length > 0 && !/[\x00-\x08\x0E-\x1F]/.test(decoded)) {
        types.push('base64');
        confidence['base64'] = trimmed.length % 4 === 0 ? 0.9 : 0.6;
      }
    } catch {}
  }

  if (/^[\[{]/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      types.push('json');
      confidence['json'] = 0.95;
    } catch {}
  }

  if (/%[0-9A-Fa-f]{2}/.test(trimmed)) {
    types.push('url-encoded');
    confidence['url-encoded'] = 0.85;
  }

  if (/^\d{10}$/.test(trimmed)) {
    const ts = parseInt(trimmed);
    const year = new Date(ts * 1000).getFullYear();
    if (year >= 2000 && year <= 2100) {
      types.push('timestamp');
      confidence['timestamp'] = 0.9;
    }
  } else if (/^\d{13}$/.test(trimmed)) {
    const ts = parseInt(trimmed);
    const year = new Date(ts).getFullYear();
    if (year >= 2000 && year <= 2100) {
      types.push('timestamp');
      confidence['timestamp'] = 0.9;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    types.push('date-string');
    confidence['date-string'] = 0.85;
  }

  const isVariableName = 
    /^[a-z][a-zA-Z0-9]*$/.test(trimmed) ||
    /^[a-z]+(_[a-z]+)+$/.test(trimmed) ||
    /^[a-z]+(-[a-z]+)+$/.test(trimmed) ||
    /^[A-Z][a-zA-Z0-9]*$/.test(trimmed);
  
  if (isVariableName && trimmed.length >= 2 && trimmed.length <= 50) {
    types.push('variable-name');
    confidence['variable-name'] = 0.7;
  }

  if (/^(\\u[0-9a-fA-F]{4})+$/.test(trimmed)) {
    types.push('unicode');
    confidence['unicode'] = 0.95;
  }

  if (/^([0-9a-fA-F]{2}\s*)+$/.test(trimmed)) {
    types.push('hex');
    confidence['hex'] = 0.8;
  }

  types.push('text');
  confidence['text'] = 0.5;

  return { types, confidence };
}

export function getRecommendedActions(detection: DetectionResult): string[] {
  const { types, confidence } = detection;
  const recommended: string[] = [];

  const sortedTypes = types
    .filter(t => t !== 'text')
    .sort((a, b) => (confidence[b] || 0) - (confidence[a] || 0));

  for (const type of sortedTypes) {
    switch (type) {
      case 'base64':
        recommended.push('base64-decode');
        break;
      case 'json':
        recommended.push('json-format', 'json-minify');
        break;
      case 'url-encoded':
        recommended.push('url-decode');
        break;
      case 'timestamp':
        recommended.push('timestamp-to-date');
        break;
      case 'date-string':
        recommended.push('date-to-timestamp');
        break;
      case 'variable-name':
        recommended.push('camel-case', 'snake-case', 'kebab-case');
        break;
      case 'unicode':
        recommended.push('unicode-decode');
        break;
      case 'hex':
        recommended.push('hex-decode');
        break;
    }
  }

  if (recommended.length === 0) {
    recommended.push('base64-encode', 'url-encode', 'md5');
  }

  return recommended.slice(0, 6);
}

export function getTypeLabel(type: InputType): string {
  const labels: Record<InputType, string> = {
    'base64': 'Base64',
    'json': 'JSON',
    'url-encoded': 'URL编码',
    'timestamp': '时间戳',
    'date-string': '日期',
    'variable-name': '变量名',
    'hex': 'Hex',
    'unicode': 'Unicode',
    'text': '文本',
  };
  return labels[type] || type;
}
