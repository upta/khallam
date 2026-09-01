/** The family name games use in their stylesheets. */
export const KLALLAM_FONT_FAMILY = "Charis";

const FONT_URL = `${import.meta.env.BASE_URL}fonts/Charis-Regular.woff2`;

let loading: Promise<void> | null = null;

/**
 * Klallam stacks combining marks that system fonts misplace, so anything showing it
 * waits for this font rather than swapping in whatever is already on the machine.
 *
 * Registered on the document rather than through an @font-face rule, because a rule
 * written inside a sealed-off game root is ignored and the marks would land wrong.
 */
export function ensureKlallamFont(): Promise<void> {
  loading ??= load();
  return loading;
}

async function load(): Promise<void> {
  const face = new FontFace(KLALLAM_FONT_FAMILY, `url("${FONT_URL}") format("woff2")`, {
    weight: "400",
    style: "normal",
    display: "block",
  });
  try {
    await face.load();
    document.fonts.add(face);
  } catch (error) {
    console.error("The Klallam font did not load, so marks may render wrongly:", FONT_URL, error);
  }
}
