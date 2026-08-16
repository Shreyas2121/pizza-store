import { useEffect } from "react";
import { useLocation } from "react-router";

const MAX_HASH_SCROLL_FRAMES = 120;

export const ScrollManager = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }

    const targetId = decodeURIComponent(hash.slice(1));
    let frame = 0;
    let animationFrame = 0;

    const scrollToHash = () => {
      const target = document.getElementById(targetId);

      if (target) {
        target.scrollIntoView({ block: "start", behavior: "auto" });
        return;
      }

      frame += 1;
      if (frame < MAX_HASH_SCROLL_FRAMES) {
        animationFrame = window.requestAnimationFrame(scrollToHash);
      }
    };

    animationFrame = window.requestAnimationFrame(scrollToHash);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [pathname, hash]);

  return null;
};
