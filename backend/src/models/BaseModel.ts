import { Model } from 'sequelize';

/**
 * 基础模型类：为所有 Sequelize 模型提供索引签名，
 * 让 TypeScript 识别通过 init() 定义的属性。
 * 后续可逐步为各模型添加 declare 声明替代此索引签名。
 */
export class BaseModel<T extends {} = any, U extends {} = T> extends Model<T, U> {
  [key: string]: any;
}
