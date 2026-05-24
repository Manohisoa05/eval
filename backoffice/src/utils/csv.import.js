/**
 * Importe un fichier CSV depuis un input HTML
 * @param {File} file - Le fichier provenant de l'input
 */
export function importCSV(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject("Erreur lors de la lecture du fichier");
        reader.readAsText(file);
    });
}

/**
 * Convertit une chaîne CSV en tableau d'objets JSON
 * @param {string} csvData - Le contenu brut du CSV
 * @param {string} delimiter - Par défaut détecte , ou ;
 */
export function csvToJson(csvData, delimiter = null) {
    const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== "");
    
    // Détection automatique du délimiteur si non fourni
    if (!delimiter) {
        delimiter = lines[0].includes(';') ? ';' : ',';
    }

    const headers = parseCsvLine(lines[0], delimiter).map(h => h.trim());

    return lines.slice(1).map(line => {
        const values = parseCsvLine(line, delimiter);
        let obj = {};
        headers.forEach((header, index) => {
            let val = values[index] ? values[index].trim() : "";
            // Nettoyage des guillemets si présents
            obj[header] = val.replace(/^"|"$/g, '');
        });
        return obj;
    });
}

function parseCsvLine(line, delimiter) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            const next = line[i + 1];
            if (inQuotes && next === '"') {
                current += '"';
                i++;
                continue;
            }
            inQuotes = !inQuotes;
            continue;
        }

        if (char === delimiter && !inQuotes) {
            result.push(current);
            current = "";
            continue;
        }

        current += char;
    }

    result.push(current);
    return result;
}

/**
 * Convertit un tableau JSON en chaîne XML
 * @param {Array} jsonData - Le tableau d'objets
 * @param {string|object} rootName - Nom de la balise racine (ex: 'prestashop') ou options
 * @param {string} itemName - Nom de chaque élément (ex: 'address')
 */
export function jsonToXml(jsonData, rootName = "root", itemName = "item") {
    const opts = typeof rootName === 'object' && rootName !== null
        ? rootName
        : { rootName, itemName };
    const rootTag = opts.rootName || 'root';
    const itemTag = opts.itemName || itemName || 'item';
    const containerTag = opts.containerName || null;
    const containerWhenMultiple = !!opts.containerWhenMultiple;
    const rootAttrs = opts.rootAttrs || {};

    function attrsToString(attrs) {
        const parts = [];
        for (const k in attrs) {
            if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
            const v = attrs[k] == null ? '' : String(attrs[k]);
            parts.push(`${k}="${v.replace(/"/g, '&quot;')}"`);
        }
        return parts.length ? ' ' + parts.join(' ') : '';
    }

    function sanitizeTagName(name) {
        const clean = String(name || '').trim().replace(/[^A-Za-z0-9_:\-]+/g, '_');
        if (!clean) return 'field';
        if (/^[0-9]/.test(clean)) return `f_${clean}`;
        return clean;
    }

    function toTextValue(val) {
        if (val === null || val === undefined) return '';
        return String(val);
    }

    function splitKey(rawKey) {
        const str = String(rawKey || '').trim();
        if (!str) return null;
        const atIndex = str.indexOf('@');
        const pathStr = atIndex === -1 ? str : str.slice(0, atIndex);
        const attrName = atIndex === -1 ? null : str.slice(atIndex + 1).trim();
        const path = pathStr.split('.').map(sanitizeTagName).filter(Boolean);
        return path.length ? { path, attrName } : null;
    }

    function ensureObject(node) {
        if (!node || typeof node !== 'object' || Array.isArray(node)) return { '#text': node };
        return node;
    }

    function setDeep(tree, path, value, attrName) {
        let curr = tree;
        for (let i = 0; i < path.length; i++        ) {
            const key = path[i];
            const isLast = i === path.length - 1;
            if (curr[key] === undefined) {
                curr[key] = isLast ? (attrName ? { '@attrs': {} } : value) : {};
            }
            if (!isLast) {
                curr[key] = ensureObject(curr[key]);
                curr = curr[key];
                continue;
            }
            if (attrName) {
                const nodeObj = ensureObject(curr[key]);
                const attrs = nodeObj['@attrs'] || {};
                attrs[attrName] = value;
                nodeObj['@attrs'] = attrs;
                curr[key] = nodeObj;
            } else if (typeof curr[key] === 'object' && curr[key] !== null && !Array.isArray(curr[key])) {
                curr[key]['#text'] = value;
            } else {
                curr[key] = value;
            }
        }
    }

    function buildTree(obj) {
        const tree = {};
        const order = [];
        const seen = new Set();

        for (const rawKey in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, rawKey)) continue;
            const val = obj[rawKey];
            const keyInfo = splitKey(rawKey);
            if (keyInfo) {
                const top = keyInfo.path[0];
                if (!seen.has(top)) {
                    seen.add(top);
                    order.push(top);
                }
                setDeep(tree, keyInfo.path, val, keyInfo.attrName);
                continue;
            }
            const top = sanitizeTagName(rawKey);
            if (!seen.has(top)) {
                seen.add(top);
                order.push(top);
            }
            tree[top] = val;
        }

        return { tree, order };
    }

    function renderNode(tag, value, indent) {
        if (Array.isArray(value)) {
            return value.map(v => renderNode(tag, v, indent)).join('');
        }

        if (value && typeof value === 'object') {
            const attrs = value['@attrs'] || value['@attributes'] || {};
            const textValue = value['#cdata'] !== undefined
                ? value['#cdata']
                : value['#text'] !== undefined
                    ? value['#text']
                    : null;

            const childKeys = Object.keys(value).filter(
                k => !['@attrs', '@attributes', '#text', '#cdata'].includes(k),
            );

            let xml = `${indent}<${tag}${attrsToString(attrs)}>`;
            if (childKeys.length === 0) {
                xml += `<![CDATA[${toTextValue(textValue)}]]></${tag}>\n`;
                return xml;
            }

            xml += `\n`;
            for (const childKey of childKeys) {
                const childTag = sanitizeTagName(childKey);
                xml += renderNode(childTag, value[childKey], indent + '  ');
            }
            xml += `${indent}</${tag}>\n`;
            return xml;
        }

        return `${indent}<${tag}><![CDATA[${toTextValue(value)}]]></${tag}>\n`;
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<${rootTag}${attrsToString(rootAttrs)}>\n`;
    const items = Array.isArray(jsonData) ? jsonData : [jsonData];
    const useContainer = containerTag && (!containerWhenMultiple || items.length > 1);
    if (useContainer) xml += `  <${containerTag}>\n`;

    items.forEach(obj => {
        xml += `  <${itemTag}>\n`;
        const { tree, order } = buildTree(obj || {});
        for (const key of order) {
            const tag = sanitizeTagName(key);
            xml += renderNode(tag, tree[key], '    ');
        }
        xml += `  </${itemTag}>\n`;
    });

    if (useContainer) xml += `  </${containerTag}>\n`;
    xml += `</${rootTag}>`;
    return xml;
}

export default { importCSV, csvToJson, jsonToXml };