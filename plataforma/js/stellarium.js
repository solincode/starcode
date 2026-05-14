// Crear instancia de Stellarium
const stellarium = new StellariumWebEngine({
  container: document.getElementById("sky"),
  skyCulture: "western",
  landscape: false,
  atmosphere: true,
  stars: true,
  constellations: true,
  milkyWay: true
});

// Hacerla global
window.stellarium = stellarium;