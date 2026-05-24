/**
 * Transforme une chaîne XML ou un document XML en objet JSON.
 * @param {string|Document} xml - Le contenu XML à convertir.
 * @returns {Object} L'équivalent JSON.
 */
function xmlToJson(xml) {
    // Si l'entrée est une chaîne, on la parse
    if (typeof xml === 'string') {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xml, "text/xml");
        // On commence la conversion à partir de l'élément racine (ex: <prestashop>)
        return xmlToJson(xmlDoc.documentElement);
    }

    let obj = {};

    // Gestion des éléments avec des enfants
    if (xml.nodeType === 1) { // Element node
        if (xml.attributes.length > 0) {
            // Optionnel : décommenter pour inclure les attributs (ex: xlink:href)
            // obj["@attributes"] = {};
            // for (let j = 0; j < xml.attributes.length; j++) {
            //     const attribute = xml.attributes.item(j);
            //     obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
            // }
        }
    } else if (xml.nodeType === 3 || xml.nodeType === 4) { // Text or CDATA node
        return xml.nodeValue.trim();
    }

    // Parcourir les enfants
    if (xml.hasChildNodes()) {
        for (let i = 0; i < xml.childNodes.length; i++) {
            const item = xml.childNodes.item(i);
            const nodeName = item.nodeName;

            // On ignore les nœuds de texte vides (espaces/retours à la ligne)
            if (item.nodeType === 3 && !item.nodeValue.trim()) continue;

            // Récursion
            const res = xmlToJson(item);

            if (typeof (obj[nodeName]) === "undefined") {
                // Premier enfant rencontré avec ce nom
                obj[nodeName] = res;
            } else {
                // Si le nom existe déjà, on transforme en tableau (ex: plusieurs <address>)
                if (typeof (obj[nodeName].push) === "undefined") {
                    const old = obj[nodeName];
                    obj[nodeName] = [];
                    obj[nodeName].push(old);
                }
                obj[nodeName].push(res);
            }
        }
    }

    // Simplification : si l'objet n'a qu'une clé "#text" ou "#cdata-section", on renvoie juste la valeur
    if (typeof obj === 'object') {
        const keys = Object.keys(obj);
        if (keys.length === 1 && (keys[0] === '#text' || keys[0] === '#cdata-section')) {
            return obj[keys[0]];
        }
        // Cas particulier pour les balises vides <tag></tag>
        if (keys.length === 0) return "";
    }

    return obj;
}

// // --- UTILISATION ---

// const xmlData = `...votre XML PrestaShop...`;
// const result = xmlToJson(xmlData);

// // Pour obtenir exactement votre format (sans la racine <prestashop>) :
// const finalJson = result.prestashop; 
// console.log(JSON.stringify(finalJson, null, 4));

export { xmlToJson };