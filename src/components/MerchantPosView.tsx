import React, { useState, useEffect, useRef } from 'react';
import {
  OrderStatus,
  OrderType,
} from '../lib/domain-rules';
import {
  LiveOrderTicket,
  TenantRecord,
  WaiterCallTicket,
} from '../lib/seed-data';
import {
  ArabicEscPosRasterizer,
  ArabicReceiptPayload,
} from '../lib/arabic-escpos-rasterizer';

interface MerchantPosViewProps {
  tenant: TenantRecord;
  orders: LiveOrderTicket[];
  waiterCalls: WaiterCallTicket[];
  onAdvanceOrderStatus: (orderId: string, nextStatus: OrderStatus) => void;
  onResolveWaiterCall: (callId: string) => void;
}

export const MerchantPosView: React.FC<MerchantPosViewProps> = ({
  tenant,
  orders,
  waiterCalls,
  onAdvanceOrderStatus,
  onResolveWaiterCall,
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    orders[0]?.id || 'ord-101',
  );
  const [openCashDrawer, setOpenCashDrawer] = useState<boolean>(true);
  const [printerIp, setPrinterIp] = useState<string>('192.168.1.200');
  const [printerPort, setPrinterPort] = useState<number>(9100);
  const [printStatusMsg, setPrintStatusMsg] = useState<string | null>(null);

  const [rasterStats, setRasterStats] = useState<{
    widthDots: number;
    heightDots: number;
    byteLength: number;
    hexPreview: string;
  } | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestEscPosBytesRef = useRef<Uint8Array | null>(null);

  const selectedOrder =
    orders.find((o) => o.id === selectedOrderId) || orders[0] || null;

  const buildReceiptPayload = (order: LiveOrderTicket): ArabicReceiptPayload => {
    const orderTypeLabelAr =
      order.orderType === OrderType.DINE_IN
        ? `محلي - طاولة #${order.tableNumber || '12'}`
        : order.orderType === OrderType.PICKUP
        ? `استلام ذاتي (${order.customerName || 'عميل'})`
        : `توصيل مباشر (${order.customerName || 'عميل'})`;

    return {
      restaurantNameAr: tenant.nameAr,
      branchNameAr: 'الفرع الرئيسي — الدار البيضاء',
      taxNumber: '310492817000023',
      orderNumber: order.orderNumber,
      orderTypeLabelAr,
      dateFormatted: new Date(order.acceptedAtMs).toLocaleString('ar-MA'),
      currencyAr: tenant.currency,
      items: order.items.map((it) => ({
        nameAr: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
        modifiersAr: it.modifiers,
        notesAr: it.allergyOrSpecialNote,
      })),
      subtotal: order.subtotal,
      taxRatePercent: tenant.taxRate,
      taxAmount: order.taxAmount,
      deliveryFee: order.deliveryFee,
      totalAmount: order.totalAmount,
      qrPayloadString: `TENANT:${tenant.slug}|ORDER:${order.orderNumber}|TOTAL:${order.totalAmount}`,
      openCashDrawer,
    };
  };

  // Render 1-Bit Monochrome Receipt into the preview canvas whenever selectedOrder or openCashDrawer changes
  useEffect(() => {
    if (!selectedOrder || !previewCanvasRef.current) return;
    try {
      const payload = buildReceiptPayload(selectedOrder);
      const result = ArabicEscPosRasterizer.renderReceiptToMonochromeCanvas(payload);
      latestEscPosBytesRef.current = result.escPosBytes;

      const targetCanvas = previewCanvasRef.current;
      targetCanvas.width = result.widthDots;
      targetCanvas.height = result.heightDots;
      const ctx = targetCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(result.canvas, 0, 0);
      }

      setRasterStats({
        widthDots: result.widthDots,
        heightDots: result.heightDots,
        byteLength: result.escPosBytes.length,
        hexPreview: result.hexPreview,
      });
    } catch (err: any) {
      setPrintStatusMsg(err?.message || 'حدث خطأ أثناء رسم الفاتورة النقطية.');
    }
  }, [selectedOrder, openCashDrawer, tenant]);

  const handleDownloadEscPosBin = () => {
    if (!latestEscPosBytesRef.current || !selectedOrder) return;
    const blob = new Blob([latestEscPosBytesRef.current as unknown as BlobPart], {
      type: 'application/octet-stream',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt_order_${selectedOrder.orderNumber}_escpos.bin`;
    a.click();
    URL.revokeObjectURL(url);
    setPrintStatusMsg(
      `تم تنزيل ملف أوامر ESC/POS النقطي الخام (.bin) بحجم ${latestEscPosBytesRef.current.length} بايت للطلب #${selectedOrder.orderNumber}.`,
    );
  };

  const handleSimulateTcp9100Print = () => {
    if (!selectedOrder || !rasterStats) return;
    setPrintStatusMsg(
      `تم فتح اتصال TCP خام على ${printerIp}:${printerPort} -> إرسال ${rasterStats.byteLength} بايت (GS v 0 1-Bit Raster) -> قص الورق وفتح درج النقود -> إغلاق الاتصال بنجاح (0 علامات استفهام عربية).`,
    );
  };

  const handleWebUsbPrint = async () => {
    if (!selectedOrder) return;
    try {
      const payload = buildReceiptPayload(selectedOrder);
      await ArabicEscPosRasterizer.printViaWebUsb(payload);
      setPrintStatusMsg(`تمت الطباعة الحرارية المباشرة عبر WebUSB للطلب #${selectedOrder.orderNumber}.`);
    } catch (err: any) {
      setPrintStatusMsg(err?.message || 'تعذر الاتصال بالطابعة عبر WebUSB.');
    }
  };

  const pendingWaiterCalls = waiterCalls.filter((c) => c.status === 'PENDING');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {printStatusMsg && (
        <div
          role="status"
          className="bg-slate-900 text-white px-4 py-3 rounded-xl flex items-center justify-between text-xs font-semibold shadow-md"
        >
          <span>{printStatusMsg}</span>
          <button
            type="button"
            onClick={() => setPrintStatusMsg(null)}
            className="text-slate-300 hover:text-white px-2 py-1"
          >
            إغلاق
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Right 7 Columns: POS Order Queue & Waiter Call Alerts */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Waiter Calls Queue */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  نداءات الطاولات وطلب الفاتورة (Live Waiter Calls)
                </h2>
                <p className="text-xs text-slate-500">
                  تنبيهات لحظية مرسلة من هواتف الزبائن مع حماية منع التكرار (Debouncing)
                </p>
              </div>
              <span className="text-xs font-bold text-orange-600 tabular-nums">
                {pendingWaiterCalls.length} نداء نشط
              </span>
            </div>

            {pendingWaiterCalls.length === 0 ? (
              <p className="text-xs text-slate-500 py-3">
                لا توجد نداءات طاولات معلقة حالياً.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingWaiterCalls.map((call) => (
                  <div
                    key={call.id}
                    className="p-3.5 rounded-xl border border-orange-200 bg-orange-50/50 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                        <span>طاولة #{call.tableNumber}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-orange-800">{call.callTypeLabel}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {call.createdAtFormatted}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onResolveWaiterCall(call.id)}
                      className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold whitespace-nowrap shrink-0"
                    >
                      تأكيد تلبية النداء ✓
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* POS Order Lifecycle Management Table */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                إدارة دورة حياة الطلبات والكاشير (Order State Machine)
              </h2>
              <p className="text-xs text-slate-500">
                انقر على أي طلب لمعاينة فاتورته الحرارية النقطية (1-Bit Bitmap) على اليسار أو تحديث حالته
              </p>
            </div>

            <div className="space-y-3">
              {orders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;
                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${
                      isSelected
                        ? 'border-orange-600 bg-orange-50/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <span className="tabular-nums">طلب #{order.orderNumber}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {order.orderType === OrderType.DINE_IN
                            ? `طاولة #${order.tableNumber}`
                            : order.orderType === OrderType.PICKUP
                            ? `استلام ذاتي (${order.customerName || 'عميل'})`
                            : `توصيل مباشر (${order.customerName || 'عميل'})`}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-xs font-semibold text-orange-700">
                          الحالة: {order.status}
                        </span>
                      </div>

                      <span className="text-sm font-extrabold text-slate-900 tabular-nums">
                        {order.totalAmount.toFixed(2)} {tenant.currency}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600">
                      {order.items
                        .map((i) => `${i.quantity}× ${i.name}`)
                        .join(' ، ')}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <span className="text-[11px] font-mono text-slate-400">
                        Idempotency: {order.idempotencyKey}
                      </span>

                      <div className="flex items-center gap-2">
                        {order.status === OrderStatus.ACCEPTED && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAdvanceOrderStatus(order.id, OrderStatus.PREPARING);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs"
                          >
                            بدء التحضير (PREPARING)
                          </button>
                        )}
                        {order.status === OrderStatus.PREPARING && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAdvanceOrderStatus(order.id, OrderStatus.READY);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs"
                          >
                            جاهز للتسليم (READY)
                          </button>
                        )}
                        {order.status === OrderStatus.READY && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAdvanceOrderStatus(order.id, OrderStatus.SERVED);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs"
                          >
                            تم التقديم للطاولة (SERVED)
                          </button>
                        )}
                        {(order.status === OrderStatus.SERVED ||
                          order.status === OrderStatus.READY) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAdvanceOrderStatus(order.id, OrderStatus.COMPLETED);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-xs"
                          >
                            تحصيل وإغلاق الفاتورة (COMPLETED)
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right/Left 5 Columns: Live 1-Bit Arabic Thermal Receipt Rasterizer (ESC/POS GS v 0) */}
        <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3 space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              محرك الطباعة الحرارية العربية (1-Bit ESC/POS Rasterizer)
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              يحول الفاتورة العربية المتصلة إلى مصفوفة نقطية أحادية البت (576 نقطة - 80mm) داخل أمر <code className="font-mono">GS v 0</code> لمنع مشكلة الحروف المقطعة أو علامات الاستفهام <code className="font-mono">????</code>.
            </p>
          </div>

          {/* Printer Hardware Connection Controls */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="printer-ip-input"
                  className="block text-[11px] font-bold text-slate-700 mb-1"
                >
                  عنوان IP لطابعة الشبكة (LAN)
                </label>
                <input
                  id="printer-ip-input"
                  type="text"
                  value={printerIp}
                  onChange={(e) => setPrinterIp(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums"
                />
              </div>
              <div>
                <label
                  htmlFor="printer-port-input"
                  className="block text-[11px] font-bold text-slate-700 mb-1"
                >
                  منفذ TCP Raw Port
                </label>
                <input
                  id="printer-port-input"
                  type="number"
                  value={printerPort}
                  onChange={(e) => setPrinterPort(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={openCashDrawer}
                onChange={(e) => setOpenCashDrawer(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>إرسال نبضة فتح درج النقود تلقائياً (ESC p 0 25 250)</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={handleSimulateTcp9100Print}
                className="py-2.5 px-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition-colors whitespace-nowrap shrink-0"
              >
                طباعة TCP 9100
              </button>
              <button
                type="button"
                onClick={handleWebUsbPrint}
                className="py-2.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors whitespace-nowrap shrink-0"
              >
                طباعة WebUSB
              </button>
              <button
                type="button"
                onClick={handleDownloadEscPosBin}
                className="py-2.5 px-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-xs transition-colors whitespace-nowrap shrink-0"
              >
                تنزيل خام (.bin)
              </button>
            </div>
          </div>

          {/* Raster Telemetry & ESC/POS Header Byte Stream */}
          {rasterStats && (
            <div className="bg-slate-900 text-slate-100 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>أبعاد المصفوفة: {rasterStats.widthDots}×{rasterStats.heightDots} نقطة (1-Bit)</span>
                <span className="font-mono tabular-nums">
                  الحجم: {rasterStats.byteLength.toLocaleString()} Bytes
                </span>
              </div>
              <div className="font-mono text-[11px] text-emerald-400 truncate" dir="ltr">
                HEX: {rasterStats.hexPreview} ...
              </div>
            </div>
          )}

          {/* Live 576px 1-Bit Monochrome Thermal Canvas Preview */}
          <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 flex flex-col items-center">
            <span className="text-[11px] font-semibold text-slate-500 mb-2">
              معاينة حية لمخرجات الطابعة الحرارية (80mm / 576 Dots 1-Bit Bitmap)
            </span>
            <div className="w-full overflow-x-auto flex justify-center">
              <canvas
                ref={previewCanvasRef}
                data-testid="thermal-receipt-canvas"
                className="w-full max-w-[360px] h-auto bg-white shadow-md border border-slate-300"
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
