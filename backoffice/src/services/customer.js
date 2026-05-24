import { fetchWithCache } from "../utils/apiCache.js";
import { API_BASE, CACHE_TTL, buildUrl } from "./config/api.js";
import { xmlToJson } from "../utils/xml.convert.js";
import { fetchXmlResponse } from "./config/api.js";

export async function fetchCustomers() {
  const url = buildUrl(`customers?output_format=XML&display=full`);
  return fetchWithCache(url, async () => fetchXmlResponse(url), CACHE_TTL);
}

export async function fetchCustomer(idCustomer) {
  const id =
    idCustomer && typeof idCustomer === "object"
      ? (idCustomer.id ??
        idCustomer["@id"] ??
        idCustomer["@ID"] ??
        idCustomer.id_customer ??
        idCustomer.customer_id ??
        (idCustomer["@href"]
          ? String(idCustomer["@href"]).split("/").pop()
          : undefined))
      : idCustomer;
  const url = buildUrl(`customers/${id}?output_format=XML&display=full`);
  return fetchWithCache(url, async () => fetchXmlResponse(url), CACHE_TTL);
}

export async function fetchCustomerDetailed(idCustomer) {
  const xml = await fetchCustomer(idCustomer);
  if (!xml) return null;
  let parsed = null;
  try {
    parsed = xmlToJson(xml);
  } catch (e) {
    return null;
  }
  return parsed;
}

export async function fetchAddressesByCustomer(idCustomer) {
  const url = buildUrl(
    `addresses?filter[id_customer]=${idCustomer}&output_format=XML&display=full`,
  );
  return fetchWithCache(url, async () => fetchXmlResponse(url), CACHE_TTL);
}

export async function fetchCustomerMessages() {
  const url = buildUrl(`customer_messages?output_format=XML&display=full`);
  return fetchWithCache(url, async () => fetchXmlResponse(url), CACHE_TTL);
}

// GET Customer name (fetchCustomerDetailed returns parsed XML object)
export async function getCustomerName(idCustomer) {
  let customer = "—";
  try {
    if (idCustomer) {
      const custParsed = await fetchCustomerDetailed(idCustomer);
      const custNode = custParsed.customer;
      const fname = custNode && custNode.firstname;
    //   const lname = (custNode && custNode.lastname) || "";
    //   const name = (fname + " " + lname).trim();
    const name = fname || "";
      if (name) customer = name;
    }
  } catch (e) {
    // ignore, keep placeholder
  }
  return customer;
}

export default {
  fetchCustomer,
  fetchCustomerDetailed,
  fetchAddressesByCustomer,
  fetchCustomerMessages,
  getCustomerName,
};
