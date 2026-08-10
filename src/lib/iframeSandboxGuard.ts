/**
 * Global iframe sandbox guard.
 *
 * Removes the `sandbox` attribute from every <iframe> on the page and keeps
 * watching the DOM so that any framework / third-party script that re-injects
 * one will have it stripped immediately.
 *
 * Why: external embed providers (UPNShare, Streamtape, Doodstream, etc.) break
 * under sandboxing, and we want a hard guarantee that no sandbox attribute is
 * applied to ANY iframe in the app.
 */

let installed = false;

function stripSandbox(iframe: HTMLIFrameElement) {
  // ClonePlatform deliberately uses a strict sandbox to contain redirect ads.
  // Other video embeds keep the legacy unsandboxed behavior they require.
  if (iframe.dataset.preserveSandbox === 'true') return;
  if (iframe.hasAttribute('sandbox')) {
    iframe.removeAttribute('sandbox');
  }
}

export function installIframeSandboxGuard() {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  // 1) Strip from anything already in the DOM.
  document.querySelectorAll('iframe').forEach((el) => stripSandbox(el as HTMLIFrameElement));

  // 2) Watch for any future <iframe> nodes or `sandbox` attribute mutations.
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'sandbox' && m.target instanceof HTMLIFrameElement) {
        stripSandbox(m.target);
        continue;
      }
      if (m.type === 'childList') {
        m.addedNodes.forEach((node) => {
          if (node instanceof HTMLIFrameElement) {
            stripSandbox(node);
          } else if (node instanceof Element) {
            node.querySelectorAll?.('iframe').forEach((el) => stripSandbox(el as HTMLIFrameElement));
          }
        });
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['sandbox'],
  });

  // 3) Override Element.setAttribute so direct setAttribute('sandbox', ...)
  //    calls are silently ignored on iframes.
  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name: string, value: string) {
    if (
      this instanceof HTMLIFrameElement &&
      name.toLowerCase() === 'sandbox' &&
      this.dataset.preserveSandbox !== 'true'
    ) {
      return;
    }
    return originalSetAttribute.call(this, name, value);
  };
}
