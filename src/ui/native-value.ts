/**
 * Sets an input's value the way typing does, so React and react-hook-form (`register`)
 * receive a normal change event (used by MoneyInput arrows and the date picker).
 */
export function setNativeValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
