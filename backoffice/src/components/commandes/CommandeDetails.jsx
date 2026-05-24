import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Sidebar from "../layout/Sidebar.jsx";
import "../../App.css";
import { fetchWithCache } from "../../utils/apiCache.js";

function CommandeDetails({ id: propId }) {
  // call hooks at top-level
  const params = useParams();
  const [order, setOrder] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [orderStates, setOrderStates] = useState([]);
  const [payments, setPayments] = useState([]);
  const [histories, setHistories] = useState([]);
  const [customerMessages, setCustomerMessages] = useState([]);
  const [suppLoading, setSuppLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_BASE = import.meta.env.VITE_API_BASE ?? "";
  const CACHE_TTL = parseInt(import.meta.env.VITE_CACHE_TTL_MS || "300000", 10);

  useEffect(() => {
    const idFromParams = params?.id;
    const id =
      propId || idFromParams || (window.location.hash || "").split("/")[2];
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // fetch main order object first
        const url = `${API_BASE}/api/orders/${id}?output_format=JSON`;
        const jd = await fetchWithCache(
          url,
          async () => {
            const r = await fetch(url, {
              headers: { Accept: "application/json" },
              credentials: "include",
            });
            if (!r.ok) throw new Error("http " + r.status);
            return r.json();
          },
          CACHE_TTL,
        );
        const orderObj =
          jd &&
          (jd.order || (Array.isArray(jd) ? jd[0] : jd.orders?.order || jd));
        if (!orderObj) throw new Error("Commande introuvable");
        if (!cancelled) setOrder(orderObj);

        // now fetch supplemental data
        if (!cancelled) {
          setSuppLoading(true);
          try {
            // customer details
            const idCustomer =
              orderObj?.id_customer ||
              (orderObj?.customer && orderObj.customer.id) ||
              null;
            if (idCustomer) {
              const custUrl = `${API_BASE}/api/customers/${idCustomer}?output_format=JSON`;
              const addrUrl = `${API_BASE}/api/addresses?filter[id_customer]=${idCustomer}&output_format=JSON&display=full`;
              try {
                const custJson = await fetchWithCache(
                  custUrl,
                  async () => {
                    const r = await fetch(custUrl, {
                      headers: { Accept: "application/json" },
                      credentials: "include",
                    });
                    if (!r.ok) throw new Error("http " + r.status);
                    return r.json();
                  },
                  CACHE_TTL,
                );
                const addrJson = await fetchWithCache(
                  addrUrl,
                  async () => {
                    const r = await fetch(addrUrl, {
                      headers: { Accept: "application/json" },
                      credentials: "include",
                    });
                    if (!r.ok) throw new Error("http " + r.status);
                    return r.json();
                  },
                  CACHE_TTL,
                );
                const custObj = custJson.customer || custJson;
                const addrObj = addrJson.addresses;
                const idCountry = addrObj[0]?.id_country;
                const countryUrl = `${API_BASE}/api/countries/${idCountry}?output_format=JSON&display=full`;
                const countryJson = await fetchWithCache(
                  countryUrl,
                  async () => {
                    const r = await fetch(countryUrl, {
                      headers: { Accept: "application/json" },
                      credentials: "include",
                    });
                    if (!r.ok) throw new Error("http " + r.status);
                    return r.json();
                  },
                  CACHE_TTL,
                );
                const countryObj = countryJson.countries;
                console.log("Customer details", {
                  custObj,
                  addrObj,
                  countryObj,
                });
                if (!cancelled)
                  setCustomer({
                    ...custObj,
                    address: addrObj,
                    country: countryObj,
                  });
              } catch (e) {}
            }

            // order states
            try {
              const stUrl = `${API_BASE}/api/order_states?output_format=JSON&display=full`;
              const stJson = await fetchWithCache(
                stUrl,
                async () => {
                  const r = await fetch(stUrl, {
                    headers: { Accept: "application/json" },
                    credentials: "include",
                  });
                  if (!r.ok) throw new Error("http " + r.status);
                  return r.json();
                },
                CACHE_TTL,
              );
              const states =
                (stJson &&
                  (stJson.order_states ||
                    stJson.order_states?.order_state ||
                    stJson.order_state ||
                    stJson)) ||
                [];
              if (!cancelled)
                setOrderStates(Array.isArray(states) ? states : [states]);
            } catch (e) {}

            // payments
            try {
              const payUrl = `${API_BASE}/api/order_payments?output_format=JSON&display=full`;
              const payJson = await fetchWithCache(
                payUrl,
                async () => {
                  const r = await fetch(payUrl, {
                    headers: { Accept: "application/json" },
                    credentials: "include",
                  });
                  if (!r.ok) throw new Error("http " + r.status);
                  return r.json();
                },
                CACHE_TTL,
              );
              let pays = [];
              if (
                payJson &&
                payJson.order_payments &&
                Array.isArray(payJson.order_payments.order_payment)
              )
                pays = payJson.order_payments.order_payment;
              else if (payJson && Array.isArray(payJson.order_payments))
                pays = payJson.order_payments;
              else if (Array.isArray(payJson)) pays = payJson;
              pays = pays.filter(
                (p) =>
                  String(p.id_order || p.id_order_ref || p.order_id) ===
                  String(
                    orderObj?.id || orderObj?.id_order || orderObj?.reference,
                  ),
              );
              if (!cancelled) setPayments(pays);
            } catch (e) {}

            // histories
            try {
              const hUrl = `${API_BASE}/api/order_histories?output_format=JSON&display=full`;
              const hJson = await fetchWithCache(
                hUrl,
                async () => {
                  const r = await fetch(hUrl, {
                    headers: { Accept: "application/json" },
                    credentials: "include",
                  });
                  if (!r.ok) throw new Error("http " + r.status);
                  return r.json();
                },
                CACHE_TTL,
              );
              let hs = [];
              if (
                hJson &&
                hJson.order_histories &&
                Array.isArray(hJson.order_histories.order_history)
              )
                hs = hJson.order_histories.order_history;
              else if (hJson && Array.isArray(hJson.order_histories))
                hs = hJson.order_histories;
              else if (Array.isArray(hJson)) hs = hJson;
              hs = hs.filter(
                (h) =>
                  String(h.id_order) ===
                  String(orderObj?.id || orderObj?.id_order),
              );
              if (!cancelled) setHistories(hs);
            } catch (e) {}

            // customer messages
            try {
              const cmUrl = `${API_BASE}/api/customer_messages?output_format=JSON&display=full`;
              const cmJson = await fetchWithCache(
                cmUrl,
                async () => {
                  const r = await fetch(cmUrl, {
                    headers: { Accept: "application/json" },
                    credentials: "include",
                  });
                  if (!r.ok) throw new Error("http " + r.status);
                  return r.json();
                },
                CACHE_TTL,
              );
              let cms = [];
              if (
                cmJson &&
                cmJson.customer_messages &&
                Array.isArray(cmJson.customer_messages.customer_message)
              )
                cms = cmJson.customer_messages.customer_message;
              else if (cmJson && Array.isArray(cmJson.customer_messages))
                cms = cmJson.customer_messages;
              else if (Array.isArray(cmJson)) cms = cmJson;
              cms = cms.filter(
                (m) =>
                  String(m.id_customer) === String(orderObj?.id_customer) ||
                  String(m.id_order) === String(orderObj?.id),
              );
              if (!cancelled) setCustomerMessages(cms);
            } catch (e) {}
          } finally {
            if (!cancelled) setSuppLoading(false);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params?.id, propId]);

  if (loading) return <div className="main p-4">Chargement...</div>;
  if (error) return <div className="main p-4">Erreur: {error}</div>;
  if (!order)
    return <div className="main p-4">Aucune commande sélectionnée.</div>;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main p-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <Link to="/commandes" className="btn btn-outline-secondary btn-sm">
              ← Retour
            </Link>
          </div>
          <div>
            <h2 className="m-0">Commande {order.reference}/{order.id || order.reference}</h2>
            <div className="small text-muted">
              Référence: {order.reference || order.id}
            </div>
          </div>
          <div>
            {suppLoading ? (
              <span className="badge bg-secondary">Chargement...</span>
            ) : (
              <select className="form-select form-select-sm">
                <option>
                  {order.current_state_name || order.current_state || "Etat"}
                </option>
                {orderStates.map((s, i) => (
                  <option key={i} value={s.id}>
                    {(s.name && (s.name[0]?.value || s.name[0]?.__text)) ||
                      s.name ||
                      s.id}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="row gx-4">
          <div className="col-md-4">
            <section className="card mb-4">
              <div className="card-body">
                <h5>Client</h5>
                {customer ? (
                  <div>
                    <p className="mb-1">
                      <strong>
                        {customer.firstname} {customer.lastname}
                      </strong>{" "}
                      #{customer.id}
                    </p>
                    <p className="small text-muted mb-1">{customer.email}</p>
                    <p className="small mb-1">
                      {customer.address[0]?.address1}
                    </p>
                    <p className="small text-muted">
                      {customer.country[0]?.name}, {customer.address[0]?.city}
                    </p>
                  </div>
                ) : (
                  <p>—</p>
                )}
              </div>
            </section>

            <section className="card mb-4">
              <div className="card-body">
                <h5>Messages</h5>
                {customerMessages.length === 0 ? (
                  <p className="small text-muted">Aucun message</p>
                ) : (
                  customerMessages.map((m, idx) => (
                    <div key={idx} className="mb-2">
                      <div className="small text-muted">
                        {m.date_add || m.date || m.created_at}
                      </div>
                      <div>
                        {m.message || m.content || m.note || JSON.stringify(m)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="col-md-8">
            <section className="card mb-4">
              <div className="card-body">
                <h5>Produits</h5>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th>Prix unitaire</th>
                        <th>Quantité</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(order.associations && order.associations.order_rows
                        ? order.associations.order_rows
                        : []
                      ).map((r, idx) => (
                        <tr key={idx}>
                          <td>
                            {r.product_name || r.product || r.product_reference}
                          </td>
                          <td>
                            {parseFloat(r.unit_price).toFixed(2) ||
                              parseFloat(r.product_price).toFixed(2) ||
                              parseFloat(r.price).toFixed(2) ||
                              parseFloat(r.unit_price_tax_incl).toFixed(2)}
                          </td>
                          <td>{r.product_quantity || r.quantity || r.qty}</td>
                          <td>
                            {parseFloat(r.total_price).toFixed(2) ||
                              r.total_price_tax_incl ||
                              (r.unit_price && r.product_quantity
                                ? r.unit_price * r.product_quantity
                                : "")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="d-flex justify-content-end">
                  <div>
                    <p className="mb-1">
                      Produits:{" "}
                      <strong>
                        {order.total_products || order.total_products_wt || "—"}
                      </strong>
                    </p>
                    <p className="mb-1">
                      Total:{" "}
                      <strong>{order.total_paid || order.total || "—"}</strong>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="card mb-4">
              <div className="card-body">
                <h5>Informations sur la commande</h5>
                <div className="row">
                  <div className="col-md-6">
                    <p className="mb-1">
                      <strong>Adresse de livraison</strong>
                    </p>
                    <p className="small text-muted mb-1">
                      {order.delivery ||
                        order.delivery_address ||
                        order.delivery_address1 ||
                        "—"}
                    </p>
                    <p className="mb-1">
                      <strong>Transporteur</strong>
                    </p>
                    <p className="small text-muted mb-1">
                      {order.carrier ||
                        order.carrier_name ||
                        order.shipping ||
                        "—"}
                    </p>
                  </div>
                  <div className="col-md-6">
                    <p className="mb-1">
                      <strong>Adresse de facturation</strong>
                    </p>
                    <p className="small text-muted mb-1">
                      {order.invoice ||
                        order.invoice_address ||
                        order.invoice_address1 ||
                        "—"}
                    </p>
                    <p className="mb-1">
                      <strong>Méthode de livraison</strong>
                    </p>
                    <p className="small text-muted mb-1">
                      {order.shipping || order.carrier || "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <h6>Détails bruts (JSON)</h6>
                  <pre
                    className="small bg-light p-2"
                    style={{ maxHeight: 300, overflow: "auto" }}
                  >
                    {JSON.stringify(order, null, 2)}
                  </pre>
                </div>
              </div>
            </section>

            <section className="card mb-4">
              <div className="card-body">
                <h5>Historique des statuts</h5>
                {histories.length === 0 ? (
                  <p className="small text-muted">Aucun historique</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {histories.map((h, i) => (
                      <li key={i} className="list-group-item">
                        <div className="small text-muted">
                          {h.date_add || h.date || h.created_at}
                        </div>
                        <div>
                          {h.id_order_state_name ||
                            h.state_name ||
                            h.change ||
                            JSON.stringify(h)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="card mb-4">
              <div className="card-body">
                <h5>Paiements</h5>
                {payments.length === 0 ? (
                  <p className="small text-muted">Aucun paiement</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Moyen de paiement</th>
                        <th>Montant</th>
                        <th>Référence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p, i) => (
                        <tr key={i}>
                          <td>{p.date_add || p.date || p.payment_date}</td>
                          <td>{p.payment_method || p.payment || p.method}</td>
                          <td>{p.amount || p.total || p.payment_amount}</td>
                          <td>
                            {p.transaction_id || p.id_transaction || p.id}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommandeDetails;
