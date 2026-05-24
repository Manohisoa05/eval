import { buildUrl, fetchXmlResponse } from "./config/api";
import { xmlToJson } from "../utils/xml.convert";

export async function fetchCustomers() {
  const url = buildUrl(`customers?output_format=XML&display=full`);
  return fetchXmlResponse(url); // On ignore fetchWithCache pour tester
}

export async function fetchCustomersDetailed() {
  const xml = await fetchCustomers();
  if (!xml) {
    return [];
  }
  let parsed = null;
  try {
    parsed = xmlToJson(xml);
  } catch (error) {
    console.error("Error parsing XML:", error);
  }
  return parsed;
}

export async function fetchCustomer(idCustomer) {
  const id =
    idCustomer && typeof idCustomer === "object" ? idCustomer.id : idCustomer;
  const url = buildUrl(`customers/${id}?output_format=XML&display=full`);
  return fetchXmlResponse(url);
}

export async function fetchCustomerDetailed(idCustomer) {
  const xml = await fetchCustomer(idCustomer);
  if (!xml) return null;
  let parsed = null;
  try {
    parsed = xmlToJson(xml);
  } catch (error) {
    console.error("Error parsing XML:", error);
  }
  return parsed;
}
