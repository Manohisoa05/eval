import { buildUrl } from "./config/api.js";

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function normalizeArray(node) {
  if (!node) return [];
  return Array.isArray(node) ? node : [node];
}

async function fetchCategories() {
  const url = buildUrl("categories?display=full&output_format=JSON&limit=1000");
  const data = await fetchJson(url);
  const items = normalizeArray(data?.categories || data?.category);
  return items.filter((cat) => String(cat.id) !== "1" && String(cat.id) !== "2");
}

async function fetchProducts() {
  const url = buildUrl("products?display=full&output_format=JSON&limit=1000");
  const data = await fetchJson(url);
  const items = normalizeArray(data?.products || data?.product);
  return items;
}

async function fetchOrders() {
  const url = buildUrl("orders?display=full&output_format=JSON&limit=1000");
  const data = await fetchJson(url);
  const items = normalizeArray(data?.orders || data?.order);
  return items;
}

async function fetchStockAvailables() {
  const url = buildUrl(
    "stock_availables?display=full&output_format=JSON&limit=1000",
  );
  const data = await fetchJson(url);
  return normalizeArray(data?.stock_availables || data?.stock_available);
}

export async function fetchCategoryProfitStats() {
  const [categories, products, orders, stocks] = await Promise.all([
    fetchCategories(),
    fetchProducts(),
    fetchOrders(),
    fetchStockAvailables(),
  ]);

  const productsById = new Map();
  products.forEach((product) => {
    productsById.set(Number(product.id), product);
  });

  const ordersFiltered = orders.filter((order) => Number(order.current_state) !== 6);

  const reservedMap = new Map();
  const soldMap = new Map();

  ordersFiltered.forEach((order) => {
    const rows = normalizeArray(order?.associations?.order_rows);
    rows.forEach((row) => {
      const productId = Number(row.product_id || 0);
      const qty = Number(row.product_quantity || 0);
      if (!productId || !qty) return;

      if (Number(order.current_state) === 2) {
        reservedMap.set(productId, (reservedMap.get(productId) || 0) + qty);
      } else if (Number(order.current_state) === 5) {
        soldMap.set(productId, (soldMap.get(productId) || 0) + qty);
      }
    });
  });

  let totalSalesHT = 0;
  let totalPurchaseHT = 0;
  const salesByCat = new Map();
  const purchaseByCat = new Map();
  const benefitByCat = new Map();

  ordersFiltered.forEach((order) => {
    totalSalesHT += Number(order.total_products || 0);

    const rows = normalizeArray(order?.associations?.order_rows);
    rows.forEach((row) => {
      const product = productsById.get(Number(row.product_id || 0));
      if (!product) return;

      const qty = Number(row.product_quantity || 0);
      const unitPurchase = Number(product.wholesale_price || 0);
      const unitSale =
        Number(row.unit_price_tax_excl || 0) ||
        Number(row.product_price || 0);

      const totalRowPurchase = unitPurchase * qty;
      const totalRowSale = unitSale * qty;
      const totalRowBenefit = totalRowSale - totalRowPurchase;

      totalPurchaseHT += totalRowPurchase;

      const catId = Number(product.id_category_default || 0);
      salesByCat.set(catId, (salesByCat.get(catId) || 0) + totalRowSale);
      purchaseByCat.set(catId, (purchaseByCat.get(catId) || 0) + totalRowPurchase);
      benefitByCat.set(catId, (benefitByCat.get(catId) || 0) + totalRowBenefit);
    });
  });

  const stats = [];
  let totalStockPurchaseHT = 0;

  categories.forEach((cat) => {
    const catId = Number(cat.id);
    let catPhysical = 0;
    let catReserved = 0;
    let catAvailable = 0;
    let catTotalStockPurchaseHT = 0;

    const catProducts = products.filter(
      (product) => Number(product.id_category_default || 0) === catId,
    );

    catProducts.forEach((product) => {
      const wholesalePrice = Number(product.wholesale_price || 0);
      const rootStock = stocks.find(
        (stock) =>
          Number(stock.id_product) === Number(product.id) &&
          Number(stock.id_product_attribute || 0) === 0,
      );

      const available = Number(rootStock?.quantity || 0);
      const reserved = reservedMap.get(Number(product.id)) || 0;
      const sold = soldMap.get(Number(product.id)) || 0;
      const physical = available + reserved;
      const inserted = physical + sold;

      catAvailable += available;
      catReserved += reserved;
      catPhysical += physical;
      catTotalStockPurchaseHT += inserted * wholesalePrice;
      totalStockPurchaseHT += inserted * wholesalePrice;
    });
    const beneficeCategorie = salesByCat.get(catId) - catTotalStockPurchaseHT;

    stats.push({
      id: catId,
      name: String(cat.name || `Categorie #${catId}`),
      physicalQty: catPhysical,
      reservedQty: catReserved,
      availableQty: catAvailable,
      salesHT: salesByCat.get(catId) || 0,
      purchaseHT: purchaseByCat.get(catId) || 0,
      totalStockPurchaseHT: catTotalStockPurchaseHT,
    //   benefit: beneficeCategorie,
        benefit: benefitByCat.get(catId) || 0,
    });
  });

  return {
    totals: {
      salesHT: totalSalesHT,
      purchaseHT: totalPurchaseHT,
      totalStockPurchaseHT,
      benefit: totalSalesHT - totalStockPurchaseHT,
    },
    categories: stats.sort((a, b) => b.benefit - a.benefit),
  };
}

export default {
  fetchCategoryProfitStats,
};
