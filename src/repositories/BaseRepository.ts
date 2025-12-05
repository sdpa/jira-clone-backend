import { Model } from 'dynamoose/dist/Model';
import { Item } from 'dynamoose/dist/Item';
import { Scan } from 'dynamoose/dist/ItemRetriever';

export abstract class BaseRepository<T extends Item> {
    protected model: Model<T>;

    constructor(model: Model<T>) {
        this.model = model;
    }

    async findById(id: string): Promise<T | undefined> {
        const result = await this.model.get(id);
        return result || undefined;
    }

    async findAll(): Promise<T[]> {
        return await this.model.scan().exec();
    }

    async create(data: Partial<T>): Promise<T> {
        return await this.model.create(data as any);
    }

    async update(id: string, data: Partial<T>): Promise<T | undefined> {
        const item = await this.findById(id);
        if (!item) return undefined;

        Object.assign(item, data);
        await item.save();
        return item;
    }

    async delete(id: string): Promise<void> {
        await this.model.delete(id);
    }

    async findOne(key: string, value: any): Promise<T | undefined> {
        const results = await this.model.scan(key).eq(value).limit(1).exec();
        return results.length > 0 ? results[0] : undefined;
    }
}
