import React from 'react';
import { formatPersianPrice, formatPersianNumber } from '../utils';

export default function InvoicePrintView({ printedDoc }: { printedDoc: any }) {
  if (!printedDoc) return null;

  const isInvoice = printedDoc.type === 'invoice';
  
  let title = 'سند انبار';
  if (printedDoc.type === 'invoice') title = 'صورتحساب فروش کالا و خدمات';
  if (printedDoc.type === 'receipt') title = 'رسید ورود به انبار';
  if (printedDoc.type === 'remittance') title = 'حواله خروج از انبار';
  if (printedDoc.type === 'return') title = 'رسید برگشت از فروش';
  if (printedDoc.type === 'waste') title = 'حواله ضایعات';

  return (
    <div className="bg-white p-6 mx-auto w-full max-w-[200mm] shadow print:shadow-none print:w-full print:p-4 font-sans text-sm border print:border-none">
      <div className="bg-[#6c74ad] text-white flex justify-center py-3 mb-4 font-bold text-lg rounded-t-xl print:rounded-none" style={{ backgroundColor: '#6c74ad', printColorAdjust: 'exact' }}>
        {title} {isInvoice && '(گالری پاپیتال)'}
        {printedDoc.status === 'proforma' && ' - پیش فاکتور'}
      </div>
      <div className="flex justify-between items-center mb-2 text-xs">
        <div className="font-bold">شماره سند: {formatPersianNumber(printedDoc.ref_number)}</div>
        <div className="font-bold">تاریخ: {formatPersianNumber(new Date(printedDoc.date).toLocaleDateString('fa-IR'))}</div>
      </div>
      
      {isInvoice && (
        <table className="w-full mb-4 border-collapse print:text-[13px]">
          <tbody>
            <tr>
              <td colSpan={4} className="bg-gray-100 text-center font-bold py-1 border" style={{ backgroundColor: '#f3f4f6', printColorAdjust: 'exact' }}>مشخصات فروشنده</td>
            </tr>
            <tr>
              <td className="py-1 px-2 border w-1/4"><strong>نام فروشنده:</strong> گالری پاپیتال</td>
              <td className="py-1 px-2 border w-1/4"><strong>استان / شهر:</strong> تهران / تهران</td>
              <td colSpan={2} className="py-1 px-2 border"><strong>تلفن:</strong> 09308128622</td>
            </tr>
            <tr>
              <td colSpan={4} className="py-1 px-2 border"><strong>نشانی:</strong> خیابان طالقانی، بن بست مسعود، پلاک 13</td>
            </tr>

            <tr>
              <td colSpan={4} className="bg-gray-100 text-center font-bold py-1 border mt-2" style={{ backgroundColor: '#f3f4f6', printColorAdjust: 'exact' }}>مشخصات خریدار</td>
            </tr>
            <tr>
              <td className="py-1 px-2 border w-1/4"><strong>نام خریدار:</strong> {printedDoc.buyer_name || '-'}</td>
              <td className="py-1 px-2 border w-1/4"><strong>استان / شهر:</strong> {printedDoc.buyer_city || '-'}</td>
              <td colSpan={2} className="py-1 px-2 border"><strong>تلفن:</strong> {formatPersianNumber(printedDoc.buyer_phone || '-')}</td>
            </tr>
            <tr>
              <td colSpan={4} className="py-1 px-2 border"><strong>نشانی:</strong> {printedDoc.buyer_address || '-'}</td>
            </tr>
          </tbody>
        </table>
      )}

      {!isInvoice && (
         <div className="flex justify-between items-center mb-4 text-sm font-medium border p-3 rounded bg-slate-50">
           <div>{['receipt', 'return'].includes(printedDoc.type) ? 'تحویل دهنده:' : 'گیرنده حواله:'} {printedDoc.buyer_name || '-'}</div>
           <div>صادرکننده: {printedDoc.user || '-'}</div>
         </div>
      )}

      <div className="bg-gray-100 text-center font-bold py-1 border border-b-0 print:text-[13px]" style={{ backgroundColor: '#f3f4f6', printColorAdjust: 'exact' }}>مشخصات کالا</div>
      <table className="w-full text-center border-collapse border print:text-[12px] break-inside-auto">
        <thead>
          <tr className="bg-[#6c74ad] text-white" style={{ backgroundColor: '#6c74ad', printColorAdjust: 'exact' }}>
            <th className="border p-1.5 font-medium">ردیف</th>
            <th className="border p-1.5 font-medium">کد کالا</th>
            <th className="border p-1.5 font-medium w-1/3">شرح کالا</th>
            <th className="border p-1.5 font-medium">تعداد</th>
            <th className="border p-1.5 font-medium">واحد</th>
            {isInvoice && <th className="border p-1.5 font-medium">مبلغ واحد</th>}
            {isInvoice && <th className="border p-1.5 font-medium">مبلغ کل</th>}
            {isInvoice && <th className="border p-1.5 font-medium">تخفیف</th>}
            {isInvoice && <th className="border p-1.5 font-medium">مبلغ نهایی</th>}
          </tr>
        </thead>
        <tbody>
          {(printedDoc.items || []).map((item: any, idx: number) => {
            const total = item.quantity * item.unit_price;
            const final = total - item.discount;
            return (
              <tr key={item.id} className="h-7 hover:bg-slate-50 break-inside-avoid">
                <td className="border p-1 font-medium bg-slate-50">{formatPersianNumber(idx + 1)}</td>
                <td className="border p-1 font-mono text-[11px]" dir="ltr">{formatPersianNumber(item.code)}</td>
                <td className="border p-1 font-bold">{item.name}</td>
                <td className="border p-1">{formatPersianNumber(item.quantity)}</td>
                <td className="border p-1">{item.unit}</td>
                {isInvoice && <td className="border p-1">{formatPersianPrice(item.unit_price)}</td>}
                {isInvoice && <td className="border p-1">{formatPersianPrice(total)}</td>}
                {isInvoice && <td className="border p-1">{item.discount > 0 ? formatPersianPrice(item.discount) : ''}</td>}
                {isInvoice && <td className="border p-1 font-bold bg-slate-50">{formatPersianPrice(final)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>

      <table className="w-full mt-2 border-collapse print:text-[13px] break-inside-avoid">
        <tbody>
          <tr>
            <td className="border p-2 align-top h-20" colSpan={isInvoice ? 4 : 1} rowSpan={isInvoice ? 3 : 1}>
              <strong>توضیحات:</strong> {printedDoc.notes || '-'}
            </td>
            {isInvoice && (
              <>
                <td className="border p-2 bg-gray-50 w-32 font-bold" style={{ backgroundColor: '#f9fafb', printColorAdjust: 'exact' }}>جمع کل:</td>
                <td className="border p-2 w-40 text-left font-bold">{formatPersianPrice((printedDoc.items || []).reduce((a:any, b:any)=>a+(b.quantity*b.unit_price),0))}</td>
              </>
            )}
          </tr>
          {isInvoice && (
            <tr>
              <td className="border p-2 bg-gray-50 font-bold" style={{ backgroundColor: '#f9fafb', printColorAdjust: 'exact' }}>تخفیف:</td>
              <td className="border p-2 text-left font-bold">{formatPersianPrice((printedDoc.items || []).reduce((a:any, b:any)=>a+b.discount,0))}</td>
            </tr>
          )}
          {isInvoice && (
            <tr>
              <td className="border p-2 bg-gray-200 font-bold" style={{ backgroundColor: '#e5e7eb', printColorAdjust: 'exact' }}>مبلغ نهایی:</td>
              <td className="border p-2 text-left font-bold bg-gray-200" style={{ backgroundColor: '#e5e7eb', printColorAdjust: 'exact' }}>
                {formatPersianPrice((printedDoc.items || []).reduce((a:any, b:any)=>a+(b.quantity*b.unit_price),0) - (printedDoc.items || []).reduce((a:any, b:any)=>a+b.discount,0))}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-8 flex justify-between items-center text-center font-bold px-10">
        <div>مهر و امضاء خریدار</div>
        <div>مهر و امضاء فروشنده</div>
      </div>
    </div>
  );
}
