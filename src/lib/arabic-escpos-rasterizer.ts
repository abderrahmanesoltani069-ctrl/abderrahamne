import { packMonochromePixelsToEscPosBytes } from './domain-rules';

export interface ReceiptLineItem {
  nameAr: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  modifiersAr?: string[];
  notesAr?: string;
}

export interface ArabicReceiptPayload {
  restaurantNameAr: string;
  branchNameAr: string;
  taxNumber?: string;
  orderNumber: number;
  orderTypeLabelAr: string;
  dateFormatted: string;
  currencyAr: string;
  items: ReceiptLineItem[];
  subtotal: number;
  taxRatePercent: number;
  taxAmount: number;
  deliveryFee?: number;
  totalAmount: number;
  qrPayloadString: string;
  openCashDrawer?: boolean;
}

export interface RasterizedReceiptResult {
  canvas: HTMLCanvasElement;
  escPosBytes: Uint8Array;
  widthDots: number;
  heightDots: number;
  hexPreview: string;
}

export class ArabicEscPosRasterizer {
  public static readonly PAPER_WIDTH_DOTS = 576; // 80mm thermal paper = 576 dots (72 bytes/row)
  public static readonly BYTES_PER_ROW = ArabicEscPosRasterizer.PAPER_WIDTH_DOTS / 8;

  public static renderReceiptToMonochromeCanvas(
    data: ArabicReceiptPayload,
  ): RasterizedReceiptResult {
    const width = this.PAPER_WIDTH_DOTS;

    let estimatedHeight = 620;
    for (const item of data.items) {
      estimatedHeight += 52;
      if (item.modifiersAr && item.modifiersAr.length > 0) {
        estimatedHeight += item.modifiersAr.length * 28;
      }
      if (item.notesAr) {
        estimatedHeight += 32;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = estimatedHeight;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('تعذر تهيئة سياق الرسم ثنائي الأبعاد HTML5 2D Canvas.');
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, estimatedHeight);

    ctx.fillStyle = '#000000';
    ctx.direction = 'rtl';
    let cursorY = 44;

    // 1. Restaurant & Branch Header
    ctx.font = '800 32px "Readex Pro", "Cairo", Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(data.restaurantNameAr, width / 2, cursorY);
    cursorY += 36;

    ctx.font = '700 20px "Readex Pro", "Cairo", Tahoma, sans-serif';
    ctx.fillText(data.branchNameAr, width / 2, cursorY);
    cursorY += 28;

    if (data.taxNumber) {
      ctx.font = '600 17px "Readex Pro", "Cairo", Tahoma, sans-serif';
      ctx.fillText(`الرقم الضريبي: ${data.taxNumber}`, width / 2, cursorY);
      cursorY += 26;
    }

    // 2. Order Number & Table Box
    cursorY += 10;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, cursorY, width - 40, 68);

    ctx.font = '800 26px "Readex Pro", "Cairo", Tahoma, sans-serif';
    ctx.fillText(
      `طلب رقم #${data.orderNumber}  |  ${data.orderTypeLabelAr}`,
      width / 2,
      cursorY + 44,
    );
    cursorY += 92;

    // Date & Time
    ctx.font = '600 17px "Readex Pro", "Cairo", Tahoma, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`التاريخ: ${data.dateFormatted}`, width - 20, cursorY);
    cursorY += 22;

    this.drawDashedLine(ctx, cursorY, width);
    cursorY += 30;

    // 3. Table Header
    ctx.font = '800 19px "Readex Pro", "Cairo", Tahoma, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('الصنف والإضافات', width - 20, cursorY);
    ctx.textAlign = 'center';
    ctx.fillText('الكمية', 195, cursorY);
    ctx.textAlign = 'left';
    ctx.fillText('الإجمالي', 20, cursorY);
    cursorY += 16;

    this.drawSolidLine(ctx, cursorY, width);
    cursorY += 32;

    // 4. Items & Modifiers
    for (const item of data.items) {
      ctx.font = '700 21px "Readex Pro", "Cairo", Tahoma, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(item.nameAr, width - 20, cursorY);

      ctx.textAlign = 'center';
      ctx.fillText(`${item.quantity}x`, 195, cursorY);

      ctx.textAlign = 'left';
      ctx.fillText(item.lineTotal.toFixed(2), 20, cursorY);
      cursorY += 28;

      if (item.modifiersAr && item.modifiersAr.length > 0) {
        ctx.font = '600 17px "Readex Pro", "Cairo", Tahoma, sans-serif';
        ctx.textAlign = 'right';
        for (const mod of item.modifiersAr) {
          const cleanMod = mod.replace(/^\+\s*/, '');
          ctx.fillText(`  + ${cleanMod}`, width - 34, cursorY);
          cursorY += 24;
        }
      }

      if (item.notesAr) {
        ctx.font = '700 16px "Readex Pro", "Cairo", Tahoma, sans-serif';
        ctx.textAlign = 'right';
        cursorY = this.drawWrappedRtlText(
          ctx,
          `* ملاحظة: ${item.notesAr}`,
          width - 34,
          cursorY,
          width - 68,
          24,
        );
      }

      cursorY += 8;
    }

    this.drawDashedLine(ctx, cursorY, width);
    cursorY += 32;

    // 5. Financial Breakdown
    ctx.font = '700 19px "Readex Pro", "Cairo", Tahoma, sans-serif';
    this.drawSummaryRow(
      ctx,
      'المجموع الفرعي:',
      `${data.subtotal.toFixed(2)} ${data.currencyAr}`,
      cursorY,
      width,
    );
    cursorY += 30;

    this.drawSummaryRow(
      ctx,
      `ضريبة القيمة المضافة (${data.taxRatePercent}%):`,
      `${data.taxAmount.toFixed(2)} ${data.currencyAr}`,
      cursorY,
      width,
    );
    cursorY += 30;

    if (data.deliveryFee && data.deliveryFee > 0) {
      this.drawSummaryRow(
        ctx,
        'رسوم التوصيل المباشر:',
        `${data.deliveryFee.toFixed(2)} ${data.currencyAr}`,
        cursorY,
        width,
      );
      cursorY += 30;
    }

    this.drawSolidLine(ctx, cursorY, width);
    cursorY += 38;

    ctx.font = '800 26px "Readex Pro", "Cairo", Tahoma, sans-serif';
    this.drawSummaryRow(
      ctx,
      'الإجمالي المستحق:',
      `${data.totalAmount.toFixed(2)} ${data.currencyAr}`,
      cursorY,
      width,
    );
    cursorY += 34;

    // 6. Deterministic QR Code Matrix
    this.drawDeterministicQrMatrix(ctx, data.qrPayloadString, Math.floor((width - 168) / 2), cursorY, 168);
    cursorY += 196;

    ctx.font = '700 17px "Readex Pro", "Cairo", Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('شكراً لزيارتكم — نتمنى لكم وجبة شهية!', width / 2, cursorY);
    cursorY += 32;

    // Crop to exact height (divisible by 2)
    const finalHeight = Math.ceil(cursorY / 2) * 2;
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = width;
    croppedCanvas.height = finalHeight;
    const croppedCtx = croppedCanvas.getContext('2d', { willReadFrequently: true });
    if (!croppedCtx) {
      throw new Error('تعذر قص صورة الفاتورة الحرارية.');
    }
    croppedCtx.fillStyle = '#FFFFFF';
    croppedCtx.fillRect(0, 0, width, finalHeight);
    croppedCtx.drawImage(canvas, 0, 0);

    // 7. Apply strict 1-Bit Monochrome Thresholding directly on the cropped canvas so user sees exact thermal output
    const imgData = croppedCtx.getImageData(0, 0, width, finalHeight);
    const pixels = imgData.data;
    const luminanceGrid = new Uint8Array(width * finalHeight);

    for (let i = 0; i < width * finalHeight; i++) {
      const idx = i * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];
      const lum = a === 0 ? 255 : Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      luminanceGrid[i] = lum;

      // Force pure 1-bit black or white pixel on preview canvas
      const mono = lum < 145 ? 0 : 255;
      pixels[idx] = mono;
      pixels[idx + 1] = mono;
      pixels[idx + 2] = mono;
      pixels[idx + 3] = 255;
    }
    croppedCtx.putImageData(imgData, 0, 0);

    const escPosBytes = packMonochromePixelsToEscPosBytes(
      luminanceGrid,
      width,
      finalHeight,
      Boolean(data.openCashDrawer),
    );

    const hexPreview = Array.from(escPosBytes.slice(0, 32))
      .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
      .join(' ');

    return {
      canvas: croppedCanvas,
      escPosBytes,
      widthDots: width,
      heightDots: finalHeight,
      hexPreview,
    };
  }

  public static async printViaWebUsb(receipt: ArabicReceiptPayload): Promise<void> {
    const nav = navigator as any;
    if (!nav.usb) {
      throw new Error('متصفحك الحالي لا يدعم WebUSB API المباشر. استخدم زر تحميل ملف ESC/POS (.bin) أو جسر الشبكة TCP 9100.');
    }

    const { escPosBytes } = this.renderReceiptToMonochromeCanvas(receipt);
    const pairedDevices: any[] = await nav.usb.getDevices();
    const device =
      pairedDevices[0] ||
      (await nav.usb.requestDevice({
        filters: [{ classCode: 7 }],
      }));

    try {
      await device.open();
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }
      const iface = device.configuration.interfaces[0];
      await device.claimInterface(iface.interfaceNumber);
      const outEndpoint = iface.alternate.endpoints.find(
        (ep: any) => ep.direction === 'out' && ep.type === 'bulk',
      );
      if (!outEndpoint) {
        throw new Error('لم يتم العثور على منفذ Bulk OUT في الطابعة الحرارية.');
      }

      const CHUNK_SIZE = 4096;
      for (let offset = 0; offset < escPosBytes.length; offset += CHUNK_SIZE) {
        const chunk = escPosBytes.slice(offset, offset + CHUNK_SIZE);
        await device.transferOut(outEndpoint.endpointNumber, chunk);
      }
    } finally {
      try {
        await device.close();
      } catch {
        // Ignore close errors
      }
    }
  }

  private static drawDashedLine(ctx: CanvasRenderingContext2D, y: number, width: number) {
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(width - 20, y);
    ctx.stroke();
    ctx.restore();
  }

  private static drawSolidLine(ctx: CanvasRenderingContext2D, y: number, width: number) {
    ctx.save();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(width - 20, y);
    ctx.stroke();
    ctx.restore();
  }

  private static drawWrappedRtlText(
    ctx: CanvasRenderingContext2D,
    text: string,
    rightX: number,
    startY: number,
    maxWidth: number,
    lineHeight: number,
  ): number {
    const words = text.split(' ');
    let currentLine = '';
    let y = startY;

    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        ctx.fillText(currentLine, rightX, y);
        currentLine = words[i];
        y += lineHeight;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      ctx.fillText(currentLine, rightX, y);
      y += lineHeight;
    }
    return y;
  }

  private static drawSummaryRow(
    ctx: CanvasRenderingContext2D,
    labelAr: string,
    valueText: string,
    y: number,
    width: number,
  ) {
    ctx.textAlign = 'right';
    ctx.fillText(labelAr, width - 20, y);
    ctx.textAlign = 'left';
    ctx.fillText(valueText, 20, y);
  }

  private static drawDeterministicQrMatrix(
    ctx: CanvasRenderingContext2D,
    payload: string,
    startX: number,
    startY: number,
    sizePx: number,
  ) {
    const modules = 21;
    const cellSize = Math.floor(sizePx / modules);
    ctx.save();
    ctx.fillStyle = '#000000';

    const drawFinderPattern = (r0: number, c0: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          if (isBorder || isInner) {
            ctx.fillRect(startX + (c0 + c) * cellSize, startY + (r0 + r) * cellSize, cellSize, cellSize);
          }
        }
      }
    };

    drawFinderPattern(0, 0);
    drawFinderPattern(0, modules - 7);
    drawFinderPattern(modules - 7, 0);

    let hash = 2166136261;
    for (let i = 0; i < payload.length; i++) {
      hash ^= payload.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        const inTopLeft = r < 8 && c < 8;
        const inTopRight = r < 8 && c >= modules - 8;
        const inBottomLeft = r >= modules - 8 && c < 8;
        if (inTopLeft || inTopRight || inBottomLeft) continue;

        const seed = Math.imul(hash ^ (r * 31 + c * 17), 2654435761) >>> 0;
        if (seed % 2 === 0) {
          ctx.fillRect(startX + c * cellSize, startY + r * cellSize, cellSize, cellSize);
        }
      }
    }
    ctx.restore();
  }
}
