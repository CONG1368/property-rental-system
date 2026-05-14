import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

type SchemaMap = {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
};

export function validate(schemas: SchemaMap) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (schemas.body) {
      const { error } = schemas.body.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          code: 400,
          message: '参数校验失败',
          errors: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
        });
      }
    }
    if (schemas.query) {
      const { error } = schemas.query.validate(req.query, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          code: 400,
          message: '查询参数校验失败',
          errors: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
        });
      }
    }
    if (schemas.params) {
      const { error } = schemas.params.validate(req.params, { abortEarly: false });
      if (error) {
        return res.status(400).json({
          code: 400,
          message: '路径参数校验失败',
          errors: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
        });
      }
    }
    next();
  };
}
