import { buildUrl, fetchXmlResponse } from "./config/api";
import { xmlToJson } from "../utils/xml.convert";

/**
 * Utilitaire pour extraire le texte des nœuds XML
 */
function getText(node) {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "object") {
    if (node._text) return String(node._text);
    if (node["#text"]) return String(node["#text"]);
  }
  return String(node);
}

/**
 * Envoie une requête XML (PUT ou POST) vers PrestaShop
 */
async function sendXml(endpoint, method, xmlData) {
  const url = buildUrl(endpoint);
  const res = await fetch(url, {
    method: method,
    headers: { "Content-Type": "application/xml" },
    body: xmlData,
  });

  if (!res.ok) {
    const errText = await res.text();
    // AFFICHER CECI DANS LA CONSOLE POUR VOIR LE MESSAGE PRESTASHOP
    console.error("Détails de l'erreur PrestaShop:", errText);
    throw new Error(`Erreur ${method} XML (${res.status})`);
  }
  return res.text();
}

/**
 * Met à jour le stock disponible ET crée un mouvement de stock
 */
export async function updateProductStock(
  productId,
  idAttribute,
  deltaQuantity,
) {
  // --- ÉTAPE 1 : Récupérer les infos de stock actuel ---
  const getUrl = buildUrl(
    `stock_availables?filter[id_product]=[${productId}]&filter[id_product_attribute]=[${idAttribute}]&display=full`,
  );
  const xmlResponse = await fetch(getUrl);
  const xmlText = await xmlResponse.text();
  const data = xmlToJson(xmlText);

  const root = data?.prestashop || data;
  let stockEntry = root?.stock_availables?.stock_available;
  if (Array.isArray(stockEntry)) stockEntry = stockEntry[0];

  if (!stockEntry) throw new Error("Stock introuvable pour ce produit");

  const stockId = getText(stockEntry.id);
  // const idAttribute = getText(stockEntry.id_product_attribute);
  const currentQty = parseInt(getText(stockEntry.quantity) || 0);
  const newQty = currentQty + deltaQuantity;

  // --- ÉTAPE 2 : Mise à jour de la quantité (PUT stock_availables) ---
  const xmlUpdate = `<?xml version="1.0" encoding="UTF-8"?>
  <prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
    <stock_available>
      <id>${stockId}</id>
      <id_product>${productId}</id_product>
      <id_product_attribute>${idAttribute}</id_product_attribute>
      <id_shop>${getText(stockEntry.id_shop)}</id_shop>
      <id_shop_group>${getText(stockEntry.id_shop_group)}</id_shop_group>
      <quantity>${newQty}</quantity>
      <depends_on_stock>0</depends_on_stock>
      <out_of_stock>2</out_of_stock>
    </stock_available>
  </prestashop>`;

  await sendXml(`stock_availables/${stockId}`, "PUT", xmlUpdate);

  // --- ÉTAPE 3 : Création du mouvement de stock (POST stock_movements) ---
  // On ne crée un mouvement que si la variation n'est pas nulle
  if (deltaQuantity !== 0) {
    // Générer la date actuelle au format PrestaShop (YYYY-MM-DD HH:mm:ss)
    const now = new Date().toISOString().replace("T", " ").split(".")[0];

    const xmlMvt = `<?xml version="1.0" encoding="UTF-8"?>
  <prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
    <stock_movement>
      <id_product>${productId}</id_product>
      <id_product_attribute>${idAttribute || 0}</id_product_attribute>
      <id_warehouse>1</id_warehouse>
      <id_currency>1</id_currency>
      <id_stock_mvt_reason>1</id_stock_mvt_reason> 
      <id_employee>1</id_employee>
      <physical_quantity>${Math.abs(deltaQuantity)}</physical_quantity>
      <sign>${deltaQuantity > 0 ? 1 : -1}</sign>
      <price_te>0.000000</price_te>
      <date_add>${now}</date_add> 
      <id_stock>${stockId}</id_stock>
    </stock_movement>
  </prestashop>`;

    await sendXml("stock_movements", "POST", xmlMvt);
  }

  return true;
}

/**
 * Récupère les mouvements de stock filtrés par produit ET par date
 */
export async function fetchStockDailyEvolution(
  productId,
  dateInf,
  dateSup,
  attributeId = 0,
) {
  try {
    let stockIds = [];

    if (attributeId && String(attributeId) !== "0") {
      const stockId = await getStockIdByProduct(productId, attributeId);

      if (stockId && stockId !== "0") {
        stockIds = [String(stockId)];
      }
    }
    else {
      const stockUrl = buildUrl(
        `stock_availables?filter[id_product]=[${productId}]&display=[id]`,
      );

      const stockXml = await fetchXmlResponse(stockUrl);
      const stockData = xmlToJson(stockXml);

      let stocks = stockData.stock_availables.stock_available || [];

      if (!Array.isArray(stocks)) {
        stocks = [stocks];
      }

      stockIds = stocks.map((s) => String(getText(s.id)));
    }

    const url = buildUrl(`stock_movements?display=full&limit=1000`);
    const xml = await fetchXmlResponse(url);
    const data = xmlToJson(xml);
    let allMovements = data.stock_mvts.stock_mvt || [];
    if (!Array.isArray(allMovements)) {
      allMovements = [allMovements];
    }

    const filteredMovements = allMovements
      .filter((mv) => {
        const mvStockId = String(getText(mv.id_stock));

        const fullDate = getText(mv.date_add) || "";
        const dateOnly = fullDate.split(" ")[0];

        const isCorrectStock = stockIds.includes(mvStockId);

        const isInRange =
          (!dateInf || dateOnly >= dateInf) &&
          (!dateSup || dateOnly <= dateSup);

        return isCorrectStock && isInRange;
      })
      .map((mv) => {
        const qty = parseInt(getText(mv.physical_quantity) || 0);

        const sign = parseInt(getText(mv.sign) || 1);

        return {
          id: getText(mv.id),
          id_stock: getText(mv.id_stock),
          date: getText(mv.date_add),
          variation: qty * sign,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    return filteredMovements;
  } catch (error) {
    console.error("Erreur historique stock:", error);
    return [];
  }
}

/**
 * Récupère l'id_stock technique lié à un produit (ps_stock)
 * @param {string|number} productId - L'ID du produit
 * @param {string|number} idAttribute - L'ID de la déclinaison (0 par défaut)
 * @returns {Promise<string>} - L'ID du stock ou "0" si non trouvé
 */
export async function getStockIdByProduct(productId, idAttribute = "0") {
  try {
    // On filtre par produit et par déclinaison pour obtenir la ligne de stock précise
    const url = buildUrl(
      `stock_availables?filter[id_product]=[${productId}]&filter[id_product_attribute]=[${idAttribute}]&display=[id]`,
    );

    const response = await fetch(url);
    if (!response.ok) return "0";

    const xmlText = await response.text();
    const data = xmlToJson(xmlText);
    // console.log(data);

    // Extraction de l'ID depuis la structure XML convertie
    const stockNode = data.stock_availables.stock_available;

    // Si plusieurs résultats (rare avec ces filtres), on prend le premier
    if (Array.isArray(stockNode)) {
      return getText(stockNode[0].id) || "0";
    }

    return getText(stockNode?.id) || "0";
  } catch (error) {
    console.error("Erreur lors de la récupération de l'id_stock:", error);
    return "0";
  }
}

export async function fetchProductsWithCombinations() {
  try {
    // Produits
    const productUrl = buildUrl(`products?display=[id,name,reference]`);

    const productXml = await fetchXmlResponse(productUrl);
    const productData = xmlToJson(productXml);

    let products = productData.products.product || [];

    if (!Array.isArray(products)) {
      products = [products];
    }

    // Combinaisons
    const combUrl = buildUrl(`combinations?display=full&limit=1000`);

    const combXml = await fetchXmlResponse(combUrl);
    const combData = xmlToJson(combXml);

    let combinations = combData.combinations?.combination || [];

    if (!Array.isArray(combinations)) {
      combinations = [combinations];
    }

    const result = [];

    for (const p of products) {
      const productId = getText(p.id);

      const productName = getText(p.name?.language) || getText(p.name);

      // Produit simple
      result.push({
        value: `${productId}`,
        label: `${productName} (#${productId})`,
        productId,
        attributeId: 0,
      });

      // Combinaisons liées
      const relatedCombs = combinations.filter(
        (c) => getText(c.id_product) === productId,
      );

      for (const comb of relatedCombs) {
        const attributeId = getText(comb.id);

        let attrs =
          comb.associations?.product_option_values?.product_option_value;

        if (!attrs) continue;

        if (!Array.isArray(attrs)) {
          attrs = [attrs];
        }

        const attrLabels = attrs.map((a) => getText(a.id)).join(", ");

        result.push({
          value: `${productId}:${attributeId}`,
          label: `${productName} - ${attrLabels}`,
          productId,
          attributeId,
        });
      }
    }

    return result;
  } catch (err) {
    console.error("Erreur chargement produits:", err);
    return [];
  }
}
