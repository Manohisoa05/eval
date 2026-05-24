import { fetchWithCache, clearCache } from "../utils/apiCache.js";
import { xmlToJson } from "../utils/xml.convert.js";
import { buildUrl, fetchXmlResponse, CACHE_TTL } from "./config/api.js";

function calculateTtc(priceHt, taxRate) {
  return Number(
    (Number(priceHt || 0) * (1 + Number(taxRate || 0) / 100)).toFixed(2),
  );
}

function extractText(node) {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "boolean")
    return String(node);
  if (typeof node === "object") {
    if (node._text) return String(node._text);
    if (node["#text"]) return String(node["#text"]);
    if (node.language) return extractText(node.language);
  }
  return "";
}

function getProductName(product) {
  return extractText(product?.name) || "Sans nom";
}

function getImageId(product) {
  const imagesNode = product?.associations?.images?.image;
  if (!imagesNode) return "";
  if (Array.isArray(imagesNode)) {
    const first = imagesNode[0];
    return extractText(first?.id || first);
  }
  return extractText(imagesNode?.id || imagesNode);
}

export async function fetchProducts() {
  const url = buildUrl(`products?output_format=XML&display=full`);
  return fetchWithCache(url, async () => fetchXmlResponse(url), CACHE_TTL); // On ignore fetchWithCache pour tester
}

export async function fetchProduct(idProduct) {
  const id =
    idProduct && typeof idProduct === "object"
      ? (idProduct.id ?? idProduct["@id"] ?? null)
      : idProduct;

  const url = buildUrl(`products/${id}?output_format=XML&display=full`);
  return fetchWithCache(url, async () => fetchXmlResponse(url), CACHE_TTL);
}

export async function fetchProductsDetailed() {
  const xml = await fetchProducts();
  if (!xml) return [];
  let parsed = null;
  try {
    parsed = xmlToJson(xml);
  } catch (error) {
    console.error("Error parsing XML:", error);
  }
  return parsed;
}

export async function fetchProductsMapped() {
  try {
    const xml = await fetchProducts();
    const parsed = xmlToJson(xml);
    const root = parsed?.prestashop ? parsed.prestashop : parsed;
    const productsNode = root?.products?.product;
    if (!productsNode) {
      console.warn("Structure XML incorrecte ou vide");
      return [];
    }

    const items = Array.isArray(productsNode) ? productsNode : [productsNode];
    return await Promise.all(
      items.map(async (p) => {
        const id = extractText(p.id);
        const name = getProductName(p);
        const imageId = getImageId(p);
        const category = await getCategoryName(p.id_category_default);
        const date_availability_produit = extractText(p.available_date);
        const imageUrl =
          id && imageId ? buildUrl(`images/products/${id}/${imageId}`) : null;
        const priceHt = parseFloat(extractText(p.price)) || 0;
        const taxRulesGroupId = extractText(p.id_tax_rules_group);
        const taxRate = await getTaxRateByGroupId(taxRulesGroupId);
        const priceTtc = calculateTtc(priceHt, taxRate);
        return {
          id,
          name,
          category,
          date_availability_produit,
          price_ht: parseFloat(extractText(p.price)) || 0,
          price_ttc: parseFloat(extractText(priceTtc)) || 0, // IMPORTANT
          image: imageUrl,
        };
      }),
    );
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function fetchProductDetailed(idProduct) {
  const xml = await fetchProduct(idProduct);
  if (!xml) return null;
  let parsed = null;
  try {
    parsed = xmlToJson(xml);
  } catch (error) {
    console.error("Error parsing XML:", error);
  }
  return parsed;
}

export async function fetchProductMapped(idProduct) {
  try {
    const xml = await fetchProduct(idProduct);
    const parsed = xmlToJson(xml);
    const root = parsed?.prestashop ? parsed.prestashop : parsed;
    const productNode = root?.product || root?.products?.product;

    if (!productNode) {
      console.warn("Structure XML incorrecte ou vide");
      return null;
    }

    const product = Array.isArray(productNode) ? productNode[0] : productNode;
    const id = extractText(product.id);
    const name = getProductName(product);
    const imageId = getImageId(product);
    const imageUrl =
      id && imageId ? buildUrl(`images/products/${id}/${imageId}`) : null;

    // --- GESTION DES PRIX DE BASE ---
    const basePriceHt = parseFloat(extractText(product.price)) || 0;
    const taxRulesGroupId = extractText(product.id_tax_rules_group);
    const taxRate = await getTaxRateByGroupId(taxRulesGroupId);
    const basePriceTtc = calculateTtc(basePriceHt, taxRate);

    const quantityInStock = (await getQuantityByProduct(id, 0)) || 0;
    let attributes = [];

    // --- GESTION DES DÉCLINAISONS ---
    const associations = product?.associations?.combinations?.combination;
    if (associations) {
      const combinations = Array.isArray(associations)
        ? associations
        : [associations];

      for (const comb of combinations) {
        const combinationId = extractText(comb.id);
        const combXml = await fetchXmlResponse(
          buildUrl(
            `combinations/${combinationId}?display=full&output_format=XML`,
          ),
        );
        const combParsed = xmlToJson(combXml);
        const combRoot = combParsed?.prestashop || combParsed;
        const combination = combRoot?.combination;

        if (!combination) continue;

        // 1. Calcul du prix final (Base + Impact)
        const impactHt = parseFloat(extractText(combination.price)) || 0;
        const finalPriceHt = basePriceHt + impactHt;
        const finalPriceTtc = calculateTtc(finalPriceHt, taxRate);

        // 2. Récupération robuste des attributs (Taille, Couleur...)
        const attrAssociations =
          combination?.associations?.product_option_values;
        // On cherche 'product_option_value' ou on prend le parent si le XML est simplifié
        let rawValues =
          attrAssociations?.product_option_value || attrAssociations;

        if (!rawValues) {
          console.log(
            "Aucun attribut trouvé pour la combinaison ID:",
            combinationId,
          );
          continue;
        }

        // On force le format tableau
        const optionValuesList = Array.isArray(rawValues)
          ? rawValues
          : [rawValues];
        const attributeNames = [];

        for (const val of optionValuesList) {
          // On extrait l'ID (parfois val.id, parfois val directement)
          const optionId = extractText(val.id || val);
          if (!optionId) continue;

          try {
            const optionXml = await fetchXmlResponse(
              buildUrl(`product_option_values/${optionId}`),
            );
            const optionParsed = xmlToJson(optionXml);
            const optionData =
              optionParsed?.prestashop?.product_option_value ||
              optionParsed?.product_option_value;

            const attrName = extractText(
              optionData?.name?.language || optionData?.name,
            );
            if (attrName) attributeNames.push(attrName);
          } catch (err) {
            console.error(`Erreur sur l'option ${optionId}:`, err);
          }
        }

        const stock = (await getQuantityByProduct(id, combinationId)) || 0;

        attributes.push({
          combinationId: String(combinationId),
          name:
            attributeNames.length > 0 ? attributeNames.join(" / ") : "Standard",
          stock: Number(stock),
          price: Number(finalPriceTtc), // Clé principale pour panier.js
          price_ht: Number(finalPriceHt),
          price_ttc: Number(finalPriceTtc),
        });
      }
    }

    // --- RETOUR DE L'OBJET MAPPÉ ---
    return {
      id,
      name,
      price: Number(basePriceTtc), // Clé principale pour panier.js
      price_ht: Number(basePriceHt),
      price_ttc: Number(basePriceTtc),
      description:
        extractText(product.description_short) ||
        extractText(product.description),
      image: imageUrl,
      quantityInStock: Number(quantityInStock),
      attributes: attributes,
    };
  } catch (error) {
    console.error("Erreur fetchProductMapped:", error);
    return null;
  }
}

export async function getQuantityByProduct(productId, attributeId = 0) {
  try {
    const url = buildUrl(
      `stock_availables?filter[id_product]=[${productId}]&filter[id_product_attribute]=[${attributeId}]&display=[quantity]`,
    );

    const xml = await fetchXmlResponse(url);

    const parsed = xmlToJson(xml);

    let stock = parsed?.stock_availables?.stock_available;

    if (Array.isArray(stock)) {
      stock = stock[0];
    }

    return parseInt(extractText(stock?.quantity) || 0);
  } catch {
    return 0;
  }
}

export function getMark(date) {
  const mark = { text: "", color: "" };
  const today = new Date();
  const targetDate = new Date(date);

  if (isNaN(targetDate.getTime())) {
    return { text: "AVAILABLE", color: "badge-new bg-primary" };
  }

  const hoursDiff = getHoursDiff(today, targetDate);
  const daysDiff = hoursDiff / 24;

  if (hoursDiff <= 24) {
    mark.text = "HOT";
    mark.color = "badge-new bg-danger";
  } else if (daysDiff <= 7) {
    mark.text = "NEW";
    mark.color = "badge-new bg-warning";
  } else {
    mark.text = "AVAILABLE";
    mark.color = "badge-new bg-primary";
  }
  return mark;
}

function getHoursDiff(date1, date2) {
  const diffInMs = Math.abs(date1 - date2);
  return diffInMs / (1000 * 60 * 60);
}

function fetchCategories() {
  const url = buildUrl(`categories?output_format=XML&display=full`);
  return fetchWithCache(url, async () => fetchXmlResponse(url), CACHE_TTL);
}

async function fetchCategoriesMapped() {
  const xml = await fetchCategories();
  const parsed = xmlToJson(xml);

  const root = parsed?.prestashop ? parsed.prestashop : parsed;
  const categoriesNode = root?.categories?.category;
  if (!categoriesNode) {
    console.warn("Structure XML incorrecte ou vide pour les catégories");
    return [];
  }
  const items = Array.isArray(categoriesNode)
    ? categoriesNode
    : [categoriesNode];
  return items.map((cat) => ({
    id: extractText(cat.id),
    name: extractText(cat.name) || "Sans nom",
  }));
}

async function getCategoryName(idCategory) {
  const categories = await fetchCategoriesMapped();

  const category = categories.find(
    (cat) => extractText(cat.id) === extractText(idCategory),
  );

  return category ? extractText(category.name) : "Inconnu";
}

async function getTaxRateByGroupId(taxRulesGroupId) {
  if (!taxRulesGroupId || Number(taxRulesGroupId) === 0) {
    return 0;
  }

  try {
    // Récupération règle taxe
    const ruleXml = await fetchXmlResponse(
      buildUrl(
        `tax_rules?filter[id_tax_rules_group]=[${taxRulesGroupId}]&display=full`,
      ),
    );

    const ruleData = xmlToJson(ruleXml);

    let rule =
      ruleData?.prestashop?.tax_rules?.tax_rule ||
      ruleData?.tax_rules?.tax_rule;

    if (Array.isArray(rule)) {
      rule = rule[0];
    }

    if (!rule) return 0;

    const taxId = extractText(rule.id_tax);

    // Récupération taxe
    const taxXml = await fetchXmlResponse(
      buildUrl(`taxes/${taxId}?display=full`),
    );

    const taxData = xmlToJson(taxXml);

    const tax = taxData?.prestashop?.tax || taxData?.tax;

    return parseFloat(extractText(tax.rate)) || 0;
  } catch (e) {
    console.error("Erreur récupération TVA :", e);
    return 0;
  }
}

// produit.js

export async function getProductCombinations(productId, taxRate, basePriceHt) {
  try {
    const xml = await fetchXmlResponse(
      buildUrl(
        `combinations?filter[id_product]=[${productId}]&display=full&output_format=XML`,
      ),
    );

    const data = xmlToJson(xml);
    let combinations =
      data?.prestashop?.combinations?.combination ||
      data?.combinations?.combination ||
      [];

    if (!Array.isArray(combinations)) {
      combinations = [combinations];
    }

    const result = [];
    for (const comb of combinations) {
      const combinationId = extractText(comb.id);

      // 1. Calcul du prix : Base HT + Impact HT, puis passage en TTC
      const impactHt = parseFloat(extractText(comb.price)) || 0;
      const finalPriceTtc = calculateTtc(basePriceHt + impactHt, taxRate);

      // 2. Récupération des noms (ex: "S" ou "Rouge")
      let optionValues =
        comb.associations?.product_option_values?.product_option_value;
      if (!Array.isArray(optionValues))
        optionValues = optionValues ? [optionValues] : [];

      const names = [];
      for (const ov of optionValues) {
        const ovId = extractText(ov.id);
        const ovXml = await fetchXmlResponse(
          buildUrl(`product_option_values/${ovId}`),
        );
        const ovData = xmlToJson(ovXml);
        const name = extractText(
          ovData?.prestashop?.product_option_value?.name?.language ||
            ovData?.product_option_value?.name?.language,
        );
        if (name) names.push(name);
      }

      result.push({
        combinationId: String(combinationId),
        name: names.join(" / "),
        price: Number(finalPriceTtc), // Clé 'price' pour la cohérence
        price_ttc: Number(finalPriceTtc),
        stock: 0, // Sera mis à jour par getQuantityByProduct si nécessaire
      });
    }

    return result;
  } catch (e) {
    console.error("Erreur combinaisons :", e);
    return [];
  }
}

// Pense à mettre à jour fetchProductMapped pour passer les arguments :
// attributes: await getProductCombinations(id, taxRate, basePriceHt)

export default {
  fetchProducts,
  fetchProduct,
  fetchProductsDetailed,
  fetchProductsMapped,
  fetchProductDetailed,
  fetchProductMapped,
};
