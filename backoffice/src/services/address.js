import { fetchWithCache } from "../utils/apiCache.js";
import { API_BASE, CACHE_TTL, buildUrl } from "./config/api.js";
import { xmlToJson } from "../utils/xml.convert.js";
import { fetchXmlResponse } from "./config/api.js";

export async function fetchAddresses() {
  const url = buildUrl(`addresses?output_format=XML&display=full`);
  return fetchWithCache(url, async () => fetchXmlResponse(url), CACHE_TTL);
}

export async function fetchAddress(id) {
  const url = buildUrl(`addresses/${id}?output_format=XML&display=full`);
  return fetchWithCache(url, async () => fetchXmlResponse(url), CACHE_TTL);
}

export async function fetchAddressesDetailed() {
  const xml = await fetchAddresses();
  if (!xml) return [];
  let parsed = null;
  try {
    parsed = xmlToJson(xml);
  } catch (e) {
    return [];
  }
  return parsed;
}

export async function fetchAddressDetailed(id) {
  const xml = await fetchAddress(id);
  if (!xml) return null;
  let parsed = null;
  try {
    parsed = xmlToJson(xml);
  } catch (e) {
    return null;
  }
  return parsed;
}

export async function fetchCountries() {
  const url = buildUrl(`countries?output_format=XML&display=full`);
  return fetchWithCache(url, async () => fetchXmlResponse(url), CACHE_TTL);
}

export async function fetchCountry(id) {
  const url = buildUrl(`countries/${id}?output_format=XML&display=full`);
  return fetchWithCache(url, async () => fetchXmlResponse(url), CACHE_TTL);
}

export async function fetchCountriesDetailed() {
  const xml = await fetchCountries();
  if (!xml) return [];
  let parsed = null;
  try {
    parsed = xmlToJson(xml);
  } catch (e) {
    return [];
  }
  return parsed;
}

export async function fetchCountryDetailed(id) {
  const xml = await fetchCountry(id);
  if (!xml) return null;
  let parsed = null;
  try {
    parsed = xmlToJson(xml);
  } catch (e) {
    return null;
  }
  return parsed;
}

export async function getCountryNameByCityId(idCity) {
  const city = await fetchAddressDetailed(idCity);
  if (!city || !city.address) return null;
  const idCountry = city.address.id_country;
  if (!idCountry) return null;
  const country = await fetchCountryDetailed(idCountry);
  if (!country || !country.country) return null;
  return country.country.name.language || null;
}

export default {
  fetchAddresses,
  fetchAddress,
  fetchCountries,
  fetchCountry,
  fetchAddressDetailed,
  fetchCountryDetailed, 
  fetchAddressesDetailed,
  getCountryNameByCityId,
};
