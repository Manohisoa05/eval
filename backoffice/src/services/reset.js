import { buildUrl, fetchXmlResponse } from "./config/api.js";
import { xmlToJson } from "../utils/xml.convert.js";

export const RESET_ENTITIES = [
  { key: "products", label: "Produits" },
  { key: "categories", label: "Categories" },
  { key: "customers", label: "Clients" },
  { key: "addresses", label: "Adresses" },
  { key: "orders", label: "Commandes" },
  { key: "order_histories", label: "Commandes historiques" },
  { key: "carts", label: "Panier" },
  // { key: "stock_availables", label: "Stocks" },
  { key: "stock_movements", label: "Mouvements de stock" },
  { key: "taxes", label: "Taxes" },
  { key: "tax_rules", label: "Règles de taxe" },
  { key: "tax_rule_groups", label: "Groupes de règles de taxe" },
  //   { key: "manufacturers", label: "Marques" },
  //   { key: "suppliers", label: "Fournisseurs" },
  //   { key: "aliases", label: "Alias" },
  //   { key: "stores", label: "Magasins" },
  //   { key: "combinations", label: "Declinaisons" },
  //   { key: "supply_orders", label: "Commandes fournisseur" },
  //   { key: "supply_order_details", label: "Details commandes fournisseur" },
];

const ENTITY_SINGULAR = {
  products: "product",
  categories: "category",
  customers: "customer",
  addresses: "address",
  orders: "order",
  order_histories: "order_history",
  carts: "cart",
  stock_availables: "stock_available",
  stock_mvts: "stock_mvt",
  taxes: "tax",
  tax_rules: "tax_rule",
  tax_rule_groups: "tax_rule_group",
  manufacturers: "manufacturer",
  suppliers: "supplier",
  aliases: "alias",
  stores: "store",
  combinations: "combination",
  supply_orders: "supply_order",
  supply_order_details: "supply_order_detail",
};

function toArray(node) {
  if (!node) return [];
  return Array.isArray(node) ? node : [node];
}

function extractIdMvtStock(parsed) {
  const root = parsed || {};
  const rows = toArray(root?.stock_mvts?.stock_mvt);
  return rows
    .map((row) => {
      const idNode = row?.id;
      if (idNode && typeof idNode === "object") {
        return idNode._text || idNode["#text"] || idNode.id;
      }
      return idNode;
    })
    .filter((id) => id !== undefined && id !== null && String(id).trim() !== "")
    .map((id) => String(id).trim());
}

function extractIdsFromList(parsed, entity) {
  const singular = ENTITY_SINGULAR[entity] || entity.replace(/s$/, "");
  const root = parsed;
  const container = root[entity];

  if (entity !== "stock_movements") {
    if (!container) return [];

    const rows = toArray(container[singular] || container);

    return rows
      .map((row) => {
        if (!row) return null;

        const idNode = row.id;
        if (idNode && typeof idNode === "object") {
          return idNode._text || idNode["#text"] || idNode.id;
        }
        return idNode;
      })
      .filter(
        (id) => id !== undefined && id !== null && String(id).trim() !== "",
      )
      .map((id) => String(id).trim());
  }
  const ids = extractIdMvtStock(parsed);
  return ids;
}

export async function fetchEntityIds(entity) {
  const url = buildUrl(`${entity}?output_format=XML&display=full`);
  const xml = await fetchXmlResponse(url);
  let parsed = null;
  try {
    parsed = xmlToJson(xml);
  } catch (e) {
    return [];
  }
  const ids = extractIdsFromList(parsed, entity);
  return ids;
}

export async function resetEntity(entity, options = {}) {
  const ids = await fetchEntityIds(entity);
  const results = [];
  const normalizedEntity = entity.toLowerCase().trim();

  for (const id of ids) {
    if (
      (normalizedEntity === "categories" || normalizedEntity === "category") &&
      (id == 1 || id == 2)
    ) {
      console.warn(
        `[SÉCURITÉ] Saut de la suppression pour ${entity} #${id} (Catégorie parente PrestaShop protégée)`,
      );
      continue;
    }
    const url = buildUrl(`${entity}/${id}`);
    try {
      const response = await fetch(url, {
        method: "DELETE",
        headers: { Accept: "application/xml" },
        credentials: "include",
      });

      const text = await response.text();
      if (!response.ok) {
        const err = new Error(`Reset échoué pour ${entity} #${id}`);
        err.details = text;
        err.entity = entity;
        err.id = id;
        throw err;
      }

      results.push({ id, responseText: text });
    } catch (error) {
      console.error(`Erreur réseau ou API pour ${entity} #${id}:`, error);
      throw error;
    }
  }
  return { count: results.length, results };
}

export async function resetEntities(entities, options = {}) {
  const results = [];
  for (const entity of entities) {
    const res = await resetEntity(entity, options);
    results.push({ entity, ...res });
  }
  return results;
}
