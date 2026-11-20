import React, { useState, useEffect } from 'react';
import { subscribeSSE } from '../api/sse.js';
import { CheckCircle2, Clock, Loader2, Radio, Sparkles, AlertTriangle } from 'lucide-react';

const STAGES = [
  { id: 'COMMITTED', label: 'Committed to PostgreSQL', desc: 'Atomic transaction & inventory update' },
  { id: 'OUTBOX_PUBLISHED', label: 'Outbox Published to Kafka', desc: 'Relay picked up event & published to broker' },
  { id: 'NOTIFIED', label: 'Customer Notified', desc: 'Consumer logged simulated email/SMS' },
  { id: 'INDEXED', label: 'OpenSearch Indexed', desc: 'Stock sync reflected in search index' },
];

/**
 * Reusable OrderTimeline component.
 * Subscribes to GET /orders/:id/events SSE endpoint.
 * Stages: COMMITTED -> OUTBOX_PUBLISHED -> NOTIFIED -> INDEXED.
 * v1.2: Renders DUPLICATE_SKIPPED as an amber informational row (never as failure).
 * Tracks per-item INDEXED detail events.
 * Used by online checkout AND POS simulator.
 */
export default function OrderTimeline({
  orderId,
  totalItems = 1,
  onStageChange,
  onComplete,
  onRawEvent,
  source = 'ONLINE',
}) {
  const [completedStages, setCompletedStages] = useState(new Set());
  const [stageTimestamps, setStageTimestamps] = useState({});
  const [currentStage, setCurrentStage] = useState('COMMITTED');
  const [indexedProductIds, setIndexedProductIds] = useState(new Set());
  const [duplicateEvents, setDuplicateEvents] = useState([]);
  const [sseStatus, setSseStatus] = useState('connecting');

  useEffect(() => {
    if (!orderId) return;

    const endpoint = `/orders/${orderId}/events`;

    const unsubscribe = subscribeSSE(endpoint, {
      onStatusChange: (status) => {
        setSseStatus(status);
      },
      onMessage: (payload, eventName) => {
        if (onRawEvent) {
          onRawEvent({ eventName, payload, receivedAt: new Date().toISOString() });
        }

        if (eventName === 'stage' || payload?.stage) {
          const { stage, at, detail } = payload;

          // v1.2: DUPLICATE_SKIPPED is informational
          if (stage === 'DUPLICATE_SKIPPED') {
            setDuplicateEvents((prev) => [
              ...prev,
              {
                at: at || new Date().toISOString(),
                detail: detail || {},
              },
            ]);
            if (onStageChange) onStageChange(stage, detail);
            return;
          }

          setStageTimestamps((prev) => ({
            ...prev,
            [stage]: at || new Date().toISOString(),
          }));

          setCompletedStages((prev) => {
            const next = new Set(prev);
            next.add(stage);
            return next;
          });

          if (stage === 'INDEXED' && detail?.productId) {
            setIndexedProductIds((prev) => new Set([...prev, detail.productId]));
          }

          setCurrentStage(stage);

          if (onStageChange) {
            onStageChange(stage, detail);
          }

          if (stage === 'INDEXED' && onComplete) {
            onComplete();
          }
        }
      },
      onError: (err) => {
        // SSE auto-reconnects
      },
    });

    return () => {
      unsubscribe();
    };
  }, [orderId, onStageChange, onComplete, onRawEvent]);

  const stageOrder = ['COMMITTED', 'OUTBOX_PUBLISHED', 'NOTIFIED', 'INDEXED'];
  const currentIndex = stageOrder.indexOf(currentStage);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 shadow-xl">
      {/* Header & Status */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white tracking-wide">
              Live Order Event Stream
            </h3>
            <p className="text-xs font-mono text-slate-400">
              Contract SSE: <span className="text-slate-300">/orders/{orderId}/events</span>
            </p>
          </div>
        </div>

        {/* SSE Connection Health Indicator */}
        <div className="flex items-center gap-2">
          {sseStatus === 'connected' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Live SSE
            </span>
          )}
          {sseStatus === 'reconnecting' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              reconnecting…
            </span>
          )}
          {sseStatus === 'connecting' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
              <Clock className="w-3.5 h-3.5" />
              connecting…
            </span>
          )}
        </div>
      </div>

      {/* Vertical Stepper Timeline */}
      <div className="relative flex flex-col gap-6 pl-2">
        {STAGES.map((s, index) => {
          const isDone = completedStages.has(s.id);
          const isActive = !isDone && index <= currentIndex + 1;
          const isPending = !isDone && !isActive;
          const timestamp = stageTimestamps[s.id];

          // Skip NOTIFIED stage visually if source is POS_STORE
          const isPosSkipped = source === 'POS_STORE' && s.id === 'NOTIFIED';

          return (
            <React.Fragment key={s.id}>
              <div className="relative flex items-start gap-4 group">
                {/* Vertical connector line */}
                {index < STAGES.length - 1 && (
                  <div
                    className={`absolute left-[19px] top-10 bottom-[-24px] w-0.5 transition-colors duration-500 ${
                      completedStages.has(STAGES[index + 1]?.id)
                        ? 'bg-emerald-500'
                        : isDone
                        ? 'bg-emerald-500/40'
                        : 'bg-slate-800'
                    }`}
                  />
                )}

                {/* Status Circle */}
                <div className="relative z-10 shrink-0">
                  {isDone ? (
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  ) : isActive ? (
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 border-2 border-indigo-400 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/30 animate-pulse">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-950 border-2 border-slate-800 text-slate-600 flex items-center justify-center">
                      <span className="font-mono text-xs font-bold">{index + 1}</span>
                    </div>
                  )}
                </div>

                {/* Content Block */}
                <div className="flex-1 pt-1 flex flex-col gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-sm font-extrabold tracking-wide uppercase ${
                          isDone
                            ? 'text-emerald-300'
                            : isActive
                            ? 'text-indigo-300'
                            : 'text-slate-500'
                        }`}
                      >
                        {s.id}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        — {s.label}
                      </span>
                    </div>

                    {timestamp && (
                      <span className="font-mono text-xs text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {new Date(timestamp).toLocaleTimeString('en-IN', {
                          hour12: false,
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400">
                    {isPosSkipped ? (
                      <span className="text-amber-400 italic">
                        Walk-in sale — no customer notification dispatched
                      </span>
                    ) : (
                      s.desc
                    )}
                  </p>

                  {/* Multi-item INDEXED counter */}
                  {s.id === 'INDEXED' && isDone && (
                    <div className="mt-1 flex items-center gap-2 text-xs font-mono text-emerald-400 font-semibold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        Search documents synchronized ({Math.max(indexedProductIds.size, 1)} / {totalItems} item(s) indexed)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* v1.2 Informational Row for DUPLICATE_SKIPPED after OUTBOX_PUBLISHED */}
              {s.id === 'OUTBOX_PUBLISHED' && duplicateEvents.length > 0 && (
                <div className="ml-14 my-1 p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs font-mono flex flex-col gap-1 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Kafka redelivered — consumer skipped safely
                    </span>
                    <span className="text-[10px] uppercase font-bold text-amber-400">
                      DUPLICATE_SKIPPED
                    </span>
                  </div>
                  {duplicateEvents.map((dup, i) => (
                    <div key={i} className="text-[11px] text-amber-200/80 truncate">
                      Event ID: <span className="font-bold">{dup.detail?.eventId || 'event-id'}</span> • Group: <span className="font-bold">{dup.detail?.consumerGroup || 'notifications'}</span>
                    </div>
                  ))}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
