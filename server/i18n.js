const path = require('path');
const create = require('../public/assets/i18n/i18n.js');
const catalog = {};
for (const lang of ['en','fr','de']) {
  for (const [key,value] of Object.entries(require('../public/assets/i18n/'+lang+'.json'))) {
    (catalog[key] ||= {})[lang] = value;
  }
}
const engine = create(catalog);
const normalizeLanguage = value => {
  const candidate = String(value || '').toLowerCase().split(/[-_]/)[0];
  return ['en','it','fr','de'].includes(candidate) ? candidate : 'en';
};
const locale = normalizeLanguage(process.env.DEFAULT_UI_LANGUAGE || 'en');
module.exports = { locale, normalizeLanguage, t: (value, language = locale) => engine.t(value, normalizeLanguage(language)) };
