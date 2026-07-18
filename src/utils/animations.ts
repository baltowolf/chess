/**
 * Chessboard Capture Animation Helper
 * Handles smooth clone-based SVG animations when chess pieces are captured.
 */

export function animateCapture(boardContainer: HTMLElement, square: string) {
  if (!boardContainer) return;

  // Find the original board SVG and the elements on the captured square
  const boardSvg = boardContainer.querySelector('svg.cm-chessboard');
  if (!boardSvg) return;

  const squareEl = boardContainer.querySelector(`rect[data-square="${square}"]`);
  const pieceEl = boardContainer.querySelector(`g[data-square="${square}"].piece`);

  if (!squareEl || !pieceEl) return;

  // 1. Get square coordinates in the SVG's viewBox coordinate space
  const x = parseFloat(squareEl.getAttribute("x") || "0");
  const y = parseFloat(squareEl.getAttribute("y") || "0");
  const w = parseFloat(squareEl.getAttribute("width") || "0");
  const h = parseFloat(squareEl.getAttribute("height") || "0");

  const cx = x + w / 2;
  const cy = y + h / 2;

  // 2. Clone the piece element
  const pieceClone = pieceEl.cloneNode(true) as SVGElement;
  pieceClone.removeAttribute("data-square"); // Clean up reference
  pieceClone.classList.add("piece-capture-overlay");

  // 3. Create a custom ripple circle element
  const svgNamespace = "http://www.w3.org/2000/svg";
  const rippleEl = document.createElementNS(svgNamespace, "circle");
  rippleEl.setAttribute("cx", cx.toString());
  rippleEl.setAttribute("cy", cy.toString());
  rippleEl.setAttribute("r", (w * 0.45).toString());
  rippleEl.classList.add("square-capture-ripple");

  // 4. Create a full-size SVG overlay to house the animation
  const overlaySvg = document.createElementNS(svgNamespace, "svg");
  overlaySvg.setAttribute("viewBox", boardSvg.getAttribute("viewBox") || "0 0 100 100");
  overlaySvg.style.position = "absolute";
  overlaySvg.style.top = "0";
  overlaySvg.style.left = "0";
  overlaySvg.style.width = "100%";
  overlaySvg.style.height = "100%";
  overlaySvg.style.pointerEvents = "none";
  overlaySvg.style.zIndex = "40"; // Float above standard pieces but below dropdowns/overlays

  // 5. Append elements to the overlay SVG
  overlaySvg.appendChild(rippleEl);
  overlaySvg.appendChild(pieceClone);

  // 6. Append overlay SVG to the board container
  boardContainer.style.position = "relative"; // Ensure relative context
  boardContainer.appendChild(overlaySvg);

  // 7. Cleanup after animation completes (600ms match with CSS)
  setTimeout(() => {
    if (overlaySvg.parentNode) {
      overlaySvg.parentNode.removeChild(overlaySvg);
    }
  }, 650);
}
