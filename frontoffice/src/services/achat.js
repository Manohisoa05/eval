import { xmlToJson } from "../utils/xml.convert.js";
import { buildUrl, fetchXmlResponse } from "./config/api.js";

const CART_KEY = "ps_cart";

function xmlEscape(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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

export function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function getCartFiltered(customerId) {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const filtered = [];
    parsed.forEach((p) => {
      if (Number(p.customerId) === Number(customerId)) {
        filtered.push(p);
      }
    });
    return filtered;
  } catch (e) {
    return [];
  }
}

export function saveCart(items) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items || []));

    console.log("SAVE CART OK");
    console.log(localStorage.getItem(CART_KEY));

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("ps_cart_changed"));
    }
  } catch (e) {
    console.error("Erreur saveCart :", e);
  }
}

export function addToCart(item) {
  try {
    const items = getCart();

    const normalizedAttribute = String(item.id_product_attribute || "0");

    // Produit EXACT = produit + attribut + client
    const idx = items.findIndex(
      (i) =>
        String(i.id_product) === String(item.id_product) &&
        String(i.id_product_attribute || "0") === normalizedAttribute &&
        String(i.customerId) === String(item.customerId),
    );

    if (idx >= 0) {
      items[idx].quantity =
        Number(items[idx].quantity || 0) + Number(item.quantity || 1);
    } else {
      items.push({
        id_product: String(item.id_product),
        id_product_attribute: normalizedAttribute,
        name: item.name || `Produit ${item.id_product}`,
        price: Number(item.price || 0),
        image: item.image || null,
        quantity: Number(item.quantity || 1),
        customerId: String(item.customerId),
      });
    }

    saveCart(items);
    return items;
  } catch (e) {
    console.error("Erreur addToCart :", e);
    return [];
  }
}

export function updateCartQty(idProduct, quantity) {
  const items = getCart();
  const idx = items.findIndex(
    (i) => String(i.id_product) === String(idProduct),
  );
  if (idx >= 0) {
    items[idx].quantity = Math.max(1, Number(quantity || 1));
  }
  saveCart(items);
  return items;
}

export function removeFromCart(data) {
  const items = getCart();
  const filtered = items.filter(
    (item) =>
      String(item.id_product) !== String(data.id_product) ||
      String(item.customerId) !== String(data.customerId),
  );
  saveCart(filtered);
  return filtered;
}

export function clearCart() {
  saveCart([]);
}

export function getRemoteCartIdForCustomer(customerId) {
  try {
    const raw = localStorage.getItem("ps_cart_id_remote");
    if (!raw) return null;
    const remoteCarts = JSON.parse(raw);
    const found = remoteCarts.find(
      (c) => Number(c.customerId) === Number(customerId),
    );
    return found ? Number(found.cartId) : null;
  } catch {
    return null;
  }
}

export function saveRemoteCartIdForCustomer(customerId, cartId) {
  try {
    const raw = localStorage.getItem("ps_cart_id_remote");
    let remoteCarts = raw ? JSON.parse(raw) : [];
    const index = remoteCarts.findIndex(
      (c) => Number(c.customerId) === Number(customerId),
    );

    if (index >= 0) {
      remoteCarts[index].cartId = Number(cartId);
    } else {
      remoteCarts.push({
        customerId: Number(customerId),
        cartId: Number(cartId),
      });
    }
    localStorage.setItem("ps_cart_id_remote", JSON.stringify(remoteCarts));
  } catch (e) {
    console.error(e);
  }
}

export function removeRemoteCartIdForCustomer(customerId) {
  try {
    const raw = localStorage.getItem("ps_cart_id_remote");
    if (!raw) return;

    let remoteCarts = JSON.parse(raw);
    // On garde tout sauf celui du client concerné
    remoteCarts = remoteCarts.filter(
      (c) => String(c.customerId) !== String(customerId),
    );

    localStorage.setItem("ps_cart_id_remote", JSON.stringify(remoteCarts));
  } catch (e) {
    console.error("Erreur removeRemoteCartId:", e);
  }
}

export function computeTotals(items) {
  const totalProducts = (items || []).reduce(
    (sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0),
    0,
  );
  return {
    total_products: totalProducts.toFixed(2),
    total_products_wt: totalProducts.toFixed(2),
    total_paid: totalProducts.toFixed(2),
  };
}

async function postXml(path, xmlBody) {
  const url = buildUrl(path);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/xml", Accept: "application/xml" },
    body: xmlBody,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("ERREUR PRESTASHOP BRUTE :", text);
    throw new Error(`http ${res.status} ${text}`);
  }
  return res.text();
}

async function putXml(path, xmlBody, method = "POST") {
  const url = buildUrl(path);

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/xml",
      Accept: "application/xml",
    },
    body: xmlBody,
  });
  const text = await res.text();

  if (!res.ok) {
    console.error("ERREUR PRESTASHOP :", text);
    throw new Error(`Erreur ${method}: ${res.status}`);
  }
  return text;
}

function buildCartXml({
  cartId = "",
  customerId,
  addressDeliveryId,
  addressInvoiceId,
  carrierId,
  currencyId = 1,
  langId = 1,
  shopId = 1,
  shopGroupId = 1,
  cartRows = [],
}) {
  const rows = cartRows
    .map((row) => {
      return `
            <cart_row>
                <id_product>${xmlEscape(row.id_product)}</id_product>
                <id_product_attribute>${xmlEscape(row.id_product_attribute)}</id_product_attribute>
                <id_address_delivery>${xmlEscape(addressDeliveryId)}</id_address_delivery>
                <id_customization>0</id_customization>
                <quantity>${xmlEscape(row.quantity)}</quantity>
            </cart_row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
    <cart>
		<id>${xmlEscape(cartId)}</id>
        <id_customer>${xmlEscape(customerId)}</id_customer>
        <id_address_delivery>${xmlEscape(addressDeliveryId)}</id_address_delivery>
        <id_address_invoice>${xmlEscape(addressInvoiceId || addressDeliveryId)}</id_address_invoice>
        <id_carrier>${xmlEscape(carrierId)}</id_carrier>
        <id_currency>${xmlEscape(currencyId)}</id_currency>
        <id_lang>${xmlEscape(langId)}</id_lang>
        <id_shop>${xmlEscape(shopId)}</id_shop>
        <id_shop_group>${xmlEscape(shopGroupId)}</id_shop_group>
        <associations>
            <cart_rows>
                ${rows}
            </cart_rows>
        </associations>
    </cart>
</prestashop>`;
}

function buildOrderXml({
  orderStateId,
  customerId,
  addressDeliveryId,
  addressInvoiceId,
  cartId,
  carrierId,
  currencyId,
  langId,
  shopId,
  shopGroupId,
  payment,
  module,
  totals,
}) {
  const t = totals || {};
  const totalProducts = t.total_products ?? 0;
  const totalProductsWt = t.total_products_wt ?? totalProducts;
  const totalPaid = t.total_paid ?? totalProductsWt;

  return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop>
	<order>
		<id_address_delivery>${xmlEscape(addressDeliveryId)}</id_address_delivery>
		<id_address_invoice>${xmlEscape(addressInvoiceId || addressDeliveryId)}</id_address_invoice>
		<id_cart>${xmlEscape(cartId)}</id_cart>
		<id_currency>${xmlEscape(currencyId)}</id_currency>
		<id_lang>${xmlEscape(langId)}</id_lang>
		<id_customer>${xmlEscape(customerId)}</id_customer>
		<id_carrier>${xmlEscape(carrierId)}</id_carrier>
		<id_shop>${xmlEscape(shopId)}</id_shop>
		<id_shop_group>${xmlEscape(shopGroupId)}</id_shop_group>
		<current_state>${xmlEscape(orderStateId)}</current_state>
		<payment>${xmlEscape(payment || "Paiement a la livraison")}</payment>
		<module>${xmlEscape(module || "ps_cashondelivery")}</module>
		<total_discounts>0</total_discounts>
		<total_discounts_tax_incl>0</total_discounts_tax_incl>
		<total_discounts_tax_excl>0</total_discounts_tax_excl>
		<total_paid>${xmlEscape(totalPaid)}</total_paid>
		<total_paid_tax_incl>${xmlEscape(totalPaid)}</total_paid_tax_incl>
		<total_paid_tax_excl>${xmlEscape(totalPaid)}</total_paid_tax_excl>
		<total_paid_real>0</total_paid_real>
		<total_products>${xmlEscape(totalProducts)}</total_products>
		<total_products_wt>${xmlEscape(totalProductsWt)}</total_products_wt>
		<total_shipping>0</total_shipping>
		<total_shipping_tax_incl>0</total_shipping_tax_incl>
		<total_shipping_tax_excl>0</total_shipping_tax_excl>
		<total_wrapping>0</total_wrapping>
		<total_wrapping_tax_incl>0</total_wrapping_tax_incl>
		<total_wrapping_tax_excl>0</total_wrapping_tax_excl>
		<conversion_rate>1</conversion_rate>
	</order>
</prestashop>`;
}

export async function getCustomerAddressId(customerId) {
  const url = buildUrl(
    `addresses?filter[id_customer]=[${encodeURIComponent(customerId)}]&display=full&output_format=XML`,
  );
  const xml = await fetchXmlResponse(url);
  const parsed = xmlToJson(xml);
  const root = parsed?.prestashop || parsed;
  const addresses = toArray(root?.addresses?.address);
  const first = addresses[0];
  return getText(first?.id);
}

export async function getCarrierIdByName(name) {
  const url = buildUrl("carriers?display=full&output_format=XML");
  const xml = await fetchXmlResponse(url);
  const parsed = xmlToJson(xml);
  const root = parsed?.prestashop || parsed;
  const carriers = toArray(root?.carriers?.carrier);
  if (!carriers.length) return "";
  if (!name) return getText(carriers[0]?.id);
  const match = carriers.find(
    (c) => getText(c?.name).toLowerCase() === name.toLowerCase(),
  );
  return getText((match || carriers[0])?.id);
}

export async function createCart({
  customerId,
  addressDeliveryId,
  addressInvoiceId,
  carrierId,
  currencyId = 1,
  langId = 1,
  shopId = 1,
  shopGroupId = 1,
  cartRows = [],
}) {
  // Sécurisation des lignes panier
  const normalizedRows = cartRows.map((row) => ({
    id_product: Number(row.id_product),
    id_product_attribute: Number(row.id_product_attribute || 0),
    quantity: Number(row.quantity || 1),
    id_address_delivery: Number(
      row.id_address_delivery || addressDeliveryId || 0,
    ),
    id_customization: Number(row.id_customization || 0),
  }));

  const xml = buildCartXml({
    customerId: Number(customerId),
    addressDeliveryId: Number(addressDeliveryId),
    addressInvoiceId: Number(addressInvoiceId),
    carrierId: Number(carrierId),
    currencyId: Number(currencyId),
    langId: Number(langId),
    shopId: Number(shopId),
    shopGroupId: Number(shopGroupId),
    cartRows: normalizedRows,
  });

  console.log("XML CREATE CART:", xml);
  const resXml = await postXml("carts?output_format=XML", xml);
  const parsed = xmlToJson(resXml);
  const newCartId = parsed?.prestashop?.cart?.id || parsed?.cart?.id;
  if (newCartId) {
    saveRemoteCartIdForCustomer(customerId, newCartId);
  }
  console.log("✅ Nouveau panier créé:", newCartId);
  return newCartId;
}

export async function updateCart({
  cartId,
  customerId,
  addressDeliveryId,
  addressInvoiceId,
  carrierId,
  cartRows = [],
}) {
  // IMPORTANT :
  // envoyer TOUS les produits du panier
  const normalizedRows = cartRows.map((row) => ({
    id_product: Number(row.id_product),
    id_product_attribute: Number(row.id_product_attribute || 0),
    quantity: Number(row.quantity || 1),
    id_address_delivery: Number(
      row.id_address_delivery || addressDeliveryId || 0,
    ),
    id_customization: Number(row.id_customization || 0),
  }));

  const xml = buildCartXml({
    cartId: Number(cartId),
    customerId: Number(customerId),
    addressDeliveryId: Number(addressDeliveryId),
    addressInvoiceId: Number(addressInvoiceId),
    carrierId: Number(carrierId),
    cartRows: normalizedRows,
    currencyId: 1,
    langId: 1,
    shopId: 1,
    shopGroupId: 1,
  });

  console.log("XML UPDATE CART:", xml);
  const url = `carts/${cartId}?output_format=XML`;
  await putXml(url, xml, "PUT");
  console.log("✅ Panier mis à jour:", cartId);
  return cartId;
}

export async function deleteRemoteCart(cartId) {
  if (!cartId) return;

  // L'URL pour supprimer un panier spécifique : /api/carts/ID
  const url = buildUrl(`carts/${cartId}`);

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        // Selon votre config api.js, assurez-vous que l'auth est incluse
        "Content-Type": "application/xml",
      },
    });

    if (!response.ok) {
      throw new Error(`Erreur lors de la suppression du panier ${cartId}`);
    }

    console.log(`Panier ${cartId} supprimé de la base PrestaShop`);
    // Optionnel : nettoyer l'ID du panier stocké localement
    // localStorage.removeItem("ps_cart_id_remote");

    return true;
  } catch (error) {
    console.error("Erreur DELETE cart:", error);
    return false;
  }
}

export async function createOrderCashOnDelivery({
  orderStateId,
  customerId,
  addressDeliveryId,
  addressInvoiceId,
  cartId,
  carrierId,
  currencyId = 1,
  langId = 1,
  shopId = 1,
  shopGroupId = 1,
  totals,
}) {
  const xml = buildOrderXml({
    orderStateId,
    customerId,
    addressDeliveryId,
    addressInvoiceId,
    cartId,
    carrierId,
    currencyId,
    langId,
    shopId,
    shopGroupId,
    payment: "Paiement a la livraison",
    module: "ps_cashondelivery",
    totals,
  });

  const resXml = await postXml("orders?output_format=XML", xml);
  const parsed = xmlToJson(resXml);
  const root = parsed?.prestashop || parsed;
  return getText(root?.order?.id);
}

export async function checkoutCashOnDelivery({
  customerId,
  cartRows,
  orderStateId = 2,
  finalStateId,
  forceNewCart = false,
  carrierName,
  currencyId = 1,
  langId = 1,
  shopId = 1,
  shopGroupId = 1,
  totals,
}) {
  const addressId = await getCustomerAddressId(customerId);
  if (!addressId) throw new Error("Adresse client introuvable");

  const carrierId = await getCarrierIdByName(carrierName);
  if (!carrierId) throw new Error("Transporteur introuvable");

  // --- LOGIQUE DE RÉUTILISATION DU PANIER ---
  let cartId = forceNewCart ? null : getRemoteCartIdForCustomer(customerId);

  if (!cartId) {
    console.log("Creation d'un nouveau panier...");
    cartId = await createCart({
      customerId,
      addressDeliveryId: addressId,
      addressInvoiceId: addressId,
      carrierId,
      currencyId,
      langId,
      shopId,
      shopGroupId,
      cartRows,
    });
  }
  // ------------------------------------------

  let orderId;
  try {
    orderId = await createOrderCashOnDelivery({
      orderStateId,
      customerId,
      addressDeliveryId: addressId,
      addressInvoiceId: addressId,
      cartId,
      carrierId,
      currencyId,
      langId,
      shopId,
      shopGroupId,
      totals,
    });
  } catch (error) {
    const details = String(error?.details || error?.message || "");
    const cartRelatedError =
      /Le panier ne peut être chargé|Le panier ne peut etre charge|commande a déjà été réalisée avec ce panier|commande a deja ete realisee avec ce panier/i.test(
        details,
      );

    if (!cartRelatedError) {
      throw error;
    }

    console.warn(
      "Panier distant invalide ou déjà converti, on repart sur un nouveau panier:",
      details,
    );

    removeRemoteCartIdForCustomer(customerId);
    try {
      localStorage.removeItem("ps_cart_id_remote");
    } catch (e) {}

    cartId = await createCart({
      customerId,
      addressDeliveryId: addressId,
      addressInvoiceId: addressId,
      carrierId,
      currencyId,
      langId,
      shopId,
      shopGroupId,
      cartRows,
    });

    orderId = await createOrderCashOnDelivery({
      orderStateId,
      customerId,
      addressDeliveryId: addressId,
      addressInvoiceId: addressId,
      cartId,
      carrierId,
      currencyId,
      langId,
      shopId,
      shopGroupId,
      totals,
    });
  }

  const targetStateId =
    finalStateId !== undefined && finalStateId !== null ? finalStateId : 2;
  await updateOrderState(orderId, targetStateId);

  removeRemoteCartIdForCustomer(customerId);
  try {
    localStorage.removeItem("ps_cart_id_remote");
  } catch (e) {}
  // Après la commande, le panier est "converti", on nettoie l'ID local
  // localStorage.removeItem("ps_cart_id_remote");

  return { cartId, orderId };
}

export async function updateOrderState(orderId, newStateId) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <prestashop>
        <order_history>
            <id_order>${orderId}</id_order>
            <id_order_state>${newStateId}</id_order_state>
        </order_history>
    </prestashop>`;

  return await postXml("order_histories?output_format=XML", xml);
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
  console.log("XML UPDATE ORDER STATUS MANUAL:", payload);

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
  return text;
}

export default {
  getCart,
  getCartFiltered,
  saveCart,
  addToCart,
  updateCartQty,
  removeFromCart,
  clearCart,
  computeTotals,
  getCustomerAddressId,
  getCarrierIdByName,
  createCart,
  createOrderCashOnDelivery,
  checkoutCashOnDelivery,
  deleteRemoteCart,
  updateCart,
};
