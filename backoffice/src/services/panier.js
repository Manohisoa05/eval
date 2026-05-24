import { buildUrl, fetchXmlResponse } from "./config/api.js";
import { xmlToJson } from "../utils/xml.convert.js";
import { getCustomerName } from "./customer.js";
import { getCountryNameByCityId } from "./address.js";

async function getOrderCartIds() {
  const url = buildUrl(`orders?output_format=XML&display=[id_cart]`);
  const xml = await fetchXmlResponse(url);
  const data = xmlToJson(xml);

  const orders = data.orders.order;
  if (!orders) return [];

  const list = Array.isArray(orders) ? orders : [orders];
  return list.map((o) => getText(o.id_cart));
}

export async function getAllCartsFull() {
  const url = buildUrl(`carts?output_format=XML&display=full`);
  const resXml = await fetchXmlResponse(url);
  const parsed = xmlToJson(resXml);

  // 1. On cible la racine 'cart' de PrestaShop
  let carts = parsed.carts.cart;

  // 2. Si PrestaShop ne renvoie qu'UN seul panier, ce n'est pas un tableau.
  // On force le format tableau pour que .filter() fonctionne
  if (carts && !Array.isArray(carts)) {
    carts = [carts];
  }

  // 3. Nettoyage : On ne garde que les objets qui ont un ID valide
  // Ça évite de compter les objets vides ou les associations
  if (carts) {
    return carts.filter((c) => getText(c.id) !== "");
  }
  return [];
}

export async function getCartNotValidated() {
  try {
    const orderCartIdsArray = await getOrderCartIds();
    // On crée le Set avec des IDs propres (strings)
    const orderCartSet = new Set(orderCartIdsArray.filter((id) => id !== ""));
    const allCarts = await getAllCartsFull();

    if (!allCarts || allCarts.length === 0) return [];

    const notValidatedCarts = allCarts.filter((cart) => {
      const cartIdStr = String(getText(cart.id));
      // Logique : Si l'ID n'est PAS dans le Set des commandes, il est invalide/abandonné
      return cartIdStr !== "" && !orderCartSet.has(cartIdStr);
    });

    return notValidatedCarts;
  } catch (error) {
    console.error("ERREUR CRITIQUE dans getCartNotValidated:", error);
    return [];
  }
}

export async function unvalideCartMapped() {
  const carts = await getCartNotValidated();
  // Map the carts to a flat object for UI display
  return Promise.all(
    carts.map(async (cart) => ({
      id: String(getText(cart.id)),
      customer_name:
        cart.id_customer && cart.id_customer === "0"
        ? "Anonyme"
        : (await getCustomerName(getText(cart.id_customer))),
      id_address_delivery:
        cart.id_address_delivery && cart.id_address_delivery === "0"
        ? "Aucun"
        : (await getCountryNameByCityId(getText(cart.id_address_delivery))),  
      date_add: String(getText(cart.date_add)),
    })),
  );
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

export default {
  getCartNotValidated,
  unvalideCartMapped,
};
