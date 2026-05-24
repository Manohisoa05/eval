import { importCSV, csvToJson, jsonToXml } from "../utils/csv.import.js";
import { buildUrl, fetchXmlResponse } from "./config/api.js";
import { xmlToJson } from "../utils/xml.convert.js";
import { getEntityConfig, normalizeHeaderName } from "./config/importConfig.js";

function getText(node) {
  if (node == null) return "";
  if (
    typeof node === "string" ||
    typeof node === "number" ||
    typeof node === "boolean"
  )
    return String(node);
  if (typeof node === "object") {
    if (node._text) return String(node._text);
    if (node["#text"]) return String(node["#text"]);
  }
  return "";
}

export function mapCsvRowForEntity(entity, row, options = {}) {
  const config = getEntityConfig(entity);
  if (!config) throw new Error(`Entite non supportee: ${entity}`);

  const langId = options.languageId ?? 1;
  const keepUnknown =
    options.keepUnknown !== undefined
      ? options.keepUnknown
      : config.keepUnknown;
  const allowId = !!options.allowId;
  const baseSkip = options.skipFields || [];
  const skipFields = new Set([
    "id",
    "date_add",
    "date_upd",
    ...(config.skipFields || []),
    ...baseSkip,
  ]);
  const mapped = {};

  const normalizedMap = config.headerMapNormalized || {};
  Object.keys(row || {}).forEach((key) => {
    const normalizedKey = normalizeHeaderName(key);
    const target = normalizedMap[normalizedKey] || (keepUnknown ? key : null);
    if (!target) return;
    if (target === "id" && !allowId) return;
    if (skipFields.has(target)) return;
    mapped[target] = row[key];
    if (target.endsWith(".language") && String(row[key] || "").trim() !== "") {
      const idKey = `${target}@id`;
      if (mapped[idKey] === undefined) mapped[idKey] = String(langId);
    }
  });

  return mapped;
}

export async function importEntityFromCsv(entity, file, options = {}) {
  const config = getEntityConfig(entity);
  if (!config) throw new Error(`Entite non supportee: ${entity}`);
  if (!file) throw new Error("Fichier CSV manquant");

  const csv = await importCSV(file);
  const json = csvToJson(csv);

  // 2. VALIDER (Lèvera une exception si invalide)
  validateCsvData(entity, json);
  // Cette étape bloque la suite du script en cas d'erreur

  const rowMapper =
    options.rowMapper || ((row) => mapCsvRowForEntity(entity, row, options));
  const mapped = json.map(rowMapper);

  const required = options.requiredFields || config.requiredFields || [];
  const missingRequired = [];
  mapped.forEach((row, index) => {
    const isMissing = required.some((field) => {
      const val = row && row[field] != null ? String(row[field]).trim() : "";
      return !val;
    });
    if (isMissing) missingRequired.push(index + 1);
  });
  if (missingRequired.length) {
    throw new Error(
      `Champs requis manquants pour les lignes CSV: ${missingRequired.join(", ")}`,
    );
  }

  const url = buildUrl(config.endpoint);
  const results = [];
  for (let i = 0; i < mapped.length; i++) {
    const xml = jsonToXml([mapped[i]], {
      rootName: "prestashop",
      containerName: config.containerName,
      containerWhenMultiple: true,
      itemName: config.itemName,
      rootAttrs: { "xmlns:xlink": "http://www.w3.org/1999/xlink" },
      ...options,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
        Accept: "application/xml",
      },
      credentials: "include",
      body: xml,
    });

    const text = await response.text();
    if (!response.ok) {
      const err = new Error(`Import echoue (HTTP ${response.status})`);
      err.details = text;
      err.rowIndex = i + 1;
      err.requestXml = xml;
      throw err;
    }
    results.push({ rowIndex: i + 1, responseText: text, xml });
  }

  return { count: results.length, results };
}

const DEFAULTS = {
  id_lang: 1,
  id_shop: 1,
  id_shop_group: 1,
  id_currency: 1,
  id_country: 8,
  id_carrier: 1,
  id_tax_rules_group: 1,
  id_category_default: 2,
  id_category_parent: 2,
  id_employee: 1,
  conversion_rate: 1,
};

const ORDER_STATE_MAP = {
  "paiement accepte": 2,
  "paiement accepte ": 2,
  "paiement accepté": 2,
  "livre": 5,
  "livré": 5,
  "annule": 6,
  "annulé": 6,
};

function normalizeNumber(value) {
  const str = String(value || "")
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .replace(/%/g, "");
  const num = parseFloat(str);
  return Number.isFinite(num) ? num : null;
}

function formatPrice(value) {
  const num = normalizeNumber(value);
  if (num == null) return null;
  return num.toFixed(6);
}

function formatMoney(value) {
  const num = normalizeNumber(value === 0 ? "0" : value);
  const safe = Number.isFinite(num) ? num : 0;
  return safe.toFixed(6);
}

function toIsoDate(value) {
  const str = String(value || "").trim();
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parts = str.split("/");
  if (parts.length !== 3) return str;
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeRef(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function parsePurchases(raw) {
  const str = String(raw || "");
  const items = [];
  const regex = /\("([^"]+)";\s*([0-9]+)\s*;\s*"([^"]*)"\)/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    items.push({
      reference: match[1],
      quantity: parseInt(match[2], 10) || 0,
      attributeValue: match[3] || "",
    });
  }
  return items;
}

// Recherche de doublant
function mergePurchases(purchases) {
  const merged = new Map();

  for (const item of purchases || []) {
    const reference = String(item.reference || "").trim();
    const refKey = normalizeRef(reference);
    const attributeValue = String(item.attributeValue || "").trim();
    const attrKey = attributeValue.toLowerCase();
    const key = `${refKey}::${attrKey}`;
    const quantity = parseInt(item.quantity, 10) || 0;

    if (!merged.has(key)) {
      merged.set(key, {
        ...item,
        reference,
        attributeValue,
        quantity,
      });
      continue;
    }

    const existing = merged.get(key);
    existing.quantity += quantity;
  }

  return Array.from(merged.values()).filter((item) => item.quantity > 0);
}

function parseXmlId(xmlText) {
  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "application/xml");
    const idNode = xml.getElementsByTagName("id")[0];
    if (!idNode) return null;
    const val = parseInt(idNode.textContent, 10);
    return Number.isFinite(val) ? val : null;
  } catch (e) {
    return null;
  }
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function unwrapList(json, key) {
  if (!json) return [];
  const root = json[key] || json[`${key}s`] || json;
  if (Array.isArray(root)) return root;
  if (root && Array.isArray(root[key])) return root[key];
  if (root && Array.isArray(root[`${key}`])) return root[`${key}`];
  if (root && Array.isArray(root[`${key}s`])) return root[`${key}s`];
  if (root && Array.isArray(root[`${key}_`])) return root[`${key}_`];
  if (root && root[key])
    return Array.isArray(root[key]) ? root[key] : [root[key]];
  if (root && root[`${key}s`])
    return Array.isArray(root[`${key}s`]) ? root[`${key}s`] : [root[`${key}s`]];
  return [];
}

async function postXml(endpoint, itemNameOrXml, payload = null) {
  const url = buildUrl(endpoint);
  let xml = "";
  if (payload === null) {
    xml = itemNameOrXml;
  } else {
    xml = jsonToXml([payload], {
      rootName: "prestashop",
      containerName: null,
      containerWhenMultiple: true,
      itemName: itemNameOrXml,
      rootAttrs: {
        "xmlns:xlink": "http://www.w3.org/1999/xlink",
      },
    });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/xml",
      Accept: "application/xml",
    },
    credentials: "include",
    body: xml,
  });

  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.details = text;
    throw err;
  }
  return {
    text,
    id: parseXmlId(text),
  };
}

async function createAndTrack(endpoint, itemName, payload, created) {
  // postXml transforme cet objet en XML
  const res = await postXml(endpoint, itemName, payload);

  if (res && res.id && created) {
    created.push({ endpoint, id: res.id });
    if (!created[endpoint]) {
      created[endpoint] = 0; // Ou [] selon votre gestion de compteurs
    }
    // Si vous comptez le nombre d'éléments créés :
    if (typeof created[endpoint] === "number") {
      created[endpoint]++;
    }
  }
  return res; // On retourne l'objet complet { id, text }
}

async function deleteXml(endpoint, id) {
  let text = "";
  if (id) {
    const url = buildUrl(`${endpoint}/${id}`);
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Accept: "application/xml" },
      credentials: "include",
    });
    text = await res.text();
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.details = text;
      throw err;
    }
  }
  return text;
}

async function deleteXmlSafe(endpoint, id) {
  try {
    return await deleteXml(endpoint, id);
  } catch (err) {
    // Ignore rollback delete failures (e.g. cart already linked to an order)
    return "";
  }
}

async function putXml(endpoint, itemName, id, payload) {
  const url = buildUrl(`${endpoint}/${id}`);
  const xml = jsonToXml([payload], {
    rootName: "prestashop",
    containerName: null,
    containerWhenMultiple: true,
    itemName,
    rootAttrs: { "xmlns:xlink": "http://www.w3.org/1999/xlink" },
  });
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/xml", Accept: "application/xml" },
    credentials: "include",
    body: xml,
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.details = text;
    throw err;
  }
  return { text };
}

async function findByFilter(
  endpoint,
  filterKey,
  filterValue,
  display = "[id]",
) {
  const url = buildUrl(
    `${endpoint}?filter[${filterKey}]=${encodeURIComponent(filterValue)}&display=${encodeURIComponent(display)}&output_format=JSON`,
  );
  const data = await fetchJson(url);
  const list = unwrapList(data, endpoint.replace(/s$/, ""));
  return list.length ? list[0] : null;
}

async function ensureCategoryIdByName(name, cache, created) {
  if (!name) return DEFAULTS.id_category_default;
  const key = name.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const found = await findByFilter("categories", "name", name, "full");
  if (found?.id) {
    const id = parseInt(found.id, 10);
    cache.set(key, id);
    return id;
  }
  const payload = {
    active: "1",
    id_parent: String(DEFAULTS.id_category_parent),
    "name.language": name,
    "name.language@id": String(DEFAULTS.id_lang),
    "link_rewrite.language": slugify(name),
    "link_rewrite.language@id": String(DEFAULTS.id_lang),
  };
  const createdCategory = await createAndTrack(
    "categories",
    "category",
    payload,
    created,
  );
  if (!createdCategory?.id) {
    throw new Error(`Creation categorie echouee: ${name}`);
  }
  const id = createdCategory.id;
  cache.set(key, id);
  return id;
}

async function ensureProductOption(groupName, cache, created) {
  const key = groupName.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const found = await findByFilter(
    "product_options",
    "name",
    groupName,
    "full",
  );
  if (found?.id) {
    const id = parseInt(found.id, 10);
    cache.set(key, id);
    return id;
  }
  const payload = {
    group_type: "select",
    "name.language": groupName,
    "name.language@id": String(DEFAULTS.id_lang),
    "public_name.language": groupName,
    "public_name.language@id": String(DEFAULTS.id_lang),
  };
  const createdOption = await createAndTrack(
    "product_options",
    "product_option",
    payload,
    created,
  );
  const id = createdOption.id || null;
  if (id) cache.set(key, id);
  return id;
}

async function ensureProductOptionValue(groupId, value, cache, created) {
  const key = `${groupId}:${value.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key);
  const url = buildUrl(
    `product_option_values?filter[name]=${encodeURIComponent(value)}&display=full&output_format=JSON`,
  );
  const data = await fetchJson(url);
  const list = unwrapList(data, "product_option_value");
  const match = list.find(
    (item) => String(item.id_attribute_group) === String(groupId),
  );
  if (match?.id) {
    const id = parseInt(match.id, 10);
    cache.set(key, id);
    return id;
  }
  const payload = {
    id_attribute_group: String(groupId),
    "name.language": value,
    "name.language@id": String(DEFAULTS.id_lang),
  };
  const createdValue = await createAndTrack(
    "product_option_values",
    "product_option_value",
    payload,
    created,
  );
  const id = createdValue.id || null;
  if (id) cache.set(key, id);
  return id;
}

async function findProductIdByReference(reference) {
  const found = await findByFilter("products", "reference", reference, "[id]");
  return found?.id ? parseInt(found.id, 10) : null;
}

async function createProductIfMissing(
  row,
  categoryId,
  taxRulesGroupId,
  created,
) {
  const reference = String(row.reference || "").trim();
  if (!reference) return null;
  const existingId = await findProductIdByReference(reference);
  if (existingId) return existingId;
  const priceTtc = Number(String(row.prix_ttc || 0).replace(",", "."));
  const taxRate = Number(
    String(row.Taxe || row.taxe || "0")
      .replace("%", "")
      .replace(",", "."),
  );

  // ✔ conversion sécurisée TTC -> HT
  const priceExcl = taxRate > 0 ? priceTtc / (1 + taxRate / 100) : priceTtc;
  const priceValue = Number(priceExcl.toFixed(6));

  if (isNaN(priceValue)) {
    throw new Error(`Prix invalide pour reference ${reference}`);
  }

  const name = row.nom || reference;

  const payload = {
    active: "1",
    state: "1",
    available_for_order: "1",
    show_price: "1",
    reference,
    price: String(priceValue),
    id_tax_rules_group: String(taxRulesGroupId || DEFAULTS.id_tax_rules_group),
    id_category_default: String(categoryId || DEFAULTS.id_category_default),
    id_shop_default: "1",
    "name.language": name,
    "name.language@id": String(DEFAULTS.id_lang),
    "link_rewrite.language": slugify(name) || slugify(reference),
    "link_rewrite.language@id": String(DEFAULTS.id_lang),

    associations: {
      categories: {
        category: [
          { id: "2" },
          {
            id: String(categoryId || DEFAULTS.id_category_default),
          },
        ],
      },
    },
  };

  // Prix achat
  const wholesale = row.prix_achat ? Number(formatPrice(row.prix_achat)) : null;

  if (wholesale != null) {
    payload.wholesale_price = String(wholesale);
  }

  if (row.date_availability_produit) {
    payload.available_date = toIsoDate(row.date_availability_produit);
  }

  const createdProduct = await createAndTrack(
    "products",
    "product",
    payload,
    created,
  );
  return createdProduct?.id || 0;
}

async function createCombination(productId, valueIds, impactOnPrice, created) {
  const cleanValueIds = (valueIds || [])
    .map((id) => parseInt(id, 10))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (!cleanValueIds.length) {
    throw new Error(
      `Aucun id_attribute valide pour la combinaison (productId=${productId}).`,
    );
  }

  const payload = {
    id_product: String(productId),
    price: String(Number(impactOnPrice || 0).toFixed(6)),
    minimal_quantity: "1",
    associations: {
      // PrestaShop attend product_option_values > product_option_value
      product_option_values: {
        product_option_value: cleanValueIds.map((id) => ({
          id: String(id),
        })),
      },
    },
  };

  const res = await createAndTrack(
    "combinations",
    "combination",
    payload,
    created,
  );

  // On renvoie l'objet entier pour que ton bloc 'if (result && result.id)' fonctionne
  return res;
}

async function updateStockAvailable(
  productId,
  combinationId,
  quantity,
  available_date,
  created,
) {
  // 1. On cherche l'existant
  const url = buildUrl(
    `stock_availables?filter[id_product]=${productId}&filter[id_product_attribute]=${combinationId}&display=full&output_format=JSON`,
  );
  const data = await fetchJson(url);
  let list = unwrapList(data, "stock_available");

  let stock;
  let oldQuantity = 0;

  if (!list.length) {
    // --- MODIFICATION : Si introuvable, on tente de le créer (POST) ---
    console.log(
      `Stock absent pour ${productId}(${combinationId}), création en cours...`,
    );

    const createPayload = {
      id_product: String(productId),
      id_product_attribute: String(combinationId || 0),
      id_shop: "1", // Ton ID shop par défaut
      id_shop_group: "0",
      quantity: String(quantity || 0),
      depends_on_stock: "0",
      out_of_stock: "2",
    };

    const res = await postXml(
      "stock_availables",
      "stock_available",
      createPayload,
    );
    if (!res?.id) {
      throw new Error(`Creation stock echouee pour produit ${productId}`);
    }
    // On récupère les infos du stock fraîchement créé pour la suite (mouvement)
    stock = { id: res.id, quantity: 0 };
  } else {
    // --- CAS CLASSIQUE : Mise à jour (PUT) ---
    stock = list[0];
    oldQuantity = parseInt(stock.quantity || 0);
    const newQuantity = parseInt(quantity || 0);

    const payload = {
      id: String(stock.id),
      id_product: String(productId),
      id_product_attribute: String(combinationId || 0),
      id_shop: String(stock.id_shop || "1"),
      id_shop_group: String(stock.id_shop_group || "0"),
      depends_on_stock: String(stock.depends_on_stock || 0),
      out_of_stock: String(stock.out_of_stock || 2),
      quantity: String(newQuantity),
    };

    await putXml("stock_availables", "stock_available", stock.id, payload);
  }

  // 2. Gestion du mouvement de stock (Même logique qu'avant)
  const deltaQuantity = parseInt(quantity || 0) - oldQuantity;
  if (deltaQuantity !== 0) {
    await createMvtStok(
      deltaQuantity,
      productId,
      combinationId,
      stock.id,
      available_date,
      created,
    );
  }
}

// Mvt stock
async function createMvtStok(
  deltaQuantity,
  productId,
  combinationId,
  stockId,
  available_date,
  created,
) {
  if (deltaQuantity !== 0) {
    const now = new Date().toISOString().replace("T", " ").split(".")[0];

    const mvtPayload = {
      id_product: String(productId),
      id_product_attribute: String(combinationId || 0),
      id_warehouse: "1", // ID par défaut
      id_currency: "1",
      id_stock_mvt_reason: "1", // 1 est souvent "Réapprovisionnement" ou "Correction"
      id_employee: "1",
      physical_quantity: String(Math.abs(deltaQuantity)),
      sign: String(deltaQuantity > 0 ? 1 : -1),
      price_te: "0.000000",
      date_add: now,
      id_stock: String(stockId), // Très important pour le lien BO
    };

    // Note: Assurez-vous d'avoir une fonction postXml similaire à putXml
    // console.log(
    //   `Mouvement de stock créé : ${deltaQuantity > 0 ? "+" : ""}${deltaQuantity}`,
    // );
    const mvtResponse = await createAndTrack(
      "stock_movements",
      "stock_movement",
      mvtPayload,
      created,
    );

    if (!mvtResponse?.id) {
      throw new Error("Creation mouvement de stock echouee");
    }

    if (available_date) {
      // console.log("Date available :", available_date);
      await fetch("http://localhost:3001/update-mvt-stock-date", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mvtStockId: mvtResponse.id,
          date: available_date,
        }),
      });
    }
    return mvtResponse;
  }
}

async function ensureCustomerByEmail(row, cache, created) {
  const email = String(row.email || "").trim();
  if (!email) return null;
  if (cache.has(email)) return cache.get(email);
  const found = await findByFilter("customers", "email", email, "full");
  if (found?.id) {
    const data = { id: parseInt(found.id, 10), secure_key: found.secure_key };
    cache.set(email, data);
    return data;
  }
  const nameParts = String(row.nom || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const firstname = nameParts[0] || "Client";
  const lastname = nameParts.slice(1).join(" ") || "Inconnu";
  const payload = {
    firstname,
    lastname,
    email,
    passwd: row.pwd || "password",
    active: "1",
    id_default_group: "3",
    id_lang: String(DEFAULTS.id_lang),
  };
  const createdCustomer = await createAndTrack(
    "customers",
    "customer",
    payload,
    created,
  );
  const id = createdCustomer.id || null;
  const data = { id, secure_key: null };
  cache.set(email, data);
  return data;
}

async function ensureAddress(customerId, row, created) {
  const nameParts = String(row.nom || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const firstname = nameParts[0] || "Client";
  const lastname = nameParts.slice(1).join(" ") || "Inconnu";
  const payload = {
    id_customer: String(customerId),
    alias: "Adresse",
    firstname,
    lastname,
    address1: row.adresse || "Adresse",
    city: "Antananarivo",
    postcode: "00000",
    id_country: String(DEFAULTS.id_country),
  };
  const createdAddress = await createAndTrack(
    "addresses",
    "address",
    payload,
    created,
  );
  return createdAddress.id || null;
}

async function createCart(customerId, addressId, dateHeure, cartRows, created) {
  const payload = {
    id_customer: String(customerId),
    id_address_delivery: String(addressId),
    id_address_invoice: String(addressId),
    id_currency: String(DEFAULTS.id_currency),
    id_lang: String(DEFAULTS.id_lang),
    id_shop: String(DEFAULTS.id_shop),
    id_shop_group: String(DEFAULTS.id_shop_group),
    "associations.cart_rows.cart_row": cartRows.map((row) => ({
      id_product: String(row.id_product),
      id_product_attribute: String(row.id_product_attribute || 0),
      quantity: String(row.quantity || 0),
    })),
  };
  const createdCart = await createAndTrack("carts", "cart", payload, created);
  const cartId = createdCart.id;
  // console.log(`Cart created with ID: ${cartId}`, dateHeure);
  if (cartId && dateHeure) {
    // Appel au Bridge pour la "chirurgie" SQL
    await fetch("http://localhost:3001/update-cart-date", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId: cartId,
        date: dateHeure,
      }),
    });
  }
  return createdCart.id || null;
}

async function getCustomerSecureKey(customerId) {
  const data = await fetchJson(
    buildUrl(`customers/${customerId}?output_format=JSON`),
  );
  const customer = data.customer || data;
  return customer?.secure_key || null;
}

async function createOrder(orderData, created) {
  const createdOrder = await createAndTrack(
    "orders",
    "order",
    orderData,
    created,
  );
  return createdOrder.id || null;
}

async function createOrderHistory(orderId, stateId, created) {
  const payload = {
    id_order: String(orderId),
    id_order_state: String(stateId),
    id_employee: String(DEFAULTS.id_employee),
  };
  await createAndTrack("order_histories", "order_history", payload, created);
}

function getBaseName(fileName) {
  const name = String(fileName || "");
  const lastSlash = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
  const base = lastSlash >= 0 ? name.slice(lastSlash + 1) : name;
  const lastDot = base.lastIndexOf(".");
  return lastDot > 0 ? base.slice(0, lastDot) : base;
}

async function uploadProductImage(productId, file) {
  const url = buildUrl(`images/products/${productId}`);
  const formData = new FormData();
  formData.append("image", file, file.name);

  const res = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.details = text;
    throw err;
  }
  return { text, id: parseXmlId(text) };
}

async function deleteProductImage(productId, imageId) {
  const url = buildUrl(`images/products/${productId}/${imageId}`);
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Accept: "application/xml" },
    credentials: "include",
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.details = text;
    throw err;
  }
  return text;
}

export async function getOrCreateTax(rate, created) {
  const url = buildUrl(`taxes?display=full`);
  const xmlResponse = await fetchXmlResponse(url);
  const data = xmlToJson(xmlResponse);

  let taxes = data?.taxes?.tax || [];
  if (!Array.isArray(taxes)) taxes = [taxes];

  const normalizedRate = Number(rate);
  const existing = taxes.find(
    (t) => Number(parseFloat(getText(t.rate))) === normalizedRate,
  );

  if (existing) return getText(existing.id);

  // Utilise le format attendu par postXml pour un objet simple
  const payload = {
    rate: String(normalizedRate),
    active: "1",
    "name.language": `TVA ${normalizedRate}%`,
    "name.language@id": "1",
  };

  const createdTax = await createAndTrack("taxes", "tax", payload, created);
  return createdTax.id;
}

function normalizeTax(value) {
  if (!value) return 0;
  return Number(String(value).replace("%", "").replace(",", ".").trim());
}

export async function getOrCreateTaxRuleGroup(rate, created) {
  const groupName = `TVA ${rate}%`;
  const url = buildUrl(`tax_rule_groups?display=full`);
  const xmlResponse = await fetchXmlResponse(url);
  const data = xmlToJson(xmlResponse);

  let groups = data?.tax_rule_groups?.tax_rule_group || [];
  if (!Array.isArray(groups)) groups = [groups];

  const existing = groups.find(
    (g) => String(getText(g.name)).trim() === groupName,
  );
  if (existing) return getText(existing.id);

  const payload = {
    name: groupName,
    active: "1",
  };

  const createdGroup = await createAndTrack(
    "tax_rule_groups",
    "tax_rule_group",
    payload,
    created,
  );
  return createdGroup.id;
}

export async function createTaxRule(taxRulesGroupId, taxId, created) {
  const FRANCE_ID = 8;

  const payload = {
    id_tax_rules_group: String(taxRulesGroupId),
    id_country: String(FRANCE_ID),
    id_state: "0",
    id_tax: String(taxId),
    behavior: "0",
    description: "TVA automatique",
  };

  const createdRule = await createAndTrack(
    "tax_rules",
    "tax_rule",
    payload,
    created,
  );
  return createdRule.id;
}

export async function ensureTaxRulesGroup(rate, cache, created) {
  const rateKey = String(rate);

  if (cache.has(rateKey)) {
    return cache.get(rateKey);
  }

  const taxId = await getOrCreateTax(rate, created);
  if (!taxId) throw new Error("Tax creation failed");

  const groupId = await getOrCreateTaxRuleGroup(rate, created);
  if (!groupId) throw new Error("Tax rule group creation failed");

  await createTaxRule(groupId, taxId, created);

  cache.set(rateKey, groupId);

  return groupId;
}

function buildComboKey(refKey, spec, value) {
  return `${refKey}:${spec.toLowerCase().trim()}:${value.toLowerCase().trim()}`;
}

export async function importWorkflowFromFiles(files, importPhoto) {
  if (!files || files.length === 0)
    throw new Error("Aucun fichier selectionne");
  const list = Array.from(files);
  const file1 = list.find((f) => f.name.toLowerCase().includes("fichier1"));
  const file2 = list.find((f) => f.name.toLowerCase().includes("fichier2"));
  const file3 = list.find((f) => f.name.toLowerCase().includes("fichier3"));
  const imageFiles = list.filter((f) => !f.name.toLowerCase().endsWith(".csv"));

  const categoryCache = new Map();
  const optionCache = new Map();
  const optionValueCache = new Map();
  const productCache = new Map();
  const combinationCache = new Map();
  const customerCache = new Map();
  const combinationPriceMap = new Map();
  const baseProducts = {};
  const created = [];
  const createdImages = [];

  async function rollbackAll() {
    for (let i = createdImages.length - 1; i >= 0; i -= 1) {
      const item = createdImages[i];
      try {
        await deleteProductImage(item.productId, item.imageId);
      } catch (e) {}
    }
    for (let i = created.length - 1; i >= 0; i -= 1) {
      const item = created[i];
      await deleteXmlSafe(item.endpoint, item.id);
    }
  }

  try {
    if (file1) {
      console.log("PROCESSING FILE 1...");
      const csv = await importCSV(file1);
      const rows = csvToJson(csv);

      validateCsvData("product", rows);

      const taxGroupCache = new Map();

      // 1. LOAD
      for (const row of rows) {
        const refRaw = String(row.reference || "").trim();
        const refKey = normalizeRef(refRaw);
        if (!refKey) continue;

        baseProducts[refKey] = {
          reference: refRaw,
          nom: row.nom || refRaw,
          prix_ttc: Number(String(row.prix_ttc || 0).replace(",", ".")),
          taxe: normalizeTax(row.Taxe),
          categorie: row.categorie,
          prix_achat: Number(String(row.prix_achat || 0).replace(",", ".")),
          date_availability_produit: row.date_availability_produit || "",
        };
      }

      // 2. PROCESS
      for (const refKey of Object.keys(baseProducts)) {
        const data = baseProducts[refKey];

        const categoryId = await ensureCategoryIdByName(
          data.categorie,
          categoryCache,
          created,
        );

        let taxRulesGroupId = DEFAULTS.id_tax_rules_group;

        if (data.taxe > 0) {
          taxRulesGroupId = await ensureTaxRulesGroup(
            data.taxe,
            taxGroupCache,
            created,
          );
        }

        const priceHt =
          data.taxe > 0 ? data.prix_ttc / (1 + data.taxe / 100) : data.prix_ttc;

        const productData = {
          ...data,
          price: Number(priceHt.toFixed(6)),
        };

        const productId = await createProductIfMissing(
          productData,
          categoryId,
          taxRulesGroupId,
          created,
        );

        if (productId) {
          productCache.set(refKey, productId);
        }
      }
    }

    if (importPhoto) {
      console.log("[IMPORT IN] valeur importPhoto : ", importPhoto);
      if (imageFiles.length > 0) {
        for (const image of imageFiles) {
          const reference = getBaseName(image.name);
          const refKey = normalizeRef(reference);
          if (!refKey) continue;
          const productId =
            productCache.get(refKey) ||
            (await findProductIdByReference(reference));
          if (!productId) continue;
          const createdImage = await uploadProductImage(productId, image);
          if (createdImage.id) {
            createdImages.push({ productId, imageId: createdImage.id });
          }
        }
      }
    } else {
      console.log("[IMPORT OUT] valeur importPhoto : ", importPhoto);
    }

    if (file2) {
      console.log("PROCESSING FILE 2...");
      const csv = await importCSV(file2);
      const rows = csvToJson(csv);

      validateCsvData("import_file2", rows);
      const specByRef = new Map();

      for (const row of rows) {
        // 1. INITIALISATION : On utilise 'let' pour permettre la modification
        // Elle est réinitialisée à 0 pour chaque ligne (important pour les produits simples)
        let currentCombinationId = 0;

        const refRaw = String(row.reference || "").trim();
        const refKey = normalizeRef(refRaw);
        if (!refKey) continue;

        const productId =
          productCache.get(refKey) || (await findProductIdByReference(refRaw));
        if (!productId) {
          throw new Error(
            `Produit introuvable pour la reference (fichier2): ${refRaw}`,
          );
        }

        const base = baseProducts[refKey];
        if (!base) {
          throw new Error(
            `Reference ${refKey} presente dans fichier2 mais absente fichier1.`,
          );
        }

        const spec = String(row["specificité"] || row.specificite || "").trim();
        const normalizedSpec = spec.toLowerCase();
        if (normalizedSpec) {
          const existingSpec = specByRef.get(refKey);
          if (!existingSpec) {
            specByRef.set(refKey, normalizedSpec);
          } else if (existingSpec !== normalizedSpec) {
            await rollbackAll();
            throw new Error(
              `Reference ${refRaw} a plusieurs specificites: ${existingSpec} et ${normalizedSpec}.`,
            );
          }
        }
        const value = String(row.karazany || "").trim();

        // 2. LOGIQUE DE DÉCLINAISON
        if (spec && value) {
          const groupId = await ensureProductOption(spec, optionCache, created);
          const valueId = await ensureProductOptionValue(
            groupId,
            value,
            optionValueCache,
            created,
          );
          const comboKey = buildComboKey(refKey, spec, value);

          if (combinationCache.has(comboKey)) {
            currentCombinationId = combinationCache.get(comboKey);
            console.log(
              `[CACHE] Lu pour ${comboKey} : ID ${currentCombinationId}`,
            );
          } else {
            // Calcul de l'IMPACT (Différence HT)
            const baseTtc = normalizeNumber(base.prix_ttc) || 0;
            const priceTtc = normalizeNumber(row.prix_vente_ttc) ?? baseTtc;

            const taxRate =
              typeof base.taxe === "string"
                ? parseFloat(base.taxe.replace(",", ".").replace("%", ""))
                : base.taxe || 0;

            const impact = Number(
              (
                priceTtc / (1 + taxRate / 100) -
                baseTtc / (1 + taxRate / 100)
              ).toFixed(6),
            );

            // APPEL API : On attend la réponse complète
            const result = await createCombination(
              productId,
              [valueId],
              impact || 0,
              created,
            );

            // EXTRACTION DE L'ID : On vérifie si l'API a renvoyé l'ID
            // Note : on force le format numérique avec parseInt ou Number
            if (result && result.id) {
              currentCombinationId = parseInt(result.id, 10);
              combinationCache.set(comboKey, currentCombinationId);
              console.log(
                `[API] Créé ${comboKey} : ID ${currentCombinationId}`,
              );
            } else {
              throw new Error(`Echec creation combinaison pour ${comboKey}.`);
            }
          }
        } else {
          console.log(`[INFO] Produit simple (sans déclinaison) : ${refKey}`);
          currentCombinationId = 0;
        }

        // 3. MISE À JOUR DU STOCK
        const qty = parseInt(row.stock_initial, 10) || 0;
        const available_date = base.date_availability_produit || null;

        let dateHeure = "0000-00-00 00:00:00";
        if (available_date) {
          const isoDate = toIsoDate(available_date);
          if (isoDate) dateHeure = `${isoDate} 00:00:00`;
        }

        // VERIFICATION FINALE : currentCombinationId doit être > 0 si on a une variante
        console.log(
          `---> FINALISATION : Produit ${productId} | Variante ${currentCombinationId} | Stock ${qty}`,
        );

        await updateStockAvailable(
          productId,
          currentCombinationId, // Transmet l'ID réel ou 0
          qty,
          dateHeure,
          created,
        );
      }
    }

    if (file3) {
      console.log("PROCESSING FILE 3...");
      const csv = await importCSV(file3);
      const rows = csvToJson(csv);

      validateCsvData("import_file3", rows);
      for (const row of rows) {
        if (!row.email) {
          throw new Error("Ligne fichier3: email manquant");
        }
        const customer = await ensureCustomerByEmail(
          row,
          customerCache,
          created,
        );
        if (!customer?.id) {
          throw new Error(`Creation client echouee: ${row.email}`);
        }
        const addressId = await ensureAddress(customer.id, row, created);
        if (!addressId) {
          throw new Error(`Creation adresse echouee: ${row.email}`);
        }

        const purchases = mergePurchases(parsePurchases(row.achat));
        if (!purchases.length) {
          throw new Error(`Achat invalide pour ${row.email}`);
        }
        const cartRows = [];
        const dateCsv = row.date;
        const dateHeure = `${toIsoDate(dateCsv)} 00:00:00`;

        let totalTtc = 0;
        for (const item of purchases) {
          const refKey = normalizeRef(item.reference);
          const productId =
            productCache.get(refKey) ||
            (await findProductIdByReference(item.reference));

          if (!productId) {
            throw new Error(
              `Produit introuvable (fichier3): ${item.reference}`,
            );
          }

          let productAttributeId = 0;

          if (item.attributeValue && item.attributeValue.trim() !== "") {
            // 1. On récupère la spécificité (soit de l'item, soit du fichier 2 par défaut)
            // Assurez-vous que spec correspond à ce qui a été mis en cache (ex: "taille")
            const spec = (item.spec || item.specificite || "taille")
              .toLowerCase()
              .trim();
            const val = item.attributeValue.toLowerCase().trim();

            // 2. On reconstruit la clé EXACTE utilisée lors du remplissage du cache (File 2)
            // Format utilisé précédemment : `${refKey}:${spec}:${value}`
            const comboKey = `${refKey}:${spec}:${val}`;

            if (combinationCache.has(comboKey)) {
              productAttributeId = combinationCache.get(comboKey);
              console.log(
                `[INFO] Déclinaison trouvée pour ${comboKey} : ID ${productAttributeId}`,
              );
            } else {
              // 3. Fallback : Si la clé exacte échoue, on tente une recherche partielle (plus lente)
              for (const [key, comboId] of combinationCache.entries()) {
                const parts = key.split(":");
                if (
                  parts[0] === refKey &&
                  parts[2] === val // On compare surtout la référence et la valeur (ngoza, kely...)
                ) {
                  productAttributeId = comboId;
                  break;
                }
              }
              if (productAttributeId === 0) {
                console.warn(
                  `[ATTENTION] Déclinaison non trouvée dans le cache pour : ${comboKey}`,
                );
              }
            }
          }

          cartRows.push({
            id_product: productId,
            id_product_attribute: productAttributeId,
            quantity: item.quantity,
          });

          // ... suite du code (prix et totaux)
          const base = baseProducts[refKey];
          const comboKeyPrice = `${refKey}:${(item.spec || "taille").toLowerCase().trim()}:${item.attributeValue?.toLowerCase().trim()}`;
          const priceTtc = item.attributeValue
            ? combinationPriceMap.get(comboKeyPrice) || base?.prix_ttc
            : base?.prix_ttc;
          totalTtc += (priceTtc || 0) * (item.quantity || 0);
        }
        if (!cartRows.length) continue;

        const cartId = await createCart(
          customer.id,
          addressId,
          dateHeure,
          cartRows,
          created,
        );
        if (!cartId) {
          throw new Error(`Creation panier echouee: ${row.email}`);
        }

        const secureKey =
          customer.secure_key || (await getCustomerSecureKey(customer.id));

        // console.log("row.etat:", row.etat);
        if (row.etat !== "") {
          const stateLabel = String(row.etat || "")
            .toLowerCase()
            .trim();
          const stateId = ORDER_STATE_MAP[stateLabel] || 1;
          const orderPayload = {
            id_address_delivery: String(addressId),
            id_address_invoice: String(addressId),
            id_cart: String(cartId),
            id_currency: String(DEFAULTS.id_currency),
            id_lang: String(DEFAULTS.id_lang),
            id_customer: String(customer.id),
            id_carrier: String(DEFAULTS.id_carrier),
            current_state: String(stateId),
            module: "ps_checkpayment",
            payment: "Paiement a la livraison",
            conversion_rate: String(DEFAULTS.conversion_rate),
            secure_key: secureKey || "",
            total_paid: formatMoney(totalTtc),
            total_paid_real: formatMoney(totalTtc),
            total_products: formatMoney(totalTtc),
            total_products_wt: formatMoney(totalTtc),
            total_shipping: "0",
            total_wrapping: "0",
            total_discounts: "0",
          };

          console.log("[ORDER PAYLOAD]", orderPayload);

          // 1. Création normale via PrestaShop
          const orderId = await createOrder(orderPayload);
          if (!orderId) {
            throw new Error(`Creation commande echouee: ${row.email}`);
          }

          if (orderId && dateCsv) {
            await createOrderHistory(orderId, stateId, created);
            const newDate = addOneDay(dateHeure);
            // 2. Appel au Bridge pour la "chirurgie" SQL
            await fetch("http://localhost:3001/update-order-date", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: orderId,
                date: dateHeure,
              }),
            });
          }
        }
      }
    }

    return { ok: true };
  } catch (err) {
    await rollbackAll();
    throw err;
  }
}

function addOneDay(dateString) {
  if (!dateString) return "";
  let d = new Date(dateString);
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export function validateCsvData(entity, rows) {
  const config = getEntityConfig(entity);
  const errors = [];

  // 1. Vérification des colonnes (Headers)
  if (rows.length > 0) {
    const csvHeaders = Object.keys(rows[0]);
    const validHeaders = Object.keys(config.headerMapNormalized);

    csvHeaders.forEach((header) => {
      const normalized = normalizeHeaderName(header);
      if (!validHeaders.includes(normalized)) {
        errors.push(`Colonne non conforme détectée : "${header}"`);
      }
    });
  }

  // Expression régulière pour le format DD/MM/YYYY
  const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;

  rows.forEach((row, index) => {
    const lineNum = index + 1;

    for (const [key, value] of Object.entries(row)) {
      const normalized = normalizeHeaderName(key);
      const target = config.headerMapNormalized[normalized];
      const targetKey = String(target || "").toLowerCase();
      const headerKey = String(normalized || "").toLowerCase();
      const isDateField =
        targetKey.includes("date") || headerKey.includes("date");
      const isAmountField =
        targetKey.includes("prix") ||
        targetKey.includes("total") ||
        targetKey.includes("price") ||
        headerKey.includes("prix") ||
        headerKey.includes("total") ||
        headerKey.includes("price");

      // 2. Vérification du format de Date (DD/MM/YYYY)
      // On vérifie si la colonne cible est une date (ex: date_add, delivery_date)
      if (isDateField && value) {
        if (!dateRegex.test(value)) {
          errors.push(
            `Ligne ${lineNum} : Format de date invalide pour "${key}" (${value}). Attendu: DD/MM/YYYY`,
          );
        }
      }

      // 3. Vérification Montant Positif
      // On vérifie les colonnes de prix ou totaux
      if (isAmountField && value) {
        const amount = parseFloat(value.replace(",", "."));
        if (isNaN(amount) || amount <= 0) {
          errors.push(
            `Ligne ${lineNum} : Le montant pour "${key}" doit être positif (reçu: ${value})`,
          );
        }
      }
    }
  });

  // Si des erreurs existent, on lève une exception groupée
  if (errors.length > 0) {
    throw new Error("Erreurs de validation CSV :\n- " + errors.join("\n- "));
  }
}

export { getEntityConfig };
