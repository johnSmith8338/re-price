export interface RepriceProduct {
    id: string;
    name: string;
    article: string;
    oldPrice: number | null;
    newPrice: number | null;
    sortOrder: number;
}