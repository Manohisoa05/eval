import {
  fetchWithCache,
  clearCache,
  clearCachePrefix,
} from "../utils/apiCache.js";
import {
  API_BASE,
  CACHE_TTL,
  buildUrl,
  fetchXmlResponse,
} from "./config/api.js";
import { xmlToJson } from "../utils/xml.convert.js";
import { getCustomerName } from "./customer.js";
import { getCountryNameByCityId } from "./address.js";

export async function fetchOrder(id) {
  const url = buildUrl(`orders/${id}?output_format=XML`);
  return fetchWithCache(url, async () => fetchXmlResponse(url), CACHE_TTL);
}

export async function fetchOrderStates() {
  const url = buildUrl(`order_states?output_format=XML&display=full`);
  return fetchWithCache(url, async () => fetchXmlResponse(url), CACHE_TTL);
}

export async function fetchOrderState(idState) {
  const url = buildUrl(
    `order_states/${idState}?output_format=XML&display=full`,
  );
  return fetchWithCache(url, async () => fetchXmlResponse(url), CACHE_TTL);
}

export async function fetchOrderStatesDetailed(idState) {
  const xml = await fetchOrderState(idState);
  if (!xml) return [];
  let parsed = null;
  try {
    parsed = xmlToJson(xml);
  } catch (e) {
    return [];
  }
  return parsed;
}

export async function fetchOrdersListRaw() {
  const url = buildUrl(`orders?output_format=XML&display=full`);
  return fetchWithCache(url, async () => fetchXmlResponse(url), CACHE_TTL);
}

export async function fetchOrdersDetailed() {
  const xml = await fetchOrdersListRaw();
  if (!xml) return [];
  let parsed = null;
  try {
    parsed = xmlToJson(xml);
  } catch (e) {
    return [];
  }

  // find orders array in parsed result
  let ordersNode = null;
  if (parsed.prestashop && parsed.prestashop.orders)
    ordersNode = parsed.prestashop.orders.order || parsed.prestashop.orders;
  else if (parsed.orders) ordersNode = parsed.orders.order || parsed.orders;
  else if (parsed.order) ordersNode = parsed.order;
  else {
    // maybe root directly contains orders
    const vals = Object.values(parsed);
    for (const v of vals) {
      if (v && v.order) {
        ordersNode = v.order;
        break;
      }
    }
  }

  if (!ordersNode) return [];
  const nodes = Array.isArray(ordersNode) ? ordersNode : [ordersNode];

  // map to flat objects for UI (async because we fetch customer details)
  const mapped = await Promise.all(
    nodes.map(async (o) => {
      const id = o.id;
      const reference = o.reference;
      const date = o.date_add;
      const total = o.total_paid;
      const payment = o.payment;
      const color = o?.current_state
        ? await getStateColor(o.current_state)
        : "#000000";
      const customer = await getCustomerName(o.id_customer);
      const status = await getNameStatus(o.current_state);
      const delivery = await getCountryNameByCityId(o.id_address_delivery);
      const href = o?.href || o?.xlink || o?.["xlink:href"] || null;
      return {
        id: id ? String(id) : null,
        reference: String(reference || ""),
        delivery: String(delivery) || "—",
        customer: String(customer || "—"),
        date: String(date || ""),
        total: String(total || ""),
        payment: String(payment || ""),
        status: String(status || ""),
        color,
        href,
      };
    }),
  );

  return mapped;
}

// GET status (fetch from order_states if possible for better info)
async function getNameStatus(idState) {
  let status = "—";
  try {
    if (idState) {
      const stateParsed = await fetchOrderStatesDetailed(idState);
      const stateNode = stateParsed.order_state;
      const stateName = stateNode.name.language;
      if (stateName) status = stateName;
    }
  } catch (e) {
    // ignore, keep placeholder
  }
  return status;
}

export async function fetchOrderPayments() {
  const url = buildUrl(`order_payments?output_format=XML&display=full`);
  return fetchWithCache(url, async () => fetchXmlResponse(url), CACHE_TTL);
}

export async function fetchOrderHistories() {
  const url = buildUrl(`order_histories?output_format=XML&display=full`);
  return fetchWithCache(url, async () => fetchXmlResponse(url), CACHE_TTL);
}

export async function getStateColor(idState) {
  const stateJson = await fetchOrderStatesDetailed(idState);
  return stateJson.order_state.color || "#000000";
}

export async function updateOrderStatusManual(
  idOrder,
  idState,
  { idEmployee = 0, date = "" } = {},
) {
  const url = buildUrl("manual_order_state");
  const payload = `<manual_order_state>
                    <id_order>${idOrder}</id_order>
                    <id_order_state>${idState}</id_order_state>
                    <id_employee>${idEmployee}</id_employee>
                    <date>${date}</date>
                  </manual_order_state>`;

  const currentStatus = await getCurrentOrderStatus(idOrder);
  if (!checkAllowedToUpdate(currentStatus)) {
    alert(
      "Cette commande est déjà livrée ou annulée. Impossible de modifier son statut.",
    );
    throw new Error("Impossible d'annuler une commande déjà livrée.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: payload,
    credentials: "include",
  });

  const text = await response.text();
  if (!response.ok) {
    const err = new Error(`HTTP ${response.status}`);
    err.details = text;
    throw err;
  }
  try {
    clearCachePrefix(buildUrl(`orders`));
    clearCachePrefix(buildUrl(`order_states`));
    clearCachePrefix(buildUrl(`order_histories`));
  } catch (e) {
    // ignore
  }
  return text;
}

export async function getCurrentOrderStatus(idOrder) {
  const url = buildUrl(`orders/${idOrder}?output_format=XML&display=full`);
  const xml = await fetchXmlResponse(url);
  if (!xml) return null;
  let parsed = null;
  try {
    parsed = xmlToJson(xml);
  } catch (e) {
    console.error("Erreur lors de la conversion XML en JSON:", e);
  }
  return parsed.order.current_state || null;
}

export function checkAllowedToUpdate(currentStateId) {
  if (Number(currentStateId) === 5 || Number(currentStateId) === 6) {
    return false;
  }
  return true;
}

export async function getOrdersStatsByDate(date1, date2) {
  try {
    const url = buildUrl(
      `orders?output_format=XML&display=[id,date_add,total_paid]`,
    );
    const xml = await fetchXmlResponse(url);

    if (!xml) {
      return {
        count: 0,
        totalPaid: 0,
        generalCount: 0,
        generalPaid: 0,
      };
    }

    const parsed = xmlToJson(xml);
    const root = parsed?.prestashop ? parsed.prestashop : parsed;
    const ordersNode = root?.orders?.order;

    if (!ordersNode) {
      return {
        count: 0,
        totalPaid: 0,
        generalCount: 0,
        generalPaid: 0,
      };
    }

    const orders = Array.isArray(ordersNode) ? ordersNode : [ordersNode];

    let count = 0;
    let totalPaid = 0;
    let generalCount = 0;
    let generalPaid = 0;

    orders.forEach((order) => {
      const dateAdd = extractText(order.date_add);

      // Exemple :
      // 2026-05-13 14:22:11
      const orderDate = dateAdd.split(" ")[0];

      if ((orderDate > date1) & (orderDate <= date2)) {
        count++;
        totalPaid += parseFloat(extractText(order.total_paid) || 0);
      }
      generalCount++;
      generalPaid += parseFloat(extractText(order.total_paid) || 0);
    });

    return {
      count,
      totalPaid,
      generalCount,
      generalPaid,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des commandes :", error);

    return {
      count: 0,
      totalPaid: 0,
      generalCount: 0,
      generalPaid: 0,
    };
  }
}

function extractText(node) {
  if (node == null) return "";

  if (
    typeof node === "string" ||
    typeof node === "number" ||
    typeof node === "boolean"
  ) {
    return String(node);
  }

  if (typeof node === "object") {
    if (node._text) return String(node._text);
    if (node["#text"]) return String(node["#text"]);
    if (node.language) return extractText(node.language);
  }

  return "";
}

export default {
  fetchOrder,
  fetchOrderStates,
  fetchOrderPayments,
  fetchOrderHistories,
  fetchOrdersListRaw,
  fetchOrdersDetailed,
  getStateColor,
  updateOrderStatusManual,
  getOrdersStatsByDate,
};
