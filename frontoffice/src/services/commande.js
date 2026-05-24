import { buildUrl, fetchXmlResponse } from "./config/api";
import { xmlToJson } from "../utils/xml.convert";

function toArray(node) {
  if (!node) return [];
  return Array.isArray(node) ? node : [node];
}

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

export async function getUserOrders(customerId) {
  try {
    // On filtre les commandes pour n'avoir que celles de l'utilisateur connecté
    const url = buildUrl(
      `orders?filter[id_customer]=[${customerId}]&display=full&output_format=XML`,
    );
    const xml = await fetchXmlResponse(url);
    const parsed = xmlToJson(xml);

    const root = parsed?.prestashop || parsed;
    const ordersData = root?.orders?.order;

    // Gestion du cas où il n'y a qu'une seule commande (pas un array)
    if (!ordersData) return [];
    return Array.isArray(ordersData) ? ordersData : [ordersData];
  } catch (error) {
    console.error("Erreur récupération commandes:", error);
    throw error;
  }
}

export async function getCartByIdOrder(idOrder) {
  try {
    const url = buildUrl(
      `orders/${idOrder}?display=full&output_format=XML`,
    );
    const xml = await fetchXmlResponse(url);
    const parsed = xmlToJson(xml);
    // console.log(parsed);

    const root = parsed?.prestashop || parsed;
    // const ordersData = root?.orders?.order;
    const ordersData = root.order.associations.order_rows.order_row;
    // console.log("ordersData : ", ordersData);

    if (!ordersData) return [];
    // console.log(Array.isArray(ordersData) ? ordersData : [ordersData])
    return Array.isArray(ordersData) ? ordersData : [ordersData];
  } catch (error) {
    console.error("Erreur récupération commandes:", error);
    throw error;
  }
}

export async function getProductById(idProduct) {
  try {
    const url = buildUrl(
      `products/${idProduct}?display=full&output_format=XML`,
    );
    const xml = await fetchXmlResponse(url);
    const parsed = xmlToJson(xml);
    // console.log(parsed);

    const root = parsed?.prestashop || parsed;
    // const ordersData = root?.orders?.order;
    const ordersData = root.products;
    // console.log("ordersData : ", ordersData);

    if (!ordersData) return [];
    // console.log(Array.isArray(ordersData) ? ordersData : [ordersData])
    return ordersData.name;
  } catch (error) {
    console.error("Erreur récupération commandes:", error);
    throw error;
  }
}

export async function getStockProduct(idProduct, idProductAttribute = 0) {
  try {
    const url = buildUrl(
      `stock_availables?filter[id_product]=${idProduct}&filter[id_product_attribute]=${idProductAttribute}&display=full&output_format=XML`,
    );
    const xml = await fetchXmlResponse(url);
    const parsed = xmlToJson(xml);

    const root = parsed?.prestashop || parsed;
    const list = toArray(root?.stock_availables?.stock_available);
    const first = list[0];
    const qty = parseInt(getText(first?.quantity), 10);
    return Number.isFinite(qty) ? qty : 0;
  } catch (error) {
    console.error("Erreur récupération stock:", error);
    throw error;
  }
}

export async function checkStock(idProduit) {
  
}