function buildHeaderMap(aliasesByTarget) {
  const map = {};
  Object.entries(aliasesByTarget || {}).forEach(([target, aliases]) => {
    const list = Array.isArray(aliases) ? aliases : [aliases];
    list.forEach((alias) => {
      map[String(alias)] = target;
    });
  });
  return map;
}

function normalizeHeaderName(name) {
  return String(name || "")
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function buildEntityConfig(config) {
  const normalizedMap = Object.fromEntries(
    Object.entries(config.headerMap || {}).map(([key, value]) => [
      normalizeHeaderName(key),
      value,
    ]),
  );
  return { ...config, headerMapNormalized: normalizedMap };
}

const PRODUCT_HEADER_MAP = buildHeaderMap({
  id: ["product_id", "id_product"],
  active: ["active_0_1_", "active_0_1", "active"],
  "name.language": ["name_", "name", "name_*", "product_name", "nom"],
  id_category_default: ["id_category_default"],
  categorie: ["categorie", "category"],
  price: ["price_tax_excluded", "price", "prix_ttc", "prix"],
  id_tax_rules_group: ["tax_rules_id", "id_tax_rules_group", "taxe"],
  reference: ["reference__", "reference_", "reference"],
  ean13: ["ean13"],
  weight: ["weight"],
  minimal_quantity: ["minimal_quantity"],
  visibility: ["visibility"],
  condition: ["condition"],
  "description_short.language": ["summary", "description_short"],
  "description.language": ["description"],
  "link_rewrite.language": ["url_rewritten", "link_rewrite"],
  available_for_order: [
    "available_for_order_0_no_1_yes",
    "available_for_order",
  ],
  show_price: ["show_price_0_no_1_yes", "show_price"],
  supplier_reference: ["supplier_reference"],
  upc: ["upc"],
  wholesale_price: ["wholesale_price", "prix_achat"],
  on_sale: ["on_sale_0_1", "on_sale"],
  ecotax: ["ecotax"],
  width: ["width"],
  height: ["height"],
  depth: ["depth"],
  quantity: ["quantity"],
  low_stock_threshold: ["low_stock_level", "low_stock_threshold"],
  low_stock_alert: [
    "receive_a_low_stock_alert_by_email",
    "low_stock_alert",
  ],
  additional_shipping_cost: ["additional_shipping_cost"],
  unity: ["unity"],
  unit_price: ["unit_price"],
  "meta_title.language": ["meta_title"],
  "meta_keywords.language": ["meta_keywords"],
  "meta_description.language": ["meta_description"],
  tags: ["tags_x_y_z", "tags"],
  "available_now.language": ["text_when_in_stock", "available_now"],
  "available_later.language": [
    "text_when_backorder_allowed",
    "available_later",
  ],
  available_date: [
    "product_available_date",
    "available_date",
    "date_availability_produit",
  ],
  online_only: ["available_online_only_0_no_1_yes", "online_only"],
  customizable: ["customizable"],
  uploadable_files: ["uploadable_files"],
  text_fields: ["text_fields"],
  out_of_stock: ["out_of_stock_action"],
  is_virtual: ["virtual_product"],
});

const CATEGORY_HEADER_MAP = buildHeaderMap({
  id: ["category_id", "id", "id_category"],
  active: ["active_0_1_", "active_0_1", "active"],
  "name.language": ["name_", "name", "name_*"],
  id_parent: ["parent_category", "id_parent"],
  "description.language": ["description"],
  "meta_title.language": ["meta_title"],
  "meta_keywords.language": ["meta_keywords"],
  "meta_description.language": ["meta_description"],
  "link_rewrite.language": ["url_rewritten", "link_rewrite"],
});

const CUSTOMER_HEADER_MAP = buildHeaderMap({
  id: ["customer_id", "id_customer"],
  email: [
    "email_",
    "email",
    "customer_e_mail",
    "customer_email",
    "email *",
  ],
  passwd: ["password", "password_", "password *"],
  firstname: ["first_name", "firstname", "first name *"],
  lastname: ["last_name", "lastname", "last name *"],
  active: ["active_0_1_", "active_0_1", "active"],
  id_gender: [
    "titles_id_mr_1_ms_2_else_0",
    "titles_id",
    "id_gender",
    "titles id (mr = 1, ms = 2, else 0)",
  ],
  newsletter: ["newsletter_0_1", "newsletter", "newsletter (0/1)"],
  optin: ["opt_in_0_1", "opt_in", "optin", "opt-in (0/1)"],
  birthday: ["birthday_yyyy_mm_dd", "birthday", "birthday (yyyy-mm-dd)"],
  date_add: [
    "registration_date_yyyy_mm_dd",
    "registration_date",
    "registration date (yyyy-mm-dd)",
    "date_add",
  ],
  id_default_group: ["default group id"],
});

const ADDRESS_HEADER_MAP = buildHeaderMap({
  alias: ["alias", "alias_"],
  firstname: ["firstname", "first_name", "firstname_*"],
  lastname: ["lastname", "last_name", "lastname_*"],
  address1: ["address_1", "address1", "address_1_*"],
  address2: ["address_2", "address2"],
  postcode: ["zipcode", "postcode", "zipcode_*"],
  city: ["city", "city_*"],
  country: ["country", "country_*"],
  state: ["state"],
  phone: ["phone"],
  phone_mobile: ["mobile_phone", "phone_mobile"],
  vat_number: ["vat_number"],
  dni: ["dni"],
  other: ["other"],
});

const BRAND_HEADER_MAP = buildHeaderMap({
  id: ["id", "manufacturer_id", "id_manufacturer"],
  active: ["active_0_1_", "active_0_1", "active"],
  name: ["name_", "name", "name_*"],
  "description.language": ["description"],
  "short_description.language": ["short_description"],
  "meta_title.language": ["meta_title"],
  "meta_keywords.language": ["meta_keywords"],
  "meta_description.language": ["meta_description"],
});

const SUPPLIER_HEADER_MAP = buildHeaderMap({
  id: ["supplier_id", "id", "id_supplier"],
  active: ["active_0_1_", "active_0_1", "active"],
  name: ["name_", "name", "name_*"],
  "description.language": ["description"],
  "meta_title.language": ["meta_title"],
  "meta_keywords.language": ["meta_keywords"],
  "meta_description.language": ["meta_description"],
});

const ALIAS_HEADER_MAP = buildHeaderMap({
  alias: ["alias_", "alias", "alias_*"],
  search: ["search_", "search", "search_*"],
});

const STORE_CONTACTS_HEADER_MAP = buildHeaderMap({
  id: ["store_id", "id_store"],
  active: ["active"],
  name: ["name"],
  address1: ["address1"],
  address2: ["address2"],
  postcode: ["postcode"],
  state: ["state"],
  city: ["city"],
  country: ["country"],
  latitude: ["latitude"],
  longitude: ["longitude"],
  phone: ["phone"],
  fax: ["fax"],
  email: ["email"],
  note: ["note"],
});

const COMBINATIONS_HEADER_MAP = buildHeaderMap({
  product_id: ["product_id", "product_id_"],
  reference: ["reference"],
  supplier_reference: ["supplier_reference"],
  ean13: ["ean13"],
  upc: ["upc"],
  wholesale_price: ["wholesale_price"],
  impact_on_price: ["impact_on_price"],
  price: ["price"],
  ecotax: ["ecotax"],
  impact_on_weight: ["impact_on_weight"],
  quantity: ["quantity"],
  minimal_quantity: ["minimal_quantity"],
  low_stock_level: ["low_stock_level"],
  default_on: ["default_0_no_1_yes", "default"],
  available_date: ["combination_available_date"],
});

const SUPPLY_ORDERS_HEADER_MAP = buildHeaderMap({
  id_supplier: ["supplier_id", "supplier_id_"],
  id_warehouse: ["warehouse_id", "warehouse_id_"],
  id_lang: ["lang_id", "lang_id_"],
  id_currency: ["currency_id", "currency_id_"],
  reference: ["supply_order_reference", "supply_order_reference_"],
  delivery_date: ["delivery_date_y_m_d", "delivery_date"],
});

const SUPPLY_ORDER_DETAILS_HEADER_MAP = buildHeaderMap({
  reference: ["supply_order_reference_"],
  id_product: ["product_id_"],
  id_product_attribute: ["product_attribute_id"],
  unit_price_tax_excl: ["unit_price_tax_excl_", "unit_price_tax_excl"],
  quantity_expected: ["quantity_expected_"],
  discount_rate: ["discount_rate"],
  tax_rate: ["tax_rate"],
});

const IMPORT_FILE2_HEADER_MAP = buildHeaderMap({
  reference: ["reference"],
  specificite: ["specificité", "specificite"],
  karazany: ["karazany"],
  prix_vente_ttc: ["prix_vente_ttc", "prix vente ttc"],
  stock_initial: ["stock_initial", "stock initial"],
});

const IMPORT_FILE3_HEADER_MAP = buildHeaderMap({
  email: ["email"],
  nom: ["nom", "name"],
  pwd: ["pwd", "password", "mot_de_passe"],
  adresse: ["adresse", "address"],
  achat: ["achat"],
  date: ["date", "date_commande", "date_achat"],
  etat: ["etat", "état", "state"],
});

const ENTITY_CONFIG = {
  product: buildEntityConfig({
    endpoint: "products",
    itemName: "product",
    containerName: "products",
    headerMap: PRODUCT_HEADER_MAP,
    requiredFields: ["price"],
    skipFields: ["quantity", "categorie"],
    keepUnknown: false,
  }),
  category: buildEntityConfig({
    endpoint: "categories",
    itemName: "category",
    containerName: null,
    headerMap: CATEGORY_HEADER_MAP,
    requiredFields: [],
    skipFields: [],
    keepUnknown: false,
  }),
  order: buildEntityConfig({
    endpoint: "orders",
    itemName: "order",
    containerName: null,
    headerMap: {},
    requiredFields: [],
    skipFields: [],
    keepUnknown: true,
  }),
  customer: buildEntityConfig({
    endpoint: "customers",
    itemName: "customer",
    containerName: null,
    headerMap: CUSTOMER_HEADER_MAP,
    requiredFields: [],
    skipFields: [],
    keepUnknown: false,
  }),
  address: buildEntityConfig({
    endpoint: "addresses",
    itemName: "address",
    containerName: null,
    headerMap: ADDRESS_HEADER_MAP,
    requiredFields: [],
    skipFields: [],
    keepUnknown: false,
  }),
  brand: buildEntityConfig({
    endpoint: "manufacturers",
    itemName: "manufacturer",
    containerName: null,
    headerMap: BRAND_HEADER_MAP,
    requiredFields: [],
    skipFields: [],
    keepUnknown: false,
  }),
  supplier: buildEntityConfig({
    endpoint: "suppliers",
    itemName: "supplier",
    containerName: null,
    headerMap: SUPPLIER_HEADER_MAP,
    requiredFields: [],
    skipFields: [],
    keepUnknown: false,
  }),
  alias: buildEntityConfig({
    endpoint: "aliases",
    itemName: "alias",
    containerName: null,
    headerMap: ALIAS_HEADER_MAP,
    requiredFields: [],
    skipFields: [],
    keepUnknown: false,
  }),
  store_contact: buildEntityConfig({
    endpoint: "stores",
    itemName: "store",
    containerName: null,
    headerMap: STORE_CONTACTS_HEADER_MAP,
    requiredFields: [],
    skipFields: [],
    keepUnknown: false,
  }),
  combination: buildEntityConfig({
    endpoint: "combinations",
    itemName: "combination",
    containerName: null,
    headerMap: COMBINATIONS_HEADER_MAP,
    requiredFields: [],
    skipFields: [],
    keepUnknown: false,
  }),
  supply_order: buildEntityConfig({
    endpoint: "supply_orders",
    itemName: "supply_order",
    containerName: null,
    headerMap: SUPPLY_ORDERS_HEADER_MAP,
    requiredFields: [],
    skipFields: [],
    keepUnknown: false,
  }),
  supply_order_detail: buildEntityConfig({
    endpoint: "supply_order_details",
    itemName: "supply_order_detail",
    containerName: null,
    headerMap: SUPPLY_ORDER_DETAILS_HEADER_MAP,
    requiredFields: [],
    skipFields: [],
    keepUnknown: false,
  }),
  import_file2: buildEntityConfig({
    endpoint: null,
    itemName: null,
    containerName: null,
    headerMap: IMPORT_FILE2_HEADER_MAP,
    requiredFields: [],
    skipFields: [],
    keepUnknown: false,
  }),
  import_file3: buildEntityConfig({
    endpoint: null,
    itemName: null,
    containerName: null,
    headerMap: IMPORT_FILE3_HEADER_MAP,
    requiredFields: [],
    skipFields: [],
    keepUnknown: false,
  }),
};

export { ENTITY_CONFIG, normalizeHeaderName };

export function getEntityConfig(entity) {
  return ENTITY_CONFIG[entity] || null;
}
