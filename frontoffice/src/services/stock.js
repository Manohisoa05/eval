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
 * Récupère l'id_stock technique lié à un produit (ps_stock)
 * @param {string|number} productId - L'ID du produit
 * @param {string|number} idAttribute - L'ID de la déclinaison (0 par défaut)
 * @returns {Promise<string>} - L'ID du stock ou "0" si non trouvé
 */
export async function getStockIdByProduct(productId, idAttribute = "0") {
  try {
    // On filtre par produit et par déclinaison pour obtenir la ligne de stock précise
    const url = buildUrl(
      `stock_availables?filter[id_product]=[${productId}]&filter[id_product_attribute]=[${idAttribute}]&display=full`,
    );

    const response = await fetch(url);
    if (!response.ok) return "0";

    const xmlText = await response.text();
    const data = xmlToJson(xmlText);

    // Extraction de l'ID depuis la structure XML convertie
    const stockNode = data.stock_availables.stock_available;

    // Si plusieurs résultats (rare avec ces filtres), on prend le premier
    if (Array.isArray(stockNode)) {
      return getText(stockNode[0].id) || "0";
    }

    return getText(stockNode?.quantity) || "0";
  } catch (error) {
    console.error("Erreur lors de la récupération de l'id_stock:", error);
    return "0";
  }
}
