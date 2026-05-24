import { fetchWithCache } from "../utils/apiCache.js";
import { API_BASE, CACHE_TTL, buildUrl } from "./config/api.js";
import { xmlToJson } from "../utils/xml.convert.js";

export async function fetchCountry(idCountry) {
  const id =
    idCountry && typeof idCountry === "object"
      ? (idCountry.id ??
        idCountry["@id"] ??
        idCountry["@ID"] ??
        idCountry.id_country ??
        (idCountry["@href"]
          ? String(idCountry["@href"]).split("/").pop()
          : undefined))
      : idCountry;
  const url = buildUrl(`countries/${id}?output_format=XML&display=full`);
  return fetchWithCache(url, async () => fetchXmlResponse(url), CACHE_TTL);
}