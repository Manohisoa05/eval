import { useEffect, useState } from "react";
import { useParams, Link, Form } from "react-router-dom";
import {
  getCustomerNotValidatedCarts,
  restoreRemoteCart,
} from "../services/panier";
import {
  fetchProductsMapped,
  fetchProductMapped,
  getMark,
} from "../services/produit";
import {
  addToCart,
  getCart,
  getCartFiltered,
  updateCartQty,
  removeFromCart,
  clearCart,
  computeTotals,
  checkoutCashOnDelivery,
  createCart,
  updateCart,
  getCustomerAddressId,
  deleteRemoteCart,
  getRemoteCartIdForCustomer,
  removeRemoteCartIdForCustomer,
} from "../services/achat";
import { getCachedCustomer } from "../services/auth";
import heroImg from "../assets/hero.png";
import {
  getCartByIdOrder,
  getStockProduct,
  getProductById,
} from "../services/commande";

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

export default function Product() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState(() => {
    let cached = getCachedCustomer();
    if (!cached) {
      const anonymousCustomer = {
        id: 0,
        firstname: "Anonyme",
        lastname: "Client",
      };
      getCachedCustomer(anonymousCustomer, false);
      return getCartFiltered(0);
    }
    const customerId = Number(cached?.customer?.id) || 0;
    return getCartFiltered(customerId);
  });
  const [checkoutStatus, setCheckoutStatus] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [quantityToAdd, setQuantityToAdd] = useState(1);
  const [abandonedCarts, setAbandonedCarts] = useState([]);
  const [multiplier, setMultiplier] = useState(1);
  const [checkingStock, setCheckingStock] = useState(false);
  const [stockCheck, setStockCheck] = useState(null);
  const [createStatus, setCreateStatus] = useState(null);
  const [productNames, setProductNames] = useState({});

  // FILTRE DE RECHERCHE
  const [searchName, setSearchName] = useState("");
  const [searchCategory, setSearchCategory] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedAttribute, setSelectedAttribute] = useState(null);
  const [cartLoad, setCartLoad] = useState();

  const loadCart = async () => {
    if (id) {
      const carts = await getCartByIdOrder(id);
      console.log(carts);
      setItem(carts);
      return carts;
    }
    return [];
  };

  useEffect(() => {
    loadCart(id);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProductNames() {
      const rows = Array.isArray(item) ? item : [];
      const ids = Array.from(
        new Set(
          rows
            .map((row) => Number(row.product_id || row.id_product || 0))
            .filter((pid) => pid > 0),
        ),
      );

      if (!ids.length) {
        if (active) setProductNames({});
        return;
      }

      try {
        const results = await Promise.all(
          ids.map(async (pid) => ({
            id: pid,
            name: extractText(await getProductById(pid)),
          })),
        );

        if (!active) return;
        const next = {};
        results.forEach((res) => {
          if (res.name) {
            next[res.id] = res.name;
          }
        });
        setProductNames(next);
      } catch (e) {
        if (active) setProductNames({});
      }
    }

    loadProductNames();

    return () => {
      active = false;
    };
  }, [item]);

  const buildCartRows = (rows, factor) => {
    const safeFactor = Number(factor || 1);
    return (rows || []).map((row) => {
      const idProduct = Number(row.product_id || row.id_product || 0);
      const idProductAttribute = Number(
        row.product_attribute_id || row.id_product_attribute || 0,
      );
      const quantity =
        Number(row.product_quantity || row.quantity || 0) * safeFactor;
      const price = Number(
        row.unit_price_tax_incl || row.unit_price || row.price || 0,
      );
      const nameFromRow = extractText(
        row.product_name || row.name || row.product?.name,
      );
      return {
        id_product: idProduct,
        id_product_attribute: idProductAttribute,
        quantity,
        price,
        name: nameFromRow || productNames[idProduct],
      };
    });
  };

  const handleCheckStock = async () => {
    setCheckingStock(true);
    setCreateStatus(null);

    try {
      const rows = buildCartRows(item, multiplier).filter(
        (row) => row.id_product && row.quantity > 0,
      );

      const checks = [];
      for (const row of rows) {
        const available = await getStockProduct(
          row.id_product,
          row.id_product_attribute || 0,
        );
        const missing = Math.max(0, row.quantity - available);
        checks.push({
          ...row,
          available,
          missing,
        });
      }

      setStockCheck({
        rows: checks,
        missing: checks.filter((r) => r.missing > 0),
      });
    } catch (e) {
      setStockCheck(null);
      setCreateStatus({
        ok: false,
        message: e?.message || "Erreur verification stock",
      });
    } finally {
      setCheckingStock(false);
    }
  };

  const handleCreateOrder = async () => {
    const cached = getCachedCustomer();
    const customerId = Number(cached?.customer?.id || 0);

    if (!customerId) {
      setCreateStatus({
        ok: false,
        message: "Veuillez vous connecter avant de creer une commande.",
      });
      return;
    }

    if (!stockCheck) {
      setCreateStatus({
        ok: false,
        message: "Veuillez verifier le stock avant validation.",
      });
      return;
    }

    if (stockCheck.missing && stockCheck.missing.length > 0) {
      setCreateStatus({
        ok: false,
        message: "Stock insuffisant. La commande ne peut pas etre creee.",
      });
      return;
    }

    setCheckingOut(true);
    setCreateStatus(null);

    try {
      const cartRows = buildCartRows(item, multiplier).filter(
        (row) => row.id_product && row.quantity > 0,
      );
      const totals = computeTotals(cartRows);

      const res = await checkoutCashOnDelivery({
        customerId,
        cartRows,
        orderStateId: 5,
        finalStateId: 5,
        forceNewCart: true,
        carrierName: "",
        totals,
      });

      setCreateStatus({
        ok: true,
        message: `Commande creee (ID ${res.orderId})`,
      });
    } catch (e) {
      console.error(e);
      setCreateStatus({
        ok: false,
        message: e?.message || "Erreur commande",
      });
    } finally {
      setCheckingOut(false);
    }
  };

  const handleRemoveFromCart = async (productId) => {
    try {
      const cached = getCachedCustomer();
      const customerId = cached?.customer?.id || 0;

      const data = { id_product: productId, customerId: customerId };

      // 1. Supprimer du localStorage global
      removeFromCart(data);

      // 2. Récupérer IMMÉDIATEMENT la nouvelle version filtrée pour l'UI
      // On récupère le panier total puis on filtre manuellement pour être sûr
      const allItems = getCart();
      const myUpdatedItems = allItems.filter(
        (item) => String(item.customerId) === String(customerId),
      );

      // Mise à jour de l'affichage
      setCart(myUpdatedItems);

      // 3. Logique de synchronisation PrestaShop
      const remoteCartId = getRemoteCartIdForCustomer(customerId);

      if (remoteCartId) {
        if (myUpdatedItems.length === 0) {
          // CAS : Le panier de CE client est vraiment vide
          console.log("Suppression du panier distant car vide pour ce client");
          await deleteRemoteCart(remoteCartId);
          removeRemoteCartIdForCustomer(customerId);
        } else {
          // CAS : Il reste des produits pour ce client -> UPDATE (PUT)
          console.log("Mise à jour du panier distant (PUT)");
          const addressId = await getCustomerAddressId(customerId);

          await updateCart({
            cartId: remoteCartId,
            customerId: customerId,
            addressId: addressId,
            products: myUpdatedItems, // On envoie les produits restants de CE client
          });
        }
      }
    } catch (err) {
      console.error("Erreur suppression:", err);
    }
  };

  if (loading) return <p>Chargement...</p>;

  // Detail view
  if (!item) return <p>Produit introuvable</p>;

  const itemName = extractText(item?.name) || "Sans nom";
  const basePrice = Number(item?.price_ttc || 0);

  const variantPrice = selectedAttribute
    ? Number(
        selectedAttribute.price ?? selectedAttribute.price_ttc ?? basePrice,
      )
    : basePrice;

  const displayedPrice = Number(variantPrice);
  const itemDescription = extractText(item?.description) || "";
  const quantityInStock = selectedAttribute
    ? selectedAttribute.stock
    : item?.quantityInStock || 0;
  console.log("[DEBUG] item : ", item);

  const displayRows = buildCartRows(item, multiplier).filter(
    (row) => row.id_product && row.quantity > 0,
  );
  console.log("[DEBUG] displayRows : ", displayRows);
  const displayTotals = computeTotals(displayRows);

  return (
    <article className="product-detail py-4">
      <div className="container">
        <Link
          to="/product"
          className="back-link text-decoration-none mb-4 d-inline-block"
        >
          <i className="bi bi-arrow-left me-2"></i>
          Retour aux produits
        </Link>
      </div>
      {item.length === 0 ? (
        <div className="text-center text-muted py-3">Panier vide.</div>
      ) : (
        <div className="cart-box">
          <div className="d-flex flex-column flex-md-row gap-3 mb-3">
            <div>
              <label className="form-label mb-1">Quantite</label>
              <input
                type="number"
                min="1"
                value={multiplier}
                onChange={(e) =>
                  setMultiplier(Math.max(1, Number(e.target.value || 1)))
                }
                className="form-control"
                style={{ maxWidth: 120 }}
              />
            </div>
            <div className="d-flex align-items-end gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={handleCheckStock}
                disabled={checkingStock}
              >
                {checkingStock ? "Verification..." : "Verifier stock"}
              </button>
            </div>
          </div>
          {stockCheck ? (
            <div className="mb-3">
              <div className="fw-bold mb-2">Etat du stock</div>
              {stockCheck.missing.length === 0 ? (
                <div className="alert alert-success py-2 mb-2">
                  Stock suffisant pour cette commande.
                </div>
              ) : (
                <div className="alert alert-danger py-2 mb-2">
                  Stock insuffisant pour certains produits.
                </div>
              )}
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>Variante</th>
                      <th>Demande</th>
                      <th>Stock</th>
                      <th>Manquant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockCheck.rows.map((row) => (
                      <tr key={`${row.id_product}-${row.id_product_attribute}`}>
                        <td>{row.id_product}</td>
                        <td>{row.id_product_attribute || "-"}</td>
                        <td>{row.quantity}</td>
                        <td>{row.available}</td>
                        <td className={row.missing > 0 ? "text-danger" : ""}>
                          {row.missing}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {createStatus ? (
            <div
              className={`alert mt-2 ${
                createStatus.ok ? "alert-success" : "alert-danger"
              }`}
            >
              {createStatus.message}
            </div>
          ) : null}
          {displayRows.map((row) => (
            <div
              key={`${row.id_product}-${row.id_product_attribute}`}
              className="cart-row"
            >
              <div className="cart-info">
                <div className="cart-title">
                  {row.name || "Produit sans nom"}
                </div>
                <div className="cart-price">
                  {Number(row.price).toFixed(2)} €
                </div>
              </div>
              <div className="cart-actions">
                <input
                  type="number"
                  min="1"
                  value={row.quantity}
                  readOnly
                  className="form-control form-control-sm"
                  style={{ width: 70 }}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  // value={handleRemoveFromCart(row.id_product)}
                  disabled
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
          <div className="cart-footer">
            <div className="cart-total">
              Total: {Number(displayTotals.total_paid).toFixed(2)} €
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateOrder}
              disabled={checkingOut}
            >
              {checkingOut ? "Validation..." : "Valider la commande"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
