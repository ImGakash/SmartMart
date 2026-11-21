import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

/**
 * JsonViewer: Collapsible monospace raw-JSON view with custom scrollbar and copy action.
 * Exposes honest un-faked payloads to judges.
 */
export default function JsonViewer({
  data,
  title = 'Raw Contract JSON',
  defaultOpen = false,
  maxHeight = 'max-h-72',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  function handleCopy() {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={`bg-slate-950 border border-slate-800 rounded-xl overflow-hidden transition-all text-xs font-mono ${className}`}
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-slate-300 hover:text-white font-bold cursor-pointer"
        >
          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <span>{title}</span>
        </button>

        <div className="flex items-center gap-2">
          {isOpen && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-[11px]"
              title="Copy JSON"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <pre
          className={`p-3.5 overflow-x-auto overflow-y-auto ${maxHeight} text-slate-300 leading-relaxed font-mono selection:bg-indigo-500/30`}
        >
          {jsonString}
        </pre>
      )}
    </div>
  );
}
