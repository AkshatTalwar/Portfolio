(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");
  const header = document.querySelector(".site-header");
  const navLinks = [...document.querySelectorAll('.desktop-nav a[href^="#"]')];
  const sections = [...document.querySelectorAll("main section[id]")];

  const updateHeader = () => header?.classList.toggle("scrolled", window.scrollY > 18);
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  const revealItems = [...document.querySelectorAll(".reveal")];
  revealItems.forEach((item) => item.style.setProperty("--delay", `${Number(item.dataset.delay || 0)}ms`));

  if ("IntersectionObserver" in window && !reducedMotion.matches) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -5%" });
    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("visible"));
  }

  if ("IntersectionObserver" in window && navLinks.length) {
    const sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`));
    }, { threshold: [0.2, 0.45, 0.7], rootMargin: "-20% 0px -50%" });
    sections.forEach((section) => sectionObserver.observe(section));
  }

  const parallaxElements = [...document.querySelectorAll("[data-parallax]")];
  let pointerX = 0;
  let pointerY = 0;
  window.addEventListener("pointermove", (event) => {
    if (reducedMotion.matches || !finePointer.matches) return;
    pointerX = event.clientX / window.innerWidth - 0.5;
    pointerY = event.clientY / window.innerHeight - 0.5;
    parallaxElements.forEach((element) => {
      const depth = Number(element.dataset.parallax || 12);
      element.style.setProperty("--parallax-x", `${pointerX * depth}px`);
      element.style.setProperty("--parallax-y", `${pointerY * depth}px`);
    });
  }, { passive: true });

  document.querySelectorAll("[data-tilt]").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      if (reducedMotion.matches || !finePointer.matches) return;
      const bounds = card.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      card.style.setProperty("--glass-x", `${(x + 0.5) * 100}%`);
      card.style.setProperty("--glass-y", `${(y + 0.5) * 100}%`);
      card.style.transform = `perspective(900px) rotateX(${-y * 5}deg) rotateY(${x * 6}deg) translateY(-3px)`;
    });
    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
  });

  const canvas = document.querySelector("#scene");
  const context = canvas?.getContext("2d", { alpha: true });
  if (!canvas || !context) return;

  const count = 76;
  const points = Array.from({ length: count }, (_, index) => {
    const y = 1 - (index / (count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = Math.PI * (3 - Math.sqrt(5)) * index;
    return { x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius, size: index % 11 === 0 ? 2.3 : 1.3 };
  });

  let width = 0;
  let height = 0;
  let frame = 0;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 1.75);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    context.setTransform(scale, 0, 0, scale, 0, 0);
  };

  const project = (point, time) => {
    const spin = time * 0.00008;
    const cosY = Math.cos(spin);
    const sinY = Math.sin(spin);
    const tilt = -0.18 + pointerY * 0.14;
    const cosX = Math.cos(tilt);
    const sinX = Math.sin(tilt);
    const x1 = point.x * cosY - point.z * sinY;
    const z1 = point.x * sinY + point.z * cosY;
    const y1 = point.y * cosX - z1 * sinX;
    const z2 = point.y * sinX + z1 * cosX;
    const perspective = 1.55 / (2.35 - z2);
    const radius = Math.min(width, height) * 0.4;
    return {
      x: width * (0.7 + pointerX * 0.025) + x1 * radius * perspective,
      y: height * (0.45 + pointerY * 0.02) + y1 * radius * perspective,
      z: z2,
      size: point.size * (0.75 + perspective),
    };
  };

  const render = (time = 0) => {
    context.clearRect(0, 0, width, height);
    const projected = points.map((point) => project(point, time));
    for (let i = 0; i < projected.length; i += 1) {
      for (let j = i + 1; j < projected.length; j += 1) {
        const a = projected[i];
        const b = projected[j];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance > 88) continue;
        const opacity = Math.max(0, (1 - distance / 88) * 0.22 * ((a.z + b.z + 2) / 4));
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.strokeStyle = `rgba(93, 221, 255, ${opacity})`;
        context.lineWidth = 0.8;
        context.stroke();
      }
    }
    projected.sort((a, b) => a.z - b.z).forEach((point) => {
      const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, point.size * 4.5);
      glow.addColorStop(0, point.z > 0.25 ? "rgba(141, 113, 255, 0.95)" : "rgba(93, 221, 255, 0.9)");
      glow.addColorStop(1, "rgba(93, 221, 255, 0)");
      context.beginPath();
      context.arc(point.x, point.y, point.size * 4.5, 0, Math.PI * 2);
      context.fillStyle = glow;
      context.fill();
    });
    if (!reducedMotion.matches && !document.hidden) frame = requestAnimationFrame(render);
  };

  const restart = () => {
    cancelAnimationFrame(frame);
    if (reducedMotion.matches) render(0);
    else frame = requestAnimationFrame(render);
  };

  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", restart);
  reducedMotion.addEventListener?.("change", restart);
  resize();
  restart();
})();
