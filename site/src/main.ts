import { ensureKlallamFont, getPoints } from "@klallam/game-kit";
import "./style.css";

// Loaded before anything shows a word, so no Klallam is ever drawn in a fallback font.
void ensureKlallamFont();

const score = document.querySelector("#total-score");
if (score !== null) score.textContent = String(getPoints());
