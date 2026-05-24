import { buildUrl, fetchXmlResponse } from "./config/api.js";
import { xmlToJson } from "../utils/xml.convert.js";

/**
 * Utilitaire pour extraire proprement le texte d'un noeud XML (gère les langages)
 */
function getText(node) {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "object") {
    if (node._text) return String(node._text);
    if (node["#text"]) return String(node["#text"]);
    if (node.language) return getText(node.language);
  }
  return String(node);
}

/**
 * Récupère tous les produits avec leurs détails complets
 */
export async function fetchProductsMapped() {
  try {
    const url = buildUrl("products?display=full&output_format=XML");
    const xml = await fetchXmlResponse(url);
    const data = xmlToJson(xml);

    const products =
      data?.prestashop?.products?.product || data?.products?.product;
    const productArray = Array.isArray(products)
      ? products
      : products
        ? [products]
        : [];

    const fullMappedList = [];

    for (const p of productArray) {
      const productId = getText(p.id);
      const productName = getText(p.name);
      const basePrice = parseFloat(getText(p.price) || 0);

      // On vérifie s'il y a des déclinaisons (associations.combinations)
      const combinations = p.associations?.combinations?.combination;

      if (!combinations) {
        // CAS 1 : PRODUIT SIMPLE (Pas de déclinaison)
        const stock = await getStockQuantityByProduct(productId, "0");
        fullMappedList.push({
          id: productId,
          id_attribute: "0",
          name: productName,
          reference: getText(p.reference),
          price: basePrice.toFixed(2),
          stock: stock,
          is_combination: false,
        });
      } else {
        // CAS 2 : PRODUIT AVEC DÉCLINAISONS
        const comboArray = Array.isArray(combinations)
          ? combinations
          : [combinations];

        // On récupère les détails de chaque déclinaison en parallèle
        const comboData = await Promise.all(
          comboArray.map(async (c) => {
            const idCombo = getText(c.id);
            return await getCombinationDetails(
              productId,
              productName,
              idCombo,
              basePrice,
            );
          }),
        );

        fullMappedList.push(...comboData);
      }
    }
    return fullMappedList;
  } catch (error) {
    console.error("Erreur fetch complet:", error);
    return [];
  }
}

async function getCombinationDetails(
  productId,
  productName,
  comboId,
  basePrice,
) {
  try {
    const url = buildUrl(`combinations/${comboId}`);
    const xml = await fetchXmlResponse(url);
    const data = xmlToJson(xml);
    const combo = data?.prestashop?.combination;

    // Calcul du prix : Prix de base + impact prix de la déclinaison
    const priceImpact = parseFloat(getText(combo?.price) || 0);
    const finalPrice = basePrice + priceImpact;

    // Récupération du stock spécifique à cette déclinaison
    const stock = await getStockQuantityByProduct(productId, comboId);

    return {
      id: productId,
      id_attribute: comboId,
      name: productName,
      comboId: comboId,
      reference: getText(combo?.reference),
      price: finalPrice.toFixed(2),
      stock: stock,
      is_combination: true,
    };
  } catch (e) {
    return {
      id: productId,
      id_attribute: comboId,
      name: productName,
      price: basePrice.toFixed(2),
      stock: 0,
    };
  }
}

/**
 * Récupère un produit spécifique par son ID
 */
export async function fetchProductMapped(productId) {
  try {
    const url = buildUrl(`products/${productId}?output_format=XML`);
    const xml = await fetchXmlResponse(url);
    const data = xmlToJson(xml);
    const p = data?.prestashop?.product;

    if (!p) return null;

    return {
      id: getText(p.id),
      name: getText(p.name),
      price: parseFloat(getText(p.price) || 0).toFixed(2),
      description: getText(p.description),
      description_short: getText(p.description_short),
      reference: getText(p.reference),
      stock: parseInt(
        getText(p.associations?.stock_availables?.stock_available?.quantity) ||
          0,
      ),
      image: buildUrl(
        `images/products/${getText(p.id)}/${getText(p.id_default_image)}`,
      ),
    };
  } catch (error) {
    console.error(`Erreur fetchProductMapped (${productId}):`, error);
    return null;
  }
}

/**
 * Récupère les produits d'une catégorie spécifique
 */
export async function fetchProductsByCategory(categoryId) {
  const all = await fetchProductsMapped();
  return all.filter((p) => p.id_category_default === String(categoryId));
}

/**
 * Calcule une note factice ou récupère une donnée personnalisée (optionnel)
 */
export function getMark(id) {
  // Logique métier si vous avez un système de notes, sinon retourne une valeur fixe
  const marks = { 1: 4.5, 2: 3.8, 3: 5.0 };
  return marks[id] || 4.0;
}

export async function getStockQuantityByProduct(
  productId,
  combinationId = null,
) {
  try {
    const url = buildUrl(
      `stock_availables?filter[id_product]=[${productId}]&filter[id_product_attribute]=[${combinationId}]&display=[quantity]`,
    );
    const xml = await fetchXmlResponse(url);
    const data = xmlToJson(xml);
    const stockAvailables = data.stock_availables.stock_available;
    // console.log("Stock available data:", stockAvailables);
    if (stockAvailables) {
      const stock = Array.isArray(stockAvailables)
        ? stockAvailables[0]
        : stockAvailables;
      // console.log("Stock trouvé:", stock.quantity);
      return getText(stock.quantity);
    }
    return "0";
  } catch (error) {
    console.error("Erreur getStockQuantityByProduct:", error);
    return "0";
  }
}

export default {
  fetchProductsMapped,
  fetchProductMapped,
  fetchProductsByCategory,
  getMark,
  getStockQuantityByProduct,
};
