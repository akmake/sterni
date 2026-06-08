// client/src/utils/sanitizeHtml.js
//
// Central HTML sanitizer for every `dangerouslySetInnerHTML` in the app.
// User-editable content (quote blocks, table cells, payment-request bodies,
// order notes) is stored as raw HTML and rendered back — without sanitizing it
// here, a stored XSS payload (e.g. <img src=x onerror=...>) would execute in the
// browser of anyone who views it. DOMPurify strips scripts and event handlers
// while preserving the formatting tags the rich-text editors actually produce.

import DOMPurify from 'dompurify';

// Formatting the quote / payment editors emit (bold, italic, alignment, tables…).
const ALLOWED_TAGS = [
  'b', 'strong', 'i', 'em', 'u', 's', 'br', 'p', 'div', 'span',
  'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tr', 'td', 'th', 'img', 'hr', 'sub', 'sup',
];

const ALLOWED_ATTR = ['style', 'class', 'href', 'target', 'rel', 'src', 'alt', 'dir', 'align', 'colspan', 'rowspan'];

/**
 * Sanitize an HTML string before it is injected via dangerouslySetInnerHTML.
 * @param {unknown} dirty - the untrusted HTML (anything non-string returns '').
 * @returns {string} safe HTML
 */
export const sanitizeHtml = (dirty) => {
  if (typeof dirty !== 'string' || dirty.length === 0) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Block javascript:/data: URIs in href/src; allow http(s), mailto, tel, and inline images.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
};

export default sanitizeHtml;
