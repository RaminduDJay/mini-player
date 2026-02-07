'use strict';

(() => {
  const MP = globalThis.__MiniPlayer || (globalThis.__MiniPlayer = {});

  function cssPath(el) {
    if (!el || !el.parentElement) return '';
    const parts = [];
    let node = el;

    while (node && node.nodeType === 1 && node !== document.body) {
      const tag = node.tagName.toLowerCase();
      let part = tag;

      if (node.id) {
        part = `#${CSS.escape(node.id)}`;
        parts.unshift(part);
        break;
      }

      const siblings = Array.from(node.parentElement.children).filter(
        (n) => n.tagName === node.tagName
      );
      if (siblings.length > 1) {
        const idx = siblings.indexOf(node) + 1;
        part = `${tag}:nth-of-type(${idx})`;
      }
      parts.unshift(part);
      node = node.parentElement;
    }

    return parts.join(' > ');
  }

  function fieldKey(el) {
    const tag = (el.tagName || '').toLowerCase();
    const type = (el.type || '').toLowerCase();
    const formIdx = el.form ? Array.from(document.forms).indexOf(el.form) : -1;

    if (el.id) return { kind: 'id', value: el.id };
    if (el.name) return { kind: 'name', value: `${el.name}|${tag}|${type}|${formIdx}` };

    return { kind: 'selector', value: cssPath(el) };
  }

  MP.MiniPlayerDOM = {
    cssPath,
    fieldKey
  };

  globalThis.MiniPlayerDOM = MP.MiniPlayerDOM;
})();
