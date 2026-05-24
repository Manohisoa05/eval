import { buildUrl, fetchXmlResponse } from "./config/api.js";
import { xmlToJson } from "../utils/xml.convert.js";
import { saveRemoteCartIdForCustomer } from "./achat.js";
import { addToCart } from "./achat.js";
import { fetchProductMapped } from "./produit.js";

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
  return carts.filter((c) => getText(c.id) !== "");
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

export async function getCustomerNotValidatedCarts(customerId) {
  try {
    const carts = await getCartNotValidated();

    return carts.filter(
      (cart) => String(getText(cart.id_customer)) === String(customerId),
    );
  } catch (error) {
    console.error("Erreur récupération paniers non validés client:", error);
    return [];
  }
}

export async function getCartProducts(cartId) {
  try {
    const url = buildUrl(`carts/${cartId}?output_format=XML&display=full`);

    const xml = await fetchXmlResponse(url);
    const data = xmlToJson(xml);
    console.log("Données XML du panier:", data);

    const cart = data?.prestashop?.cart || data?.cart;

    let rows = cart?.associations?.cart_rows?.cart_row || [];

    if (!Array.isArray(rows)) {
      rows = [rows];
    }

    return rows.map((r) => ({
      id_product: getText(r.id_product),
      id_product_attribute: getText(r.id_product_attribute || "0"),
      price: parseFloat(getText(r.price) || 0),
      quantity: parseInt(getText(r.quantity) || 0),
    }));
  } catch (error) {
    console.error("Erreur récupération produits panier:", error);
    return [];
  }
}

// panier.js

export async function restoreRemoteCart(cartId, customerId) {
  try {
    const cartRows = await getCartProducts(cartId);

    for (const p of cartRows) {
      const pId = getText(p.id_product);
      const attrId = getText(p.id_product_attribute);

      // Récupère le produit mappé avec nos corrections
      const productData = await fetchProductMapped(pId);
      if (!productData) continue;

      let selectedAttribute = null;
      if (attrId && attrId !== "0") {
        selectedAttribute = productData.attributes?.find(
          (a) => String(a.combinationId) === String(attrId),
        );
      }

      // LOGIQUE DE PRIX : Priorité à l'attribut, sinon prix de base
      // On utilise Number() pour éviter le 0 si la valeur est une string vide
      const finalPrice = selectedAttribute
        ? Number(selectedAttribute.price)
        : Number(productData.price || productData.price_ttc || 0);

      addToCart({
        id: productData.id,
        id_product: productData.id,
        id_product_attribute: parseInt(attrId) || 0,
        name: selectedAttribute
          ? `${productData.name} - ${selectedAttribute.name}`
          : productData.name,
        price: finalPrice,
        image: productData.image,
        quantity: parseInt(p.quantity || 1),
        customerId,
      });
    }

    saveRemoteCartIdForCustomer(customerId, cartId);
    return true;
  } catch (error) {
    console.error("Erreur restauration panier:", error);
    return false;
  }
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
  getCustomerNotValidatedCarts,
};
