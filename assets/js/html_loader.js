export async function loadHtmlFragment(url, targetSelector) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  const html = await res.text();

  const target = document.querySelector(targetSelector);
  if (!target) throw new Error(`Target ${targetSelector} not found`);

  target.insertAdjacentHTML("beforeend", html);
}
