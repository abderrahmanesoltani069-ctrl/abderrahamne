import React, { useState, useEffect } from 'react';
import {
  OrderStatus,
  OrderType,
  computeTicketSla,
} from '../lib/domain-rules';
import {
  CatalogMenuItem,
  LiveOrderTicket,
} from '../lib/seed-data';

interface KdsScreenViewProps {
  orders: LiveOrderTicket[];
  catalogItems: CatalogMenuItem[];
  onToggleSubItemPrepared: (orderId: string, subItemId: string) => void;
  onAdvanceOrderStatus: (orderId: string, nextStatus: OrderStatus) => void;
  onToggleItem86Status: (menuItemId: string) => void;
  onSimulateRedisStreamRecovery: () => void;
}

export const KdsScreenView: React.FC<KdsScreenViewProps> = ({
  orders,
  catalogItems,
  onToggleSubItemPrepared,
  onAdvanceOrderStatus,
  onToggleItem86Status,
  onSimulateRedisStreamRecovery,
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [activeTab, setActiveTab] = useState<'LIVE_TICKETS' | 'QUICK_86'>('LIVE_TICKETS');
  const [lastStreamOffset, setLastStreamOffset] = useState<string>('1793984390000-0');

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeKitchenTickets = orders.filter(
    (ord) => ord.status === OrderStatus.ACCEPTED || ord.status === OrderStatus.PREPARING,
  );

  const unavailableCount = catalogItems.filter((i) => !i.isAvailable).length;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-kds-bg text-slate-100 p-4 sm:p-6 space-y-6">
      {/* KDS Top Control Bar */}
      <div className="bg-kds-surface border border-kds-border rounded-2xl p-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>غرفة البث: tenant_gourmet_branch_main_kds</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">آخر Stream ACK: {lastStreamOffset}</span>
          </div>
          <h1 className="text-xl font-bold text-white whitespace-nowrap">
            شاشة المطبخ اللحظية (Real-Time KDS)
          </h1>
        </div>

        {/* SLA Legend + Action Tabs */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2.5 bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 whitespace-nowrap">
            <span className="text-emerald-400">أخضر: &lt; 5 د</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-400">أصفر: 5-10 د</span>
            <span aria-hidden="true">·</span>
            <span className="text-rose-400">أحمر نابض: &gt; 10 د</span>
          </div>

          <button
            type="button"
            onClick={() => {
              onSimulateRedisStreamRecovery();
              setLastStreamOffset(`${Date.now()}-0`);
            }}
            className="min-h-[64px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            استرجاع الفائت (Redis XRANGE)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('LIVE_TICKETS')}
            className={`min-h-[64px] px-5 rounded-xl font-bold text-sm transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'LIVE_TICKETS'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            التذاكر الحية ({activeKitchenTickets.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('QUICK_86')}
            className={`min-h-[64px] px-5 rounded-xl font-bold text-sm transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'QUICK_86'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            إيقاف صنف نافد (86ing: {unavailableCount})
          </button>
        </div>
      </div>

      {activeTab === 'LIVE_TICKETS' ? (
        activeKitchenTickets.length === 0 ? (
          <div className="bg-kds-surface border border-kds-border rounded-2xl p-12 text-center space-y-3">
            <h2 className="text-lg font-bold text-white">لا توجد تذاكر قيد التحضير حالياً</h2>
            <p className="text-xs text-slate-400">
              جميع الطلبات تم إنجازها وتقديمها. يمكنك إرسال طلب جديد من واجهة الزبون أو استرجاع طلب عبر Redis Streams.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
            {activeKitchenTickets.map((ticket) => {
              const sla = computeTicketSla(ticket.acceptedAtMs, nowMs);

              const cardBorderClass =
                sla.level === 'CRITICAL'
                  ? 'border-2 border-red-500 animate-kds-critical'
                  : sla.level === 'WARNING'
                  ? 'border-2 border-amber-500'
                  : 'border-2 border-emerald-500';

              const headerBgClass =
                sla.level === 'CRITICAL'
                  ? 'bg-red-950/50 border-b border-red-500/40'
                  : sla.level === 'WARNING'
                  ? 'bg-amber-950/40 border-b border-amber-500/40'
                  : 'bg-emerald-950/40 border-b border-emerald-500/40';

              const timerBadgeClass =
                sla.level === 'CRITICAL'
                  ? 'bg-red-600 text-white'
                  : sla.level === 'WARNING'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-emerald-500 text-slate-950';

              return (
                <article
                  key={ticket.id}
                  className={`bg-kds-surface rounded-2xl overflow-hidden flex flex-col justify-between shadow-xl ${cardBorderClass}`}
                >
                  {/* Ticket Header */}
                  <div className={`p-4 flex items-center justify-between gap-3 ${headerBgClass}`}>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl font-extrabold text-white tabular-nums">
                          #{ticket.orderNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-200">
                          {ticket.orderType === OrderType.DINE_IN
                            ? `طاولة #${ticket.tableNumber}`
                            : ticket.orderType === OrderType.PICKUP
                            ? `استلام ذاتي (${ticket.customerName || 'عميل'})`
                            : `توصيل مباشر (${ticket.customerName || 'عميل'})`}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-300 mt-1">
                        {sla.label} · Stream ID: {ticket.streamEventId}
                      </p>
                    </div>

                    <div
                      className={`px-3.5 py-2 rounded-xl font-mono text-2xl font-bold tabular-nums ${timerBadgeClass}`}
                    >
                      {sla.formattedClock}
                    </div>
                  </div>

                  {/* Ticket Dish Lines */}
                  <div className="p-4 divide-y divide-slate-800 space-y-3">
                    {ticket.items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => onToggleSubItemPrepared(ticket.id, item.id)}
                        className={`pt-3 first:pt-0 cursor-pointer rounded-xl p-2.5 transition-colors ${
                          item.isPrepared
                            ? 'opacity-50 bg-slate-900/50'
                            : 'hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="min-w-[40px] h-10 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-base flex items-center justify-center tabular-nums">
                              {item.quantity}×
                            </span>
                            <div>
                              <h2
                                className={`text-base font-bold ${
                                  item.isPrepared ? 'line-through text-slate-400' : 'text-white'
                                }`}
                              >
                                {item.name}
                              </h2>

                              {item.modifiers.length > 0 && (
                                <ul className="mt-1.5 space-y-1">
                                  {item.modifiers.map((mod, idx) => (
                                    <li
                                      key={idx}
                                      className="text-xs font-bold text-amber-300"
                                    >
                                      • {mod}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            aria-label={`تحديد ${item.name} كمحضر`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleSubItemPrepared(ticket.id, item.id);
                            }}
                            className={`h-9 w-9 rounded-lg border flex items-center justify-center font-bold text-sm shrink-0 ${
                              item.isPrepared
                                ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                                : 'border-slate-600 text-slate-400'
                            }`}
                          >
                            ✓
                          </button>
                        </div>

                        {item.allergyOrSpecialNote && (
                          <div className="mt-2.5 bg-rose-950/70 border border-rose-500 rounded-xl p-2.5 text-rose-200 font-bold text-xs">
                            تنبيه للمطبخ: {item.allergyOrSpecialNote}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Ticket 64px Action Footer */}
                  <div className="p-4 bg-slate-950/60 border-t border-kds-border">
                    {ticket.status === OrderStatus.ACCEPTED ? (
                      <button
                        type="button"
                        onClick={() =>
                          onAdvanceOrderStatus(ticket.id, OrderStatus.PREPARING)
                        }
                        className="w-full min-h-[64px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-base flex items-center justify-center transition-colors"
                      >
                        بدء التحضير الآن (PREPARING)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAdvanceOrderStatus(ticket.id, OrderStatus.READY)}
                        className="w-full min-h-[64px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-base flex items-center justify-center transition-colors"
                      >
                        جاهز للتقديم — إشعار النادل والعميل (READY)
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : (
        /* One-Tap 86ing Panel */
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="bg-kds-surface border border-kds-border rounded-2xl p-5">
            <h2 className="text-base font-bold text-white">
              لوحة الإيقاف الفوري للأصناف النافدة (One-Tap 86ing)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              الضغط على زر الإيقاف الفوري يحدث حالة الصنف في قاعدة البيانات ويبث حدث WebSocket (`catalog:item_86ed`) لجميع هواتف الزبائن في أقل من ثانية.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {catalogItems.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                  item.isAvailable
                    ? 'bg-kds-surface border-kds-border'
                    : 'bg-rose-950/30 border-rose-500'
                }`}
              >
                <div className="space-y-1">
                  <span className="text-xs text-slate-400">{item.categoryName}</span>
                  <h3 className="text-sm font-bold text-white">{item.name}</h3>
                  <p
                    className={`text-xs font-bold ${
                      item.isAvailable ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {item.isAvailable
                      ? 'متوفر للطلب في قوائم الزبائن'
                      : 'نافد حالياً (موقوف 86ed)'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleItem86Status(item.id)}
                  className={`min-h-[64px] min-w-[140px] px-4 rounded-xl font-bold text-xs transition-colors whitespace-nowrap shrink-0 ${
                    item.isAvailable
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  }`}
                >
                  {item.isAvailable ? 'إيقاف فوري (86)' : 'إعادة التوفير الآن'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
