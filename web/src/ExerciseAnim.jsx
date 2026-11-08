import { useEffect, useMemo, useState } from "react";
import { exerciseSvg } from "./exerciseAnim.js";

const QUERY = "(prefers-reduced-motion: reduce)";

function useReducedMotion() {
  const [reduce, setReduce] = useState(() => typeof window !== "undefined" && window.matchMedia?.(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(QUERY);
    if (!mq) return;
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

/** Boneco animado mostrando o movimento do exercício (parado se o sistema pedir menos animação). */
export default function ExerciseAnim({ name, group, size = 48, className = "" }) {
  const reduce = useReducedMotion();
  // O SVG é gerado só a partir de dados estáticos do módulo; nome/grupo apenas escolhem o padrão.
  const html = useMemo(() => exerciseSvg(name, group, { animate: !reduce }), [name, group, reduce]);
  return (
    <span
      className={"ea-wrap " + className}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Animação: ${name || group || "exercício"}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
