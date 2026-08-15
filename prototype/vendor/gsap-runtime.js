(function () {
  var appStarted = false;
  var startApp = function () {
    if (appStarted) return;
    appStarted = true;
    var script = document.createElement("script");
    script.src = "./app.js?v=3";
    document.body.appendChild(script);
  };
  var installFallback = function () {
    if (window.gsap && window.ScrollTrigger) return;

  var activeTweens = [];
  var triggerInstances = [];
  var baseTransforms = new WeakMap();
  var clamp = function (value, min, max) { return Math.max(min, Math.min(max, value)); };
  var toArray = function (target) {
    if (!target) return [];
    if (typeof target === "string") return Array.prototype.slice.call(document.querySelectorAll(target));
    if (target instanceof Element) return [target];
    return Array.prototype.slice.call(target);
  };
  var cssEase = function (value) {
    return value === "power3.out" ? "cubic-bezier(.22,1,.36,1)" : "ease";
  };
  var transformFor = function (element, values) {
    if (!baseTransforms.has(element)) {
      baseTransforms.set(element, getComputedStyle(element).transform === "none" ? "" : getComputedStyle(element).transform);
    }
    var base = baseTransforms.get(element);
    var y = values.y == null ? 0 : values.y;
    var scale = values.scale == null ? 1 : values.scale;
    return base + " translate3d(0," + y + "px,0) scale(" + scale + ")";
  };
  var applyValues = function (element, values) {
    if (values.opacity != null) element.style.opacity = values.opacity;
    if (values.y != null || values.scale != null) element.style.transform = transformFor(element, values);
    if (values.strokeDashoffset != null) element.style.strokeDashoffset = values.strokeDashoffset;
  };
  var interpolate = function (from, to, progress) {
    var result = {};
    Object.keys(to || {}).forEach(function (key) {
      if (typeof to[key] !== "number") return;
      var start = from && typeof from[key] === "number" ? from[key] : (key === "opacity" ? 1 : key === "scale" ? 1 : 0);
      result[key] = start + (to[key] - start) * progress;
    });
    return result;
  };
  var playElement = function (element, tween, index) {
    window.setTimeout(function () {
      var duration = tween.options.duration || .8;
      element.style.transition = "opacity " + duration + "s ease, transform " + duration + "s " + cssEase(tween.options.ease) + ", stroke-dashoffset " + duration + "s ease";
      applyValues(element, tween.to);
    }, ((tween.options.delay || 0) + (tween.options.stagger || 0) * index) * 1000);
  };
  var registerTween = function (elements, from, to, options) {
    var tween = { elements: elements, from: from || {}, to: to || {}, trigger: options && options.scrollTrigger, options: options || {} };
    activeTweens.push(tween);
    if (tween.trigger && tween.trigger.scrub) {
      updateScrollState();
    } else {
      elements.forEach(function (element) { applyValues(element, tween.from); });
      if (tween.trigger && "IntersectionObserver" in window) {
        var triggerElement = typeof tween.trigger.trigger === "string" ? document.querySelector(tween.trigger.trigger) : tween.trigger.trigger;
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            window.requestAnimationFrame(function () { elements.forEach(function (element, index) { playElement(element, tween, index); }); });
            if (tween.trigger.once) observer.disconnect();
          });
        }, { rootMargin: "0px 0px -12%", threshold: .01 });
        observer.observe(triggerElement || elements[0]);
      } else {
        window.requestAnimationFrame(function () { elements.forEach(function (element, index) { playElement(element, tween, index); }); });
      }
    }
    return tween;
  };
  var pageOffset = function (element) {
    var rect = element.getBoundingClientRect();
    return rect.top + window.pageYOffset;
  };
  var progressFor = function (trigger) {
    var element = trigger && trigger.trigger ? (typeof trigger.trigger === "string" ? document.querySelector(trigger.trigger) : trigger.trigger) : null;
    if (!element) return 0;
    var start = pageOffset(element);
    var end = start + Math.max(element.offsetHeight - window.innerHeight, 1);
    return clamp((window.pageYOffset - start) / (end - start), 0, 1);
  };
  var updateScrollState = function () {
    activeTweens.forEach(function (tween) {
      if (!tween.trigger || !tween.trigger.scrub) return;
      var progress = progressFor(tween.trigger);
      var values = interpolate(tween.from, tween.to, progress);
      tween.elements.forEach(function (element) { applyValues(element, values); });
    });
    triggerInstances.forEach(function (instance) {
      var progress = progressFor(instance.config);
      var wasActive = instance.active;
      instance.active = progress > 0 && progress < 1;
      if (instance.config.onUpdate) instance.config.onUpdate({ progress: progress });
      if (!wasActive && instance.active && instance.config.onEnter) instance.config.onEnter();
      if (wasActive && !instance.active && progress === 0 && instance.config.onLeaveBack) instance.config.onLeaveBack();
      if (wasActive && !instance.active && progress === 1 && instance.config.onLeave) instance.config.onLeave();
      if (!wasActive && instance.active && progress > 0 && instance.config.onEnterBack) instance.config.onEnterBack();
    });
  };
  window.addEventListener("scroll", updateScrollState, { passive: true });
  window.addEventListener("resize", updateScrollState);

  window.ScrollTrigger = {
    create: function (config) {
      var instance = { config: config || {}, active: false };
      triggerInstances.push(instance);
      updateScrollState();
      return instance;
    },
    refresh: updateScrollState,
    _registerTween: function () {}
  };
  window.gsap = {
    registerPlugin: function () {},
    killTweensOf: function () {},
    utils: { toArray: toArray },
    to: function (targets, options) { return registerTween(toArray(targets), {}, options || {}, options || {}); },
    fromTo: function (targets, from, to) { return registerTween(toArray(targets), from || {}, to || {}, to || {}); }
  };
  };

  var loadScript = function (source) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = source;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };
  var fallbackTimer = window.setTimeout(function () {
    installFallback();
    startApp();
  }, 1200);

  loadScript("https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js")
    .then(function () { return loadScript("https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js"); })
    .then(function () {
      window.clearTimeout(fallbackTimer);
      installFallback();
      startApp();
    })
    .catch(function () {
      window.clearTimeout(fallbackTimer);
      installFallback();
      startApp();
    });
}());
