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

  // FILTRE DE RECHERCHE
  const [searchName, setSearchName] = useState("");
  const [searchCategory, setSearchCategory] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedAttribute, setSelectedAttribute] = useState(null);

  useEffect(() => {
    let mounted = true;

    if (id) {
      fetchProductMapped(id)
        .then((p) => {
          if (!mounted) return;
          setItem(p);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      fetchProductsMapped()
        .then((arr) => {
          if (!mounted) return;
          // console.log("Liste des produits: ", arr);
          setList(arr);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }

    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    async function loadCustomerCarts() {
      const cached = getCachedCustomer();
      const customerId = cached?.customer?.id;

      if (!customerId) return;

      const carts = await getCustomerNotValidatedCarts(customerId);

      setAbandonedCarts(carts);
    }

    loadCustomerCarts();
  }, []);

  useEffect(() => {
    const checkAuth = () => {
      const cached = getCachedCustomer();
      if (!cached) {
        // Sécurité supplémentaire : si le cache est vidé manuellement
        getCachedCustomer({ id: 0 }, false);
      }
    };
    checkAuth();
  }, []);

  const handleAddToCart = async (product) => {
    const cached = getCachedCustomer();
    const customerId = Number(cached?.customer?.id) || 0;

    const price = Number(
      product.price_ttc ??
        product.price ??
        selectedAttribute?.price_ttc ??
        selectedAttribute?.price ??
        0,
    );

    addToCart({
      id_product: product.id_product || product.id,
      id_product_attribute: Number(
        product.id_product_attribute ?? selectedAttribute?.combinationId ?? 0,
      ),
      name: product.name,
      price: price,
      image: product.image,
      quantity: parseInt(quantityToAdd),
      customerId,
    });

    setCart(getCartFiltered(customerId));

    const newCart = getCartFiltered(customerId);

    let cartIdToUse = getRemoteCartIdForCustomer(customerId);
    const customerAddressId = await getCustomerAddressId(customerId);

    const params = {
      customerId,
      addressDeliveryId: customerAddressId || null,
      addressInvoiceId: customerAddressId || null,
      carrierId: 1,
      cartRows: newCart.map((item) => ({
        id_product: Number(item.id_product),
        id_product_attribute: Number(item.id_product_attribute || 0),
        quantity: Number(item.quantity),
      })),
    };

    if (cartIdToUse) {
      await updateCart({ ...params, cartId: cartIdToUse });
    } else {
      await createCart(params);
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

  const handleCheckout = async () => {
    const cached = getCachedCustomer();
    const customer = cached?.customer;

    if (!customer?.id) {
      setCheckoutStatus({
        ok: false,
        message: "Veuillez vous connecter avant de valider la commande.",
      });
      return;
    }

    const rawCart = getCartFiltered(Number(customer.id));

    console.log("Panier brut:", rawCart);

    if (rawCart.length === 0) {
      setCheckoutStatus({ ok: false, message: "Votre panier est vide." });
      return;
    }

    setCheckingOut(true);
    setCheckoutStatus(null);

    try {
      // 🔥 1. MERGE DES DOUBLONS PRODUIT + ATTRIBUT
      const grouped = {};

      for (const item of rawCart) {
        const key = `${item.id_product}-${item.id_product_attribute || 0}`;

        if (!grouped[key]) {
          grouped[key] = {
            id_product: Number(item.id_product),
            id_product_attribute: Number(item.id_product_attribute || 0),
            quantity: Number(item.quantity || 0),
          };
        } else {
          grouped[key].quantity += Number(item.quantity || 0);
        }
      }

      const cartRows = Object.values(grouped);

      console.log("CartRows normalisés:", cartRows);

      // 🔥 2. recalcul totals sur données propres
      const totals = computeTotals(cartRows);

      // 🔥 3. checkout
      const res = await checkoutCashOnDelivery({
        customerId: Number(customer.id),
        cartRows,
        orderStateId: 13,
        carrierName: "",
        forceNewCart: true,
        totals,
      });

      setCheckoutStatus({
        ok: true,
        message: `Commande validée (ID ${res.orderId})`,
      });

      // 🔥 4. nettoyage local: retirer les lignes du client valide
      rawCart.forEach((item) => {
        removeFromCart({
          id_product: item.id_product,
          customerId: customer.id,
        });
      });
      setCart([]);

      // 🔥 5. suppression cart remote id (si logique panier converti)
      removeRemoteCartIdForCustomer(customer.id);
    } catch (e) {
      console.error(e);
      setCheckoutStatus({
        ok: false,
        message: e?.message || "Erreur commande",
      });
    } finally {
      setCheckingOut(false);
    }
  };
  if (loading) return <p>Chargement...</p>;

  // List view when no id
  if (!id) {
    // FILTRE DE RECHERCHE
    const popular = list.filter((p) => {
      const nameMatch = p.name
        ?.toLowerCase()
        .includes(searchName.toLowerCase());

      const categoryMatch =
        searchCategory === "" ||
        p.category?.toLowerCase().includes(searchCategory.toLowerCase());

      const minMatch =
        minPrice === "" || Number(p.price_ttc) >= Number(minPrice);

      const maxMatch =
        maxPrice === "" || Number(p.price_ttc) <= Number(maxPrice);

      return nameMatch && categoryMatch && minMatch && maxMatch;
    });
    // -----------------------
    return (
      <div className="shop-home">
        <div className="shop-layout">
          <div className="shop-main">
            {/* hero banner removed as requested */}

            <section className="popular-section">
              {/* DEBUT FILTRE DE RECHERCHE */}
              <div className="row mb-4">
                <div className="col-md-3">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Recherche par nom"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                  />
                </div>

                <div className="col-md-3">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Catégorie"
                    value={searchCategory}
                    onChange={(e) => setSearchCategory(e.target.value)}
                  />
                </div>

                <div className="col-md-3">
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Prix minimum"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                  />
                </div>

                <div className="col-md-3">
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Prix maximum"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                  />
                </div>
              </div>
              {/* FIN FILTRE DE RECHERCHE */}
              <div className="section-title">PRODUITS POPULAIRES</div>
              {popular.length === 0 ? (
                <div className="text-center text-muted py-4">
                  Aucun produit disponible.
                </div>
              ) : (
                <div className="row g-4">
                  {popular.map((p) => (
                    <div key={p.id} className="col-6 col-md-3">
                      <div className="shop-card">
                        <span
                          className={getMark(p.date_availability_produit).color}
                        >
                          {getMark(p.date_availability_produit).text}
                        </span>
                        <button
                          type="button"
                          className="wish-btn"
                          aria-label="Favori"
                        >
                          ♡
                        </button>
                        <Link
                          to={`/product/${p.id}`}
                          className="shop-card-media"
                        >
                          <img
                            loading="lazy"
                            src={p.image || "/assets/hero.png"}
                            alt={p.name}
                          />
                        </Link>
                        <div className="shop-card-body">
                          <div className="shop-card-subtitle">{p.name}</div>
                          <div className="shop-card-title">{p.category}</div>
                          <div className="shop-card-price">
                            {p.price_ttc?.toFixed(2)} €
                          </div>
                          {/* <button
                            type="button"
                            className="btn btn-sm btn-outline-primary mt-2"
                            onClick={() => handleAddToCart(p)}
                          >
                            Ajouter
                          </button> */}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-end mt-3">
                <Link to="/product" className="all-products-link">
                  Tous les produits ›
                </Link>
              </div>
            </section>

            <section className="promo-banner">
              <div className="promo-inner">
                <span>20% OFF ON CLOTHES</span>
                <small>SEE MORE</small>
              </div>
            </section>

            <section className="cart-section">
              {abandonedCarts.length > 0 && (
                <section className="mb-4">
                  <div className="card shadow-sm border-0">
                    <div className="card-header bg-warning-subtle">
                      <h5 className="mb-0">🛒 Paniers non validés</h5>
                    </div>

                    <div className="card-body">
                      {abandonedCarts.map((cart) => (
                        <div
                          key={cart.id}
                          className="d-flex justify-content-between align-items-center border rounded p-3 mb-2"
                        >
                          <div>
                            <div>
                              <strong>Panier #{cart.id}</strong>
                            </div>

                            <small className="text-muted">
                              Créé le{" "}
                              {new Date(cart.date_add).toLocaleDateString(
                                "fr-FR",
                              )}
                            </small>
                          </div>

                          <button
                            className="btn btn-primary btn-sm"
                            onClick={async () => {
                              const cached = getCachedCustomer();

                              await restoreRemoteCart(
                                cart.id,
                                cached.customer.id,
                              );

                              setCart(getCartFiltered(cached.customer.id));

                              alert("Panier restauré");
                            }}
                          >
                            Restaurer
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </section>
          </div>

          <aside className="cart-panel">
            <section className="cart-section floating-cart">
              <div className="section-title">PANIER</div>
              {cart.length === 0 ? (
                <div className="text-center text-muted py-3">Panier vide.</div>
              ) : (
                <div className="cart-box">
                  {cart.map((c) => (
                    <div key={c.id_product} className="cart-row">
                      <div className="cart-info">
                        <div className="cart-title">{c.name}</div>
                        <div className="cart-price">
                          {Number(c.price).toFixed(2)} €
                        </div>
                      </div>
                      <div className="cart-actions">
                        <input
                          type="number"
                          min="1"
                          value={c.quantity}
                          onChange={(e) =>
                            updateCartQty(c.id_product, e.target.value)
                          }
                          className="form-control form-control-sm"
                          style={{ width: 70 }}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleRemoveFromCart(c.id_product)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="cart-footer">
                    <div className="cart-total">
                      Total: {Number(computeTotals(cart).total_paid).toFixed(2)} €
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleCheckout}
                      disabled={checkingOut}
                    >
                      {checkingOut
                        ? "Validation..."
                        : "Valider (Paiement a la livraison)"}
                    </button>
                  </div>
                  {checkoutStatus ? (
                    <div
                      className={`alert mt-3 ${checkoutStatus.ok ? "alert-success" : "alert-danger"}`}
                    >
                      {checkoutStatus.message}
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    );
  }

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

        <div className="row g-5">
          {/* Section Image */}
          <div className="col-md-6">
            <div className="image-container position-relative">
              <img
                src={item?.image || "/assets/hero.png"}
                alt={itemName}
                className="detail-image w-100 rounded-4 shadow-sm"
                style={{ objectFit: "cover", height: "400px" }}
              />
              {quantityInStock <= 5 && quantityInStock > 0 && (
                <span className="badge bg-warning position-absolute top-0 end-0 m-3">
                  Stock limité
                </span>
              )}
              {quantityInStock === 0 && (
                <span className="badge bg-danger position-absolute top-0 end-0 m-3">
                  Rupture de stock
                </span>
              )}
            </div>
          </div>

          {/* Section Informations */}
          <div className="col-md-6">
            <div className="product-info">
              <h1 className="display-5 fw-bold mb-3">{itemName}</h1>

              <div className="product-price mb-4">
                <span className="display-6 fw-bold text-primary">
                  {displayedPrice.toFixed(2)} €
                </span>
                {item?.oldPrice && (
                  <span className="text-muted text-decoration-line-through ms-3">
                    {item.oldPrice.toFixed(2)} €
                  </span>
                )}
              </div>

              <div className="product-description mb-4">
                <h5 className="fw-semibold mb-2">Description</h5>
                <p className="text-muted">{itemDescription}</p>
              </div>

              <div className="stock-info mb-4">
                <div className="d-flex align-items-center gap-2">
                  <i
                    className={`bi ${quantityInStock > 0 ? "bi-check-circle-fill text-success" : "bi-x-circle-fill text-danger"}`}
                  ></i>
                  <span className="fw-medium">
                    {quantityInStock > 0
                      ? `En stock : ${quantityInStock} unités`
                      : "Rupture de stock"}
                  </span>
                </div>
                {quantityInStock > 0 && quantityInStock <= 10 && (
                  <small className="text-warning d-block mt-1">
                    ⚡ Plus que {quantityInStock} en stock, commandez vite !
                  </small>
                )}
              </div>

              {/* Sélection des attributs */}
              {console.log("Attributs disponibles:", item.attributes)}
              {item.attributes &&
                item.attributes.length > 0 && ( // Change > 1 par > 0
                  <div className="mb-4">
                    sac
                    <label className="form-label fw-bold text-secondary text-uppercase small">
                      Options disponibles
                    </label>
                    <select
                      className="form-select form-select-lg border-2"
                      value={selectedAttribute?.combinationId || ""}
                      onChange={(e) => {
                        const attr = item.attributes.find(
                          (a) => String(a.combinationId) === e.target.value,
                        );
                        setSelectedAttribute(attr);
                      }}
                    >
                      {/* Option par défaut si nécessaire */}
                      <option value="">Choisir une option...</option>

                      {item.attributes.map((attr) => (
                        <option
                          key={attr.combinationId}
                          value={attr.combinationId}
                        >
                          {attr.name} ({attr.price.toFixed(2)} €)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              {/* Quantité et ajout au panier */}
              <div className="purchase-section p-4 bg-light rounded-4 mb-4">
                <div className="d-flex gap-3 align-items-end">
                  <div className="flex-grow-1">
                    <label className="form-label fw-semibold mb-2">
                      <i className="bi bi-calculator me-2"></i>
                      Quantité :
                    </label>
                    <div className="d-flex align-items-center gap-2">
                      <button
                        className="btn btn-outline-secondary rounded-circle"
                        style={{ width: "36px", height: "36px" }}
                        onClick={() =>
                          setQuantityToAdd(
                            Math.max(1, parseInt(quantityToAdd) - 1),
                          )
                        }
                        disabled={quantityToAdd <= 1}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        className="form-control text-center"
                        style={{ width: "80px" }}
                        min="1"
                        max={quantityInStock}
                        value={quantityToAdd}
                        onChange={(e) =>
                          setQuantityToAdd(
                            Math.min(
                              quantityInStock,
                              Math.max(1, parseInt(e.target.value) || 1),
                            ),
                          )
                        }
                      />
                      <button
                        className="btn btn-outline-secondary rounded-circle"
                        style={{ width: "36px", height: "36px" }}
                        onClick={() =>
                          setQuantityToAdd(
                            Math.min(
                              quantityInStock,
                              parseInt(quantityToAdd) + 1,
                            ),
                          )
                        }
                        disabled={quantityToAdd >= quantityInStock}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary btn-lg flex-grow-1"
                    onClick={() =>
                      handleAddToCart({
                        id: item.id,
                        id_product_attribute:
                          selectedAttribute?.combinationId || 0,
                        name: itemName,
                        price: displayedPrice,
                        image: item?.image || null,
                      })
                    }
                    disabled={quantityInStock === 0}
                  >
                    <i className="bi bi-cart-plus me-2"></i>
                    Ajouter au panier
                  </button>
                </div>
              </div>

              {/* Informations supplémentaires */}
              <div className="delivery-info">
                <div className="row g-3">
                  <div className="col-6">
                    <div className="d-flex align-items-center gap-2 text-muted">
                      <i className="bi bi-truck fs-5"></i>
                      <small>Livraison 24-48h</small>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="d-flex align-items-center gap-2 text-muted">
                      <i className="bi bi-arrow-repeat fs-5"></i>
                      <small>Retour sous 14 jours</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
