import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

interface Product {
    codeProduct: string;
    productName: string;
    productPrice: number;
    status: boolean;
    productDesc: string;
    stocks: string[];
}

const addProduct = async (
    codeProduct: string,
    productName: string,
    productPrice: number,
    status: boolean,
    productDesc: string,
    stocks: string[]
): Promise<string> => {
    try {
        const dbPath = path.resolve(__dirname, '../../db/list-product.json');
        let productData: Product[] = [];
        try {
            const jsonData = readFileSync(dbPath, 'utf-8');
            productData = JSON.parse(jsonData);
        } catch (err) {
            return 'list-product.json file not found or is empty, initializing a new list.';
        }
        const existingProduct = productData.find(product => product.codeProduct === codeProduct);
        if (existingProduct) {
            return 'A product with this code already exists.';
        }
        if (stocks.length < 1 || stocks.length > 10) {
            return 'Stocks must be between 1 and 10 items.';
        }
        const newProduct: Product = {
            codeProduct,
            productName,
            productPrice,
            status,
            productDesc,
            stocks
        };
        productData.push(newProduct);
        writeFileSync(dbPath, JSON.stringify(productData, null, 2), 'utf-8');
        return 'Product added successfully!';
    } catch (error) {
        return `An error occurred while adding the product: ${error.message}`;
    }
};

const deleteProduct = async (codeProducts: string[]): Promise<string> => {
    try {
        const dbPath = path.resolve(__dirname, '../../db/list-product.json');
        let productData: Product[] = [];
        try {
            const jsonData = readFileSync(dbPath, 'utf-8');
            productData = JSON.parse(jsonData);
        } catch (err) {
            return 'list-product.json file not found or is empty, cannot delete products.';
        }
        const initialLength = productData.length;
        productData = productData.filter(product => !codeProducts.includes(product.codeProduct));
        if (productData.length === initialLength) {
            return 'No products found to delete with the provided codes.';
        }
        writeFileSync(dbPath, JSON.stringify(productData, null, 2), 'utf-8');
        return `Deleted ${initialLength - productData.length} product(s) successfully!`;
    } catch (error) {
        return `An error occurred while deleting products: ${error.message}`;
    }
};

const updateProductStatus = async (codeProduct: string, newStatus: boolean): Promise<string> => {
    try {
        const dbPath = path.resolve(__dirname, '../../db/list-product.json');
        let productData: Product[] = JSON.parse(readFileSync(dbPath, 'utf-8'));
        const productIndex = productData.findIndex(product => product.codeProduct === codeProduct);
        if (productIndex === -1) {
            return 'Product not found.';
        }
        productData[productIndex].status = newStatus;
        writeFileSync(dbPath, JSON.stringify(productData, null, 2), 'utf-8');
        return `Product status updated successfully for codeProduct ${codeProduct}!`;
    } catch (error) {
        return `An error occurred while updating the product status: ${error.message}`;
    }
};

const editProduct = async (codeProduct: string, newProductName?: string, newProductDesc?: string, newProductPrice?: string): Promise<string> => {
    try {
        const dbPath = path.resolve(__dirname, '../../db/list-product.json');
        let productData: Product[] = [];
        try {
            const jsonData = readFileSync(dbPath, 'utf-8');
            productData = JSON.parse(jsonData);
        } catch (err) {
            return 'Error: list-product.json file not found or is empty. Initializing a new list.';
        }
        const productIndex = productData.findIndex(product => product.codeProduct === codeProduct);
        if (productIndex === -1) {
            return 'Error: Product not found.';
        }
        if (newProductName && newProductName !== '-') {
            productData[productIndex].productName = newProductName;
        }
        if (newProductDesc && newProductDesc !== '-') {
            productData[productIndex].productDesc = newProductDesc;
        }
        if (newProductPrice && newProductPrice !== '-') {
            const price = parseInt(newProductPrice);
            if (!isNaN(price)) {
                productData[productIndex].productPrice = price;
            } else {
                return 'Error: Invalid product price.';
            }
        }
        writeFileSync(dbPath, JSON.stringify(productData, null, 2), 'utf-8');
        return 'Product updated successfully!';
    } catch (error) {
        return `Error: An error occurred while editing the product: ${error.message}`;
    }
};

const readProducts = async (): Promise<Product[] | string> => {
    try {
        const dbPath = path.resolve(__dirname, '../../db/list-product.json');
        let productData: Product[] = JSON.parse(readFileSync(dbPath, 'utf-8'));
        for (const product of productData) {
            if (!product.stocks || product.stocks.length === 0) {
                await updateProductStatus(product.codeProduct, false);
            }
        }
        return productData;
    } catch (error) {
        return `An error occurred while reading the product database: ${error.message}`;
    }
};

const getProductByCode = async (codeProduct: string): Promise<Product | string> => {
    try {
        const dbPath = path.resolve(__dirname, '../../db/list-product.json');
        const productData: Product[] = JSON.parse(readFileSync(dbPath, 'utf-8'));
        const product = productData.find(product => product.codeProduct === codeProduct);
        if (!product) {
            return `Product with code ${codeProduct} not found.`;
        }
        return product;
    } catch (error) {
        return `An error occurred while reading the product: ${error.message}`;
    }
};

async function takeProduct(codeProduct: string): Promise<string | { stockTaken: string }> {
    const product = await getProductByCode(codeProduct);
    if (typeof product === 'string') {
        return 'Product not found.';
    }
    if (!product.stocks || product.stocks.length === 0) {
        await updateProductStatus(codeProduct, false);
        return 'Stock is empty for this product.';
    }
    const stockTaken = product.stocks.shift();
    const dbPath = path.resolve(__dirname, '../../db/list-product.json');
    try {
        let productData: Product[] = JSON.parse(readFileSync(dbPath, 'utf-8'));
        const productIndex = productData.findIndex(p => p.codeProduct === codeProduct);
        if (productIndex === -1) {
            return 'Product not found in database.';
        }
        productData[productIndex].stocks = product.stocks;
        writeFileSync(dbPath, JSON.stringify(productData, null, 2), 'utf-8');
    } catch (error) {
        return `An error occurred while updating the product stocks: ${error.message}`;
    }
    return { stockTaken: stockTaken || '' };
}

const addStocks = async (codeProduct: string, newStocks: string[]): Promise<string> => {
    try {
        const dbPath = path.resolve(__dirname, '../../db/list-product.json');
        const product = await getProductByCode(codeProduct);
        if (typeof product === 'string') {
            return 'Product not found.';
        }
        if (!product.stocks || product.stocks.length === 0) {
            await updateProductStatus(codeProduct, true);
        }
        let productData: Product[] = [];
        try {
            const jsonData = readFileSync(dbPath, 'utf-8');
            productData = JSON.parse(jsonData);
        } catch (err) {
            return 'list-product.json file not found or is empty, initializing a new list.';
        }
        const existingProductIndex = productData.findIndex(product => product.codeProduct === codeProduct);
        if (existingProductIndex === -1) {
            return 'Product not found.';
        }
        const existingProduct = productData[existingProductIndex];
        const totalStocksAfterAddition = newStocks.length + existingProduct.stocks.length;
        if (totalStocksAfterAddition > 10) {
            return 'Total stocks cannot exceed 10 items.';
        }
        existingProduct.stocks.push(...newStocks);
        productData[existingProductIndex] = existingProduct;
        writeFileSync(dbPath, JSON.stringify(productData, null, 2), 'utf-8');
        return 'Stocks added successfully!';
    } catch (error) {
        return `An error occurred while adding stocks: ${error.message}`;
    }
};

export {
    addProduct,
    deleteProduct,
    updateProductStatus,
    readProducts,
    editProduct,
    getProductByCode,
    addStocks,
    takeProduct
};