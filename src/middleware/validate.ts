import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

const fieldTranslations: Record<string, string> = {
  name: 'نام کالا',
  code: 'کد کالا',
  unit: 'واحد اندازه گیری',
  category: 'دسته‌بندی',
  reorder_point: 'نقطه سفارش',
  weighted_average_cost: 'قیمت میانگین',
  body: 'اطلاعات ارسالی',
  type: 'نوع',
  quantity: 'مقدار',
  price: 'قیمت',
  document_type: 'نوع سند',
  image: 'تصویر',
  thumbnail: 'تصویر کوچک'
};

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const detailMessages = error.issues.map(e => {
          const field = e.path.length > 1 ? e.path[e.path.length - 1] : e.path[0];
          const translatedField = fieldTranslations[field as string] || String(field);
          return `(${translatedField}) ${e.message}`;
        }).join(' | ');
        return res.status(400).json({
          error: `خطای اعتبارسنجی: ${detailMessages}`,
          details: error.issues.map(e => ({ path: e.path.join('.'), message: e.message }))
        });
      }
      next(error);
    }
  };
};
