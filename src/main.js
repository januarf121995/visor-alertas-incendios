/**
 * Visor Territorial de Puntos de Calor y Alertas de Incendio - Colombia
 * Layout 3 Columnas (Bloque Izq Infografía 1 | Mapa Central | Bloque Der Infografía 2)
 * Caja 3: Pop-up Nativo del WebMap de ArcGIS Online (Arcade) renderizado en contenedor custom.
 */

require([
  "esri/WebMap",
  "esri/views/MapView",
  "esri/layers/GraphicsLayer",
  "esri/Graphic",
  "esri/geometry/Polygon",
  "esri/geometry/Point",
  "esri/geometry/support/webMercatorUtils",
  "esri/widgets/TimeSlider",
  "esri/widgets/Legend",
  "esri/widgets/LayerList",
  "esri/widgets/Feature",
  "esri/geometry/geometryEngine",
  "esri/layers/support/FeatureFilter",
  "esri/layers/support/FeatureEffect",
  "esri/core/promiseUtils"
], (
  WebMap,
  MapView,
  GraphicsLayer,
  Graphic,
  Polygon,
  Point,
  webMercatorUtils,
  TimeSlider,
  Legend,
  LayerList,
  FeatureWidget,
  geometryEngine,
  FeatureFilter,
  FeatureEffect,
  promiseUtils
) => {
  // Variables Globales de Estado
  let webMap, view;
  let municipiosLayer, viirsLayer, ideamLayer;
  let municipiosLayerView, viirsLayerView;
  let maskLayer, maskGraphic;
  let selectionLayer, selectedOutlineGraphic;
  let timeSlider, featureWidget;
  let allMunicipiosFeatures = [];
  let currentActiveId = null;
  let currentSelectedFeature = null;
  let isPointerOverMap = false;

  // Variables de Caché para Optimización de Rendimiento 60FPS
  let cachedSelectedUnionGeom = null;
  const adjacencyCache = new Map();
  const hoverUnionCache = new Map();
  let lastAppliedHoverId = undefined;

  // Referencias a Elementos del DOM
  const selectMunicipio = document.getElementById("selectMunicipio");
  const btnOpenCalendar = document.getElementById("btnOpenCalendar");
  const btnResetAll = document.getElementById("btnResetAll");
  const btnDetectGPS = document.getElementById("btnDetectGPS");
  const appLoader = document.getElementById("appLoader");
  const appAlert = document.getElementById("appAlert");
  const alertTitle = document.getElementById("alertTitle");
  const alertMessage = document.getElementById("alertMessage");

  // Elementos del Modal Emergente de Calendario Glassmorphism
  const modalCalendar = document.getElementById("modalCalendar");
  const btnCloseCalendar = document.getElementById("btnCloseCalendar");
  const btnCloseCalendarBackdrop = document.getElementById("btnCloseCalendarBackdrop");
  const btnTabSingleDate = document.getElementById("btnTabSingleDate");
  const btnTabRangeDate = document.getElementById("btnTabRangeDate");
  const calendarMonthTitle = document.getElementById("calendarMonthTitle");
  const btnPrevMonth = document.getElementById("btnPrevMonth");
  const btnNextMonth = document.getElementById("btnNextMonth");
  const calendarDaysGrid = document.getElementById("calendarDaysGrid");
  const txtSelectedDateRange = document.getElementById("txtSelectedDateRange");
  const btnClearDateFilter = document.getElementById("btnClearDateFilter");
  const btnApplyDateFilter = document.getElementById("btnApplyDateFilter");

  // Estado del Calendario Glassmorphism (VIIRS ACQ_DATE)
  let calendarCurrentMonth = new Date(2026, 8, 1); // Septiembre 2026
  let calendarSelectedStart = null;
  let calendarSelectedEnd = null;
  let calendarFilterMode = "single"; // 'single' o 'range'

  // Elementos de Cajas (Caja 3: Native WebMap Popup Box, Caja 4: TimeSlider)
  const boxPopupDetails = document.getElementById("boxPopupDetails");
  const popupBoxTitle = document.getElementById("popupBoxTitle");
  const sheetContentContainer = document.getElementById("sheetContentContainer");
  const boxTimeSlider = document.getElementById("boxTimeSlider");
  const btnToggleTimeSlider = document.getElementById("btnToggleTimeSlider");

  // Elementos del Modal Emergente Banner Carrusel de Infografías (Móvil / Guía)
  const modalInfografias = document.getElementById("modalInfografias");
  const btnOpenInfografias = document.getElementById("btnOpenInfografias");
  const btnCloseInfografias = document.getElementById("btnCloseInfografias");
  const btnCloseInfografiasBackdrop = document.getElementById("btnCloseInfografiasBackdrop");
  const btnGoToMap = document.getElementById("btnGoToMap");
  const btnTabInfografia1 = document.getElementById("btnTabInfografia1");
  const btnTabInfografia2 = document.getElementById("btnTabInfografia2");
  const btnPrevInfografia = document.getElementById("btnPrevInfografia");
  const btnNextInfografia = document.getElementById("btnNextInfografia");
  const dotInfografia0 = document.getElementById("dotInfografia0");
  const dotInfografia1 = document.getElementById("dotInfografia1");
  const infografiaCarouselTrack = document.getElementById("infografiaCarouselTrack");

  let currentInfografiaSlide = 0;

  /**
   * 1. Inicialización Principal
   */
  async function initApp() {
    // Timeout de seguridad: Retirar el loader a los 4.5 segundos pase lo que pase en móviles
    const safetyLoaderTimer = setTimeout(() => {
      console.warn("Tiempo de espera límite alcanzado. Liberando interfaz para el usuario...");
      dismissLoader();
    }, 4500);

    try {
      console.log("Inicializando Visor con Layout 3 Columnas y Pop-up Nativo...");

      webMap = new WebMap({
        portalItem: {
          id: "324efb7957b741c59b575d13a3f7e2bd"
        }
      });

      // A. Capa de Máscara de Basemap (Oscuro Obsidiana Térmico)
      maskLayer = new GraphicsLayer({
        title: "Máscara Espacial de Basemap",
        listMode: "hide"
      });

      maskGraphic = new Graphic({
        symbol: {
          type: "simple-fill",
          color: [13, 13, 15, 0.96], // Oscuro Obsidiana
          outline: {
            color: [249, 115, 22, 0.3], // Borde Naranja Fuego Atenuado
            width: 0.5
          }
        }
      });
      maskLayer.add(maskGraphic);
      webMap.add(maskLayer, 0);

      // B. Capa de Resaltado de Selección (Solo Borde Naranja Fuego Eléctrico)
      selectionLayer = new GraphicsLayer({
        title: "Resaltado de Selección",
        listMode: "hide"
      });

      selectedOutlineGraphic = new Graphic({
        symbol: {
          type: "simple-fill",
          color: [0, 0, 0, 0], // Transparente
          outline: {
            color: [255, 149, 0, 1], // Naranja Fuego Eléctrico (#ff9500)
            width: 3.0
          }
        }
      });
      selectionLayer.add(selectedOutlineGraphic);
      webMap.add(selectionLayer);

      // C. MapView con Fondo Oscuro Obsidiana
      view = new MapView({
        container: "viewDiv",
        map: webMap,
        popupEnabled: false, // Desactivar globos flotantes nativos del SDK en el mapa
        background: {
          color: [13, 13, 15, 1]
        },
        highlightOptions: {
          color: [255, 149, 0, 1],
          fillOpacity: 0.1,
          haloColor: [255, 149, 0, 1],
          haloOpacity: 0.9
        },
        padding: { top: 0, bottom: 0, left: 0, right: 0 }
      });

      // CAJA 3: Feature Widget para renderizar el Pop-up Nativo del WebMap (Arcade) en #sheetContentContainer
      view.popup.autoOpenEnabled = false;
      view.popup.visible = false;
      featureWidget = new FeatureWidget({
        container: sheetContentContainer,
        view: view
      });

      await webMap.when();
      await view.when();

      console.log("Vista lista. Identificando capas...");
      identifyLayers();

      if (municipiosLayer) {
        try {
          if (!municipiosLayer.loaded) await municipiosLayer.load();
        } catch(e) { console.warn("Aviso al cargar municipiosLayer:", e); }
        loadMunicipiosList();
        view.whenLayerView(municipiosLayer).then(lv => {
          municipiosLayerView = lv;
        }).catch(err => console.warn("whenLayerView municipios warning:", err));
      }

      if (viirsLayer) {
        try {
          if (!viirsLayer.loaded) await viirsLayer.load();
        } catch(e) { console.warn("Aviso al cargar viirsLayer:", e); }
        view.whenLayerView(viirsLayer).then(lv => {
          viirsLayerView = lv;
          queryViirsDateExtent();
        }).catch(err => console.warn("whenLayerView viirs warning:", err));
      }

      initWidgets();
      setupEventListeners();
      closeCalendarModal(); // Garantizar que inicie cerrado

      clearTimeout(safetyLoaderTimer);
      dismissLoader();
      showAlert("Sistema Listo", "Selecciona o pasa el mouse sobre un municipio para ver el Pop-up nativo del WebMap.", "success");

      // Auto-abrir banner carrusel de infografías si se ingresa desde móvil (<992px)
      if (window.innerWidth <= 992) {
        openInfografiasModal();
      } else {
        closeInfografiasModal();
      }

      // Detección inicial por GPS en segundo plano para no bloquear el despliegue del mapa
      setTimeout(() => {
        detectGPSAndFocus(false);
      }, 300);

    } catch (error) {
      console.error("Error en initApp:", error);
      clearTimeout(safetyLoaderTimer);
      dismissLoader();
      showAlert("Error de Carga", "No se pudo inicializar el mapa.", "danger");
    }
  }

  function dismissLoader() {
    const el = document.getElementById("appLoader");
    if (el) {
      el.loading = false;
      el.hidden = true;
      el.style.display = "none";
      el.style.visibility = "hidden";
      el.style.pointerEvents = "none";
      try {
        if (el.parentNode) el.parentNode.removeChild(el);
      } catch (e) {}
    }
  }

  /**
   * 2. Identificación de Capas Operacionales por ID/Título Oficial del WebMap
   * Preserva 100% las visibilidades y estilos nativos configurados en ArcGIS Online.
   */
  function identifyLayers() {
    webMap.layers.forEach((layer) => {
      if (layer === maskLayer || layer === selectionLayer) return;
      layer.popupEnabled = false; // Prevenir globos emergentes flotantes sobre el mapa

      const title = layer.title || "";
      const id = layer.id || "";

      // 1. Capa de Municipios Oficial (Layer 4: "Municipios Colombia", ID: 1a069e22854-layer-204)
      if (id === "1a069e22854-layer-204" || (title === "Municipios Colombia" && !title.includes("expresiones"))) {
        municipiosLayer = layer;
        municipiosLayer.outFields = ["*"];
      } 
      // 2. Capa de Puntos de Calor VIIRS Satelital Oficial (Layer 5: "Satellite (VIIRS) Thermal Hotspots and Fire Activity", ID: 1a068a58d38-layer-6)
      else if (id === "1a068a58d38-layer-6" || title.includes("Satellite (VIIRS)")) {
        viirsLayer = layer;
        viirsLayer.outFields = ["*"];
      } 
      // 3. Capa Backend Alertas IDEAM (Layer 2: "Mapa de Alertas por Incendios - IDEAM - Fuente ref. Oficial", ID: 1a06901e076-layer-147)
      else if (id === "1a06901e076-layer-147" || title.includes("Mapa de Alertas por Incendios - IDEAM")) {
        ideamLayer = layer;
        ideamLayer.outFields = ["*"];
      }
    });

    // Fallbacks de seguridad si por alguna razón no coincidió por id o título exacto
    if (!municipiosLayer) {
      municipiosLayer = webMap.layers.find(l => l !== maskLayer && l !== selectionLayer && (l.title || "").includes("Municipios Colombia") && !l.title.includes("expresiones"));
    }
    if (!viirsLayer) {
      viirsLayer = webMap.layers.find(l => l !== maskLayer && l !== selectionLayer && (l.title || "").includes("Satellite (VIIRS)"));
    }
    if (!ideamLayer) {
      ideamLayer = webMap.layers.find(l => l !== maskLayer && l !== selectionLayer && (l.title || "").includes("Mapa de Alertas por Incendios - IDEAM"));
    }

    console.log("Capas identificadas en el WebMap:");
    console.log(" - municipiosLayer:", municipiosLayer ? `${municipiosLayer.title} (ID: ${municipiosLayer.id}, visible: ${municipiosLayer.visible})` : "NO HALLADA");
    console.log(" - viirsLayer:", viirsLayer ? `${viirsLayer.title} (ID: ${viirsLayer.id}, visible: ${viirsLayer.visible})` : "NO HALLADA");
    console.log(" - ideamLayer:", ideamLayer ? `${ideamLayer.title} (ID: ${ideamLayer.id}, visible: ${ideamLayer.visible})` : "NO HALLADA");
  }

  /**
   * 3. Cargar Municipios en Combobox (Filtrado por Alerta IDEAM PROBABILID >= 1)
   */
  async function loadMunicipiosList() {
    if (!municipiosLayer) return;

    try {
      console.log("Iniciando consulta ligera de atributos de municipios (returnGeometry = false)...");

      // 1. Obtener todos los municipios directamente del servidor REST (solo atributos, sin geometría pesada)
      const query = municipiosLayer.createQuery();
      query.where = "1=1";
      query.outFields = ["*"];
      query.returnGeometry = false; // Carga ultrarrápida (red reducida de 45MB a 100KB)

      let results = null;
      try {
        results = await municipiosLayer.queryFeatures(query);
      } catch (e) {
        console.warn("Fallo consulta en FeatureLayer, intentando LayerView:", e);
        if (municipiosLayerView) {
          results = await municipiosLayerView.queryFeatures(query);
        }
      }

      if (results && results.features && results.features.length > 0) {
        allMunicipiosFeatures = results.features;
      }
      console.log(`Total municipios base en memoria: ${allMunicipiosFeatures.length}`);

      // 2. Consultar Capa de Alertas IDEAM (solo atributos, returnGeometry = false)
      let activeDaneCodes = new Map(); // DANE Code -> level
      let activeNames = new Map(); // Normalized Name -> level
      let activeIdeamFeatures = [];

      if (ideamLayer) {
        try {
          await ideamLayer.load();
          const ideamQuery = ideamLayer.createQuery();
          ideamQuery.where = "1=1";
          ideamQuery.outFields = ["*"];
          ideamQuery.returnGeometry = false;

          const ideamResults = await ideamLayer.queryFeatures(ideamQuery);
          if (ideamResults && ideamResults.features) {
            console.log(`Registros IDEAM consultados: ${ideamResults.features.length}`);

            ideamResults.features.forEach(f => {
              const attrs = f.attributes || {};
              const probRaw = attrs.PROBABILID !== undefined ? attrs.PROBABILID : (attrs.PROBABILIDAD || attrs.ALERT_NUM || attrs.NIVEL);
              const probNum = Number(probRaw);

              if (!isNaN(probNum) && probNum >= 1) {
                activeIdeamFeatures.push({ feature: f, level: probNum });

                // Extraer código DANE
                const dane = attrs.COD_DANE || attrs.MPIO_CDPMP || attrs.MPIO_CCDGO || attrs.COD_MPIO;
                if (dane) {
                  const key = String(dane).trim().padStart(5, '0');
                  const prev = activeDaneCodes.get(key) || 0;
                  activeDaneCodes.set(key, Math.max(prev, probNum));
                }

                // Extraer nombre de municipio
                const name = attrs.MUNICIPIO || attrs.MPIO_CNMBR || attrs.NOM_MUN || attrs.NOMBRE;
                if (name) {
                  const normName = String(name).toLowerCase().trim();
                  const prev = activeNames.get(normName) || 0;
                  activeNames.set(normName, Math.max(prev, probNum));
                }
              }
            });
            console.log(`Municipios con alerta IDEAM (PROBABILID >= 1): ${activeIdeamFeatures.length} registros activos.`);
          }
        } catch (ideamErr) {
          console.warn("No se pudo consultar la capa IDEAM para el filtro del combobox:", ideamErr);
        }
      }

      // 3. Filtrar municipios base por DANE Code o Nombre
      let filteredFeatures = allMunicipiosFeatures;

      if (activeIdeamFeatures.length > 0) {
        const matches = allMunicipiosFeatures.filter(mpio => {
          const mpioAttrs = mpio.attributes || {};
          const mpioIdStr = String(mpioAttrs.ID || mpioAttrs.COD_DANE || mpioAttrs.OBJECTID || "").trim().padStart(5, '0');

          // A. Coincidencia por Código DANE
          if (mpioIdStr && activeDaneCodes.has(mpioIdStr)) {
            mpio.attributes._alertLevel = activeDaneCodes.get(mpioIdStr);
            return true;
          }

          // B. Coincidencia por Nombre
          const mpioName = String(mpioAttrs.NAME || mpioAttrs.NAME_2 || mpioAttrs.NOMBRE_MUNICIPIO || mpioAttrs.MPIO_CNMBR || "").toLowerCase().trim();
          if (mpioName && activeNames.has(mpioName)) {
            mpio.attributes._alertLevel = activeNames.get(mpioName);
            return true;
          }

          return false;
        });

        if (matches.length > 0) {
          filteredFeatures = matches;
        } else {
          console.warn("No se hallaron coincidencias de alertas IDEAM, manteniendo municipios base.");
        }
      }

      console.log(`Municipios a poblar en combobox: ${filteredFeatures.length}`);

      // 4. Formatear y poblar combobox
      const getAlertBadge = (lvl) => {
        if (lvl === 3) return "🔴 Alerta Alta (Roja)";
        if (lvl === 2) return "🟠 Alerta Media (Naranja)";
        if (lvl === 1) return "🟡 Alerta Baja (Amarilla)";
        return "⚠️ Con Alerta IDEAM";
      };

      const municipiosList = filteredFeatures.map(f => {
        const attrs = f.attributes || {};
        const name = attrs.NAME || attrs.NAME_2 || attrs.NOMBRE_MUNICIPIO || attrs.MPIO_CNMBR || "Municipio";
        const dept = attrs.DEPARTMENT || attrs.NAME_1 || attrs.DEPTO || attrs.DPTO_CNMBR || "Colombia";
        const alertLvl = attrs._alertLevel;
        const alertText = alertLvl ? ` - ${getAlertBadge(alertLvl)}` : "";
        return {
          id: attrs.OBJECTID,
          name: name,
          dept: dept,
          alertLvl: alertLvl || 0,
          label: `${name} (${dept})${alertText}`,
          feature: f
        };
      }).sort((a, b) => a.name.localeCompare(b.name, 'es'));

      selectMunicipio.innerHTML = "";
      municipiosList.forEach(m => {
        const item = document.createElement("calcite-combobox-item");
        item.setAttribute("value", String(m.id));
        item.setAttribute("text-label", m.label);
        item.setAttribute("label", m.label);
        item.setAttribute("heading", m.label);
        item.value = String(m.id);
        item.textLabel = m.label;
        item.label = m.label;
        item.textContent = m.label;
        selectMunicipio.appendChild(item);
      });

      console.log(`Combobox selectMunicipio cargado exitosamente con ${municipiosList.length} ítems.`);

    } catch (err) {
      console.error("Fallo crítico en loadMunicipiosList:", err);
    }
  }

  /**
   * Detección GPS
   */
  function detectGPSAndFocus(userInitiated = false) {
    if (!navigator.geolocation) {
      if (userInitiated) showAlert("GPS no disponible", "Tu navegador no soporta geolocalización.", "warning");
      return;
    }

    if (userInitiated) {
      showAlert("Buscando GPS", "Consultando la ubicación exacta de tu dispositivo...", "info");
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        console.log(`GPS Coordenadas recibidas: Latitud ${lat}, Longitud ${lon}`);

        if (!municipiosLayer) return;

        try {
          const userPointWGS = new Point({
            longitude: lon,
            latitude: lat,
            spatialReference: { wkid: 4326 }
          });

          const spatialQuery = municipiosLayer.createQuery();
          spatialQuery.geometry = userPointWGS;
          spatialQuery.spatialRelationship = "intersects";
          spatialQuery.returnGeometry = false; // Consulta ultrarrápida sin descargar geometría pesada
          spatialQuery.outFields = ["*"];

          let res = null;
          try {
            res = await municipiosLayer.queryFeatures(spatialQuery);
          } catch (e) {
            if (municipiosLayerView) {
              res = await municipiosLayerView.queryFeatures(spatialQuery);
            }
          }

          let matchedMpio = (res && res.features && res.features.length > 0) ? res.features[0] : null;

          if (!matchedMpio && allMunicipiosFeatures.length > 0) {
            const userPointMercator = webMercatorUtils.geographicToWebMercator(userPointWGS);
            matchedMpio = allMunicipiosFeatures.find(f => {
              if (!f.geometry) return false;
              return geometryEngine.intersects(f.geometry, userPointMercator) || 
                     geometryEngine.contains(f.geometry, userPointMercator);
            });
          }

          if (matchedMpio) {
            const name = matchedMpio.attributes.NAME || matchedMpio.attributes.NAME_2 || "Ubicación Actual";
            console.log(`Municipio por GPS enfocado: ${name}`);
            await selectMunicipality(matchedMpio, true);
            showAlert("GPS Localizado", `Se enfocó automáticamente el municipio de tu ubicación (${name}).`, "success");
          } else {
            if (userInitiated) {
              showAlert("Fuera de Cobertura", "Tus coordenadas GPS se encuentran fuera de Colombia.", "info");
            }
          }
        } catch (err) {
          console.warn("Error al procesar consulta espacial de GPS:", err);
        }
      },
      (err) => {
        console.warn("GPS no autorizado o inalcanzable:", err.message);
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
    );
  }

  function getWorldPolygon(spatialReference) {
    const sr = spatialReference || view.spatialReference;
    const isWebMercator = sr && (sr.wkid === 3857 || sr.wkid === 102100 || sr.isWebMercator);
    
    if (isWebMercator) {
      const max = 20037508.34;
      return new Polygon({
        spatialReference: sr,
        rings: [
          [
            [-max, -max],
            [-max, max],
            [max, max],
            [max, -max],
            [-max, -max]
          ]
        ]
      });
    } else {
      return new Polygon({
        spatialReference: sr || { wkid: 4326 },
        rings: [
          [
            [-180, -90],
            [-180, 90],
            [180, 90],
            [180, -90],
            [-180, -90]
          ]
        ]
      });
    }
  }

  function updateBasemapMask(targetGeom) {
    if (!targetGeom) {
      maskGraphic.geometry = null;
      return;
    }
    try {
      const worldPoly = getWorldPolygon(targetGeom.spatialReference || view.spatialReference);
      const diffGeom = geometryEngine.difference(worldPoly, targetGeom);
      if (diffGeom) {
        maskGraphic.geometry = diffGeom;
      }
    } catch (err) {
      console.warn("Error al actualizar máscara de basemap:", err);
    }
  }

  async function ensureFeatureGeometry(feature) {
    if (!feature) return null;
    if (feature.geometry) return feature.geometry;

    const objId = feature.attributes ? (feature.attributes.OBJECTID || feature.attributes.id) : null;
    if (objId !== null && objId !== undefined && municipiosLayer) {
      try {
        const q = municipiosLayer.createQuery();
        q.objectIds = [Number(objId)];
        q.returnGeometry = true;
        q.outFields = ["*"];

        let res = null;
        if (municipiosLayerView) {
          try { res = await municipiosLayerView.queryFeatures(q); } catch(e) {}
        }
        if (!res || !res.features || res.features.length === 0) {
          res = await municipiosLayer.queryFeatures(q);
        }
        if (res && res.features && res.features.length > 0) {
          feature.geometry = res.features[0].geometry;
          return feature.geometry;
        }
      } catch (err) {
        console.warn("Error al consultar geometría de municipio bajo demanda:", err);
      }
    }
    return null;
  }

  async function getAdjacentNeighbors(targetFeature) {
    if (!targetFeature || !targetFeature.attributes) return [];
    const targetId = targetFeature.attributes.OBJECTID || targetFeature.attributes.id;
    if (targetId && adjacencyCache.has(targetId)) {
      return adjacencyCache.get(targetId);
    }

    const targetGeom = await ensureFeatureGeometry(targetFeature);
    if (!targetGeom || !municipiosLayer) return [];

    try {
      const q = municipiosLayer.createQuery();
      q.geometry = targetGeom;
      q.spatialRelationship = "touches";
      q.returnGeometry = true;
      q.outFields = ["OBJECTID", "NAME", "NAME_2"];

      let res = null;
      if (municipiosLayerView) {
        try { res = await municipiosLayerView.queryFeatures(q); } catch(e) {}
      }
      if (!res || !res.features || res.features.length === 0) {
        res = await municipiosLayer.queryFeatures(q);
      }

      const neighbors = (res && res.features) ? res.features : [];
      if (targetId) adjacencyCache.set(targetId, neighbors);
      return neighbors;
    } catch (err) {
      console.warn("Error consultando municipios colindantes adyacentes:", err);
      return [];
    }
  }

  /**
   * Obtiene la geometría unificada (municipio + colindantes) en caché ultra-rápida (0ms)
   */
  async function getHoverUnionGeom(hoverFeature) {
    if (!hoverFeature || !hoverFeature.attributes) return null;
    const hoverId = hoverFeature.attributes.OBJECTID || hoverFeature.attributes.id;
    if (hoverId && hoverUnionCache.has(hoverId)) {
      return hoverUnionCache.get(hoverId);
    }

    const targetGeom = await ensureFeatureGeometry(hoverFeature);
    if (!targetGeom) return null;

    const neighbors = await getAdjacentNeighbors(hoverFeature);
    const validGeoms = [targetGeom, ...neighbors.map(n => n.geometry).filter(Boolean)];
    const unionGeom = validGeoms.length > 1 ? geometryEngine.union(validGeoms) : targetGeom;

    if (hoverId) hoverUnionCache.set(hoverId, unionGeom);
    return unionGeom;
  }

  /**
   * 4. Selección Territorial Definitiva (Fijada por Clic, Combobox o GPS)
   */
  async function selectMunicipality(feature, animateZoom = true) {
    if (!feature) return;

    // Asegurar disponibilidad de geometría del municipio
    const targetGeom = await ensureFeatureGeometry(feature);
    if (!targetGeom) {
      console.warn("Imposible obtener geometría del municipio seleccionado.");
      return;
    }

    // FIJAR Selección de Municipio Activo
    currentSelectedFeature = feature;
    const targetId = feature.attributes.OBJECTID;
    currentActiveId = targetId;

    // Fijar el Borde Resaltado Naranja de Selección únicamente en el municipio SELECCIONADO
    selectedOutlineGraphic.geometry = targetGeom;

    // Mantener sincronizada la lista desplegable combobox
    if (selectMunicipio && String(selectMunicipio.value) !== String(targetId)) {
      selectMunicipio.value = String(targetId);
    }

    // Pre-calcular la geometría unificada del municipio seleccionado + sus colindantes ONCE (0ms en hovers posteriores)
    const neighborFeatures = await getAdjacentNeighbors(feature);
    const combinedGeometries = [targetGeom, ...neighborFeatures.map(n => n.geometry).filter(Boolean)];
    cachedSelectedUnionGeom = combinedGeometries.length > 1 ? geometryEngine.union(combinedGeometries) : targetGeom;

    // Resetear deduplicador de hover para forzar actualización visual inmediata
    lastAppliedHoverId = undefined;

    // CAJA 3: Renderizar Pop-up Nativo del WebMap de ArcGIS Online (Arcade) del municipio SELECCIONADO
    try {
      const name = feature.attributes.NAME || feature.attributes.NAME_2 || "Municipio";
      const dept = feature.attributes.DEPARTMENT || feature.attributes.NAME_1 || feature.attributes.DEPTO || "";
      const fullName = dept ? `${name} (${dept})` : name;
      if (popupBoxTitle) {
        popupBoxTitle.textContent = `INDICADORES DE ALERTA - ${fullName.toUpperCase()}`;
      }

      if (municipiosLayer) {
        try {
          if (!municipiosLayer.loaded) await municipiosLayer.load();
        } catch (e) {}
        feature.layer = municipiosLayer;
        if (municipiosLayer.popupTemplate) {
          feature.popupTemplate = municipiosLayer.popupTemplate;
        }
      }

      if (featureWidget) {
        featureWidget.graphic = null;
        featureWidget.graphic = feature;
      }

      if (boxPopupDetails && window.innerWidth <= 992) {
        boxPopupDetails.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } catch (err) {
      console.warn("No se pudo renderizar el pop-up nativo:", err);
    }

    // Aplicar máscara y efecto visual espacial para el municipio seleccionado
    await applyHoverPreview(null);

    if (animateZoom && cachedSelectedUnionGeom) {
      const fitExtent = cachedSelectedUnionGeom.extent;
      if (fitExtent) {
        await view.goTo(fitExtent.expand(1.25), {
          duration: 1000,
          easing: "ease-in-out"
        });
      }
    }
  }

  /**
   * Previsualización Dinámica al Pasar el Mouse (Hover) / Selección Combinada - Ultra Rápida (60 FPS)
   */
  async function applyHoverPreview(hoverFeature = null) {
    const hoverId = hoverFeature && hoverFeature.attributes ? (hoverFeature.attributes.OBJECTID || hoverFeature.attributes.id) : null;
    const selectedId = currentSelectedFeature && currentSelectedFeature.attributes ? (currentSelectedFeature.attributes.OBJECTID || currentSelectedFeature.attributes.id) : null;

    // DEDUPLICACIÓN DE ALTO RENDIMIENTO: Si el ID de hover no ha cambiado respecto a la última llamada, cancelar para evitar latencia
    const currentHoverKey = `${selectedId || 'none'}_${hoverId || 'none'}`;
    if (lastAppliedHoverId === currentHoverKey) return;
    lastAppliedHoverId = currentHoverKey;

    let activeGeoms = [];

    // A. Geometría pre-calculada del seleccionado (0ms)
    if (cachedSelectedUnionGeom) {
      activeGeoms.push(cachedSelectedUnionGeom);
    }

    // B. Geometría en caché del municipio hovered (0ms si ya se sobrevoló)
    if (hoverFeature && hoverId !== selectedId) {
      const hoverUnion = await getHoverUnionGeom(hoverFeature);
      if (hoverUnion) {
        activeGeoms.push(hoverUnion);
      }
    }

    // C. Si no hay ni municipio seleccionado ni hover, mostrar el WebMap completo de Colombia sin filtros
    if (activeGeoms.length === 0) {
      updateBasemapMask(null);
      if (municipiosLayerView) municipiosLayerView.featureEffect = null;
      if (viirsLayerView) viirsLayerView.featureEffect = null;
      return;
    }

    // D. Unificar geometrías activas (Seleccionado + Hovered + Colindantes)
    const activeUnion = activeGeoms.length > 1 ? geometryEngine.union(activeGeoms) : activeGeoms[0];

    // 1. Actualizar máscara de basemap (0ms)
    updateBasemapMask(activeUnion);

    // 2. Aplicar filtro espacial directamente a las LayerViews en memoria (sin promesas iterativas)
    const spatialFilter = new FeatureFilter({
      geometry: activeUnion,
      spatialRelationship: "intersects"
    });

    if (viirsLayerView) {
      viirsLayerView.featureEffect = new FeatureEffect({
        filter: spatialFilter,
        excludedEffect: "opacity(35%)"
      });
    }

    if (municipiosLayerView) {
      municipiosLayerView.featureEffect = new FeatureEffect({
        filter: spatialFilter,
        excludedEffect: "grayscale(100%) opacity(20%) brightness(30%)"
      });
    }
  }

  function initWidgets() {
    if (document.getElementById("timeSliderDiv")) {
      timeSlider = new TimeSlider({
        container: "timeSliderDiv",
        view: view,
        mode: "time-window",
        loop: true,
        playRate: 1500
      });

      if (viirsLayer && viirsLayer.timeInfo && viirsLayer.timeInfo.timeExtent) {
        timeSlider.fullTimeExtent = viirsLayer.timeInfo.timeExtent;
        timeSlider.stops = { interval: { value: 6, unit: "hours" } };
      }
    }
  }

  // --- FUNCIONALIDAD DEL CALENDARIO GLASSMORPHISM TEMA INCENDIOS (VIIRS ACQ_DATE) ---
  let viirsMinDate = null;
  let viirsMaxDate = null;

  async function queryViirsDateExtent() {
    if (!viirsLayer) return;
    try {
      const query = viirsLayer.createQuery();
      query.where = "1=1";
      query.outFields = ["ACQ_DATE"];
      query.returnGeometry = false;
      query.num = 1000;

      const res = await viirsLayer.queryFeatures(query);
      if (res && res.features && res.features.length > 0) {
        res.features.forEach(f => {
          const val = f.attributes.ACQ_DATE;
          if (val) {
            const d = new Date(val);
            if (!isNaN(d.getTime())) {
              if (!viirsMinDate || d < viirsMinDate) viirsMinDate = d;
              if (!viirsMaxDate || d > viirsMaxDate) viirsMaxDate = d;
            }
          }
        });
      }

      if (viirsMaxDate) {
        calendarCurrentMonth = new Date(viirsMaxDate.getFullYear(), viirsMaxDate.getMonth(), 1);
        console.log(`Fechas VIIRS consultadas en capa: ${viirsMinDate ? viirsMinDate.toISOString() : ''} a ${viirsMaxDate.toISOString()}`);
      }
    } catch (err) {
      console.warn("No se pudo consultar el rango exacto de fechas de VIIRS:", err);
    }
  }

  function openCalendarModal() {
    if (modalCalendar) {
      modalCalendar.classList.remove("hidden");
      modalCalendar.style.display = "flex";
      renderGlassCalendar();
    }
  }

  function closeCalendarModal() {
    if (modalCalendar) {
      modalCalendar.classList.add("hidden");
      modalCalendar.style.display = "none";
    }
  }

  // --- FUNCIONALIDAD DEL BANNER CARRUSEL DE INFOGRAFÍAS (MÓVIL & GUÍA) ---
  function openInfografiasModal() {
    if (modalInfografias) {
      modalInfografias.classList.remove("hidden");
      modalInfografias.style.display = "flex";
      setInfografiaSlide(0);
    }
  }

  function closeInfografiasModal() {
    if (modalInfografias) {
      modalInfografias.classList.add("hidden");
      modalInfografias.style.display = "none";
    }
  }

  function setInfografiaSlide(index) {
    currentInfografiaSlide = index;
    if (infografiaCarouselTrack) {
      infografiaCarouselTrack.className = `infografia-carousel-track slide-${index}`;
    }
    if (btnTabInfografia1 && btnTabInfografia2) {
      if (index === 0) {
        btnTabInfografia1.classList.add("active");
        btnTabInfografia2.classList.remove("active");
      } else {
        btnTabInfografia1.classList.remove("active");
        btnTabInfografia2.classList.add("active");
      }
    }
    if (dotInfografia0 && dotInfografia1) {
      dotInfografia0.classList.toggle("active", index === 0);
      dotInfografia1.classList.toggle("active", index === 1);
    }
  }

  function renderGlassCalendar() {
    if (!calendarDaysGrid || !calendarMonthTitle) return;

    // Formatear Título de Mes
    const monthName = calendarCurrentMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    calendarMonthTitle.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    const year = calendarCurrentMonth.getFullYear();
    const month = calendarCurrentMonth.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Dom, 1 = Lun, etc.
    const totalDays = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    calendarDaysGrid.innerHTML = "";

    // A. Encabezados de Días de la Semana (Dom, Lun, Mar, Mié, Jue, Vie, Sáb)
    const dayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const weekdaysRow = document.createElement("div");
    weekdaysRow.className = "calendar-weekdays-row";
    dayLabels.forEach(lbl => {
      const hdr = document.createElement("div");
      hdr.className = "calendar-weekday-hdr";
      hdr.textContent = lbl;
      weekdaysRow.appendChild(hdr);
    });
    calendarDaysGrid.appendChild(weekdaysRow);

    // B. Grid Completo Mensual de Días (7 columnas)
    const daysContainer = document.createElement("div");
    daysContainer.className = "calendar-days-grid";

    // Celdas vacías iniciales antes del día 1 del mes
    for (let i = 0; i < startDayOfWeek; i++) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "calendar-day-empty";
      daysContainer.appendChild(emptyDiv);
    }

    // Tiempos límites de la capa VIIRS para restringir selección fuera de rango
    let minTime = viirsMinDate ? new Date(viirsMinDate.getFullYear(), viirsMinDate.getMonth(), viirsMinDate.getDate()).getTime() : null;
    let maxTime = viirsMaxDate ? new Date(viirsMaxDate.getFullYear(), viirsMaxDate.getMonth(), viirsMaxDate.getDate(), 23, 59, 59).getTime() : null;

    // Renderizar TODOS los días del mes (1..28/30/31)
    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const dateObj = new Date(year, month, dayNum);
      const dateTime = dateObj.getTime();

      const dayBtn = document.createElement("button");
      dayBtn.className = "calendar-day-btn";
      dayBtn.textContent = String(dayNum);

      // Deshabilitar fechas que no tienen sentido (fuera del rango de datos VIIRS)
      let isOutOfBounds = false;
      if (minTime && dateTime < minTime) isOutOfBounds = true;
      if (maxTime && dateTime > maxTime) isOutOfBounds = true;

      if (isOutOfBounds) {
        dayBtn.classList.add("disabled");
        dayBtn.disabled = true;
      } else {
        if (dateObj.toDateString() === today.toDateString()) {
          dayBtn.classList.add("is-today");
        }

        const isSelectedStart = calendarSelectedStart && dateObj.toDateString() === calendarSelectedStart.toDateString();
        const isSelectedEnd = calendarSelectedEnd && dateObj.toDateString() === calendarSelectedEnd.toDateString();

        if (isSelectedStart || isSelectedEnd) {
          dayBtn.classList.add("selected");
        } else if (calendarSelectedStart && calendarSelectedEnd && dateObj >= calendarSelectedStart && dateObj <= calendarSelectedEnd) {
          dayBtn.classList.add("in-range");
        }

        // Selección unificada e intuitiva (1 clic = día único, 2do clic posterior = rango, 3er clic = nueva fecha)
        dayBtn.addEventListener("click", () => {
          if (!calendarSelectedStart || (calendarSelectedStart && calendarSelectedEnd)) {
            calendarSelectedStart = dateObj;
            calendarSelectedEnd = null;
          } else if (calendarSelectedStart && !calendarSelectedEnd) {
            if (dateObj.toDateString() === calendarSelectedStart.toDateString()) {
              calendarSelectedEnd = null;
            } else if (dateObj < calendarSelectedStart) {
              calendarSelectedStart = dateObj;
              calendarSelectedEnd = null;
            } else {
              calendarSelectedEnd = dateObj;
            }
          }
          updateSelectedDateText();
          renderGlassCalendar();
        });
      }

      daysContainer.appendChild(dayBtn);
    }

    calendarDaysGrid.appendChild(daysContainer);
    updateSelectedDateText();
  }

  function updateSelectedDateText() {
    if (!txtSelectedDateRange) return;

    let viirsHint = "";
    if (viirsMinDate && viirsMaxDate) {
      const minFmt = `${viirsMinDate.getDate()}/${viirsMinDate.getMonth() + 1}/${viirsMinDate.getFullYear()}`;
      const maxFmt = `${viirsMaxDate.getDate()}/${viirsMaxDate.getMonth() + 1}/${viirsMaxDate.getFullYear()}`;
      viirsHint = ` (VIIRS en capa: ${minFmt} a ${maxFmt})`;
    }

    if (!calendarSelectedStart) {
      txtSelectedDateRange.textContent = `Fecha: Todo el periodo${viirsHint}`;
    } else if (!calendarSelectedEnd) {
      const formatted = calendarSelectedStart.toLocaleDateString("es-CO", { day: '2-digit', month: 'short', year: 'numeric' });
      txtSelectedDateRange.textContent = `Fecha: ${formatted}`;
    } else {
      const startFmt = calendarSelectedStart.toLocaleDateString("es-CO", { day: '2-digit', month: 'short' });
      const endFmt = calendarSelectedEnd.toLocaleDateString("es-CO", { day: '2-digit', month: 'short', year: 'numeric' });
      txtSelectedDateRange.textContent = `Rango: ${startFmt} al ${endFmt}`;
    }
  }

  function applyViirsDateFilter() {
    if (!viirsLayer) return;

    if (!calendarSelectedStart) {
      viirsLayer.definitionExpression = null;
      if (viirsLayerView) viirsLayerView.filter = null;
      showAlert("Filtro de Fechas Limpiado", "Se muestran todos los registros satelitales de VIIRS.", "info");
      closeCalendarModal();
      return;
    }

    const startDate = calendarSelectedStart;
    const endDate = calendarSelectedEnd || calendarSelectedStart;

    const startIso = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    const endIso = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    // Expresión SQL compatible con ArcGIS Feature Layer para el campo de fecha ACQ_DATE (UTC)
    const whereClause = `ACQ_DATE >= TIMESTAMP '${startIso} 00:00:00' AND ACQ_DATE <= TIMESTAMP '${endIso} 23:59:59'`;
    console.log("Aplicando filtro de fecha en viirsLayer (ACQ_DATE):", whereClause);

    viirsLayer.definitionExpression = whereClause;
    if (viirsLayerView) {
      viirsLayerView.filter = new FeatureFilter({ where: whereClause });
    }

    // Si hay un municipio seleccionado activo, reevaluar sus indicadores Arcade en la caja inferior
    if (currentSelectedFeature) {
      selectMunicipality(currentSelectedFeature, false);
    }

    closeCalendarModal();
    const dateLabel = startIso === endIso ? startIso : `${startIso} a ${endIso}`;
    showAlert("Filtro Aplicado", `VIIRS (ACQ_DATE) filtrado para: ${dateLabel}`, "success");
  }

  /**
   * 5. Listeners de Eventos
   */
  function setupEventListeners() {
    btnDetectGPS.addEventListener("click", () => {
      detectGPSAndFocus(true);
    });

    // Abrir/Cerrar Modal Emergente de Calendario Glassmorphism
    if (btnOpenCalendar) {
      btnOpenCalendar.addEventListener("click", openCalendarModal);
    }
    if (btnCloseCalendar) {
      btnCloseCalendar.addEventListener("click", closeCalendarModal);
    }
    if (btnCloseCalendarBackdrop) {
      btnCloseCalendarBackdrop.addEventListener("click", closeCalendarModal);
    }

    // Modal Emergente Banner Carrusel de Infografías
    if (btnOpenInfografias) {
      btnOpenInfografias.addEventListener("click", openInfografiasModal);
    }
    if (btnCloseInfografias) {
      btnCloseInfografias.addEventListener("click", closeInfografiasModal);
    }
    if (btnCloseInfografiasBackdrop) {
      btnCloseInfografiasBackdrop.addEventListener("click", closeInfografiasModal);
    }
    if (btnGoToMap) {
      btnGoToMap.addEventListener("click", closeInfografiasModal);
    }

    if (btnTabInfografia1) {
      btnTabInfografia1.addEventListener("click", () => setInfografiaSlide(0));
    }
    if (btnTabInfografia2) {
      btnTabInfografia2.addEventListener("click", () => setInfografiaSlide(1));
    }

    if (btnPrevInfografia) {
      btnPrevInfografia.addEventListener("click", () => {
        const nextSlide = (currentInfografiaSlide - 1 + 2) % 2;
        setInfografiaSlide(nextSlide);
      });
    }

    if (btnNextInfografia) {
      btnNextInfografia.addEventListener("click", () => {
        const nextSlide = (currentInfografiaSlide + 1) % 2;
        setInfografiaSlide(nextSlide);
      });
    }

    if (dotInfografia0) {
      dotInfografia0.addEventListener("click", () => setInfografiaSlide(0));
    }
    if (dotInfografia1) {
      dotInfografia1.addEventListener("click", () => setInfografiaSlide(1));
    }

    // Soporte para gestos táctiles (Swipe) en la ventana emergente de infografías
    const carouselViewportEl = document.querySelector(".infografia-carousel-viewport");
    if (carouselViewportEl) {
      let touchStartX = 0;
      let touchEndX = 0;

      carouselViewportEl.addEventListener("touchstart", (e) => {
        if (e.changedTouches && e.changedTouches.length > 0) {
          touchStartX = e.changedTouches[0].screenX;
        }
      }, { passive: true });

      carouselViewportEl.addEventListener("touchend", (e) => {
        if (e.changedTouches && e.changedTouches.length > 0) {
          touchEndX = e.changedTouches[0].screenX;
          const diffX = touchStartX - touchEndX;
          if (Math.abs(diffX) > 35) {
            if (diffX > 0) {
              // Swipe a la izquierda -> Siguiente
              setInfografiaSlide((currentInfografiaSlide + 1) % 2);
            } else {
              // Swipe a la derecha -> Anterior
              setInfografiaSlide((currentInfografiaSlide - 1 + 2) % 2);
            }
          }
        }
      }, { passive: true });
    }

    // Navegación de Meses
    if (btnPrevMonth) {
      btnPrevMonth.addEventListener("click", () => {
        calendarCurrentMonth = new Date(calendarCurrentMonth.getFullYear(), calendarCurrentMonth.getMonth() - 1, 1);
        renderGlassCalendar();
      });
    }

    if (btnNextMonth) {
      btnNextMonth.addEventListener("click", () => {
        calendarCurrentMonth = new Date(calendarCurrentMonth.getFullYear(), calendarCurrentMonth.getMonth() + 1, 1);
        renderGlassCalendar();
      });
    }

    // Acciones del Pie del Calendario
    if (btnClearDateFilter) {
      btnClearDateFilter.addEventListener("click", () => {
        calendarSelectedStart = null;
        calendarSelectedEnd = null;
        renderGlassCalendar();
        applyViirsDateFilter();
      });
    }

    if (btnApplyDateFilter) {
      btnApplyDateFilter.addEventListener("click", applyViirsDateFilter);
    }

    // Control de presencia del puntero sobre el contenedor del mapa (#viewDiv)
    const viewDivEl = document.getElementById("viewDiv");
    if (viewDivEl) {
      const onMapEnter = () => {
        isPointerOverMap = true;
      };
      const onMapLeave = async () => {
        isPointerOverMap = false;
        viewDivEl.style.cursor = "default";
        await applyHoverPreview(currentSelectedFeature);
      };

      viewDivEl.addEventListener("mouseenter", onMapEnter);
      viewDivEl.addEventListener("pointerenter", onMapEnter);
      viewDivEl.addEventListener("mouseleave", onMapLeave);
      viewDivEl.addEventListener("pointerleave", onMapLeave);
    }

    // Al pasar el mouse (pointer-move): previsualizar basemap/puntos del municipio flotante SIN alterar la selección fija, ni el combobox, ni el Pop-up
    const handlePointerMove = promiseUtils.debounce(async (event) => {
      if (!municipiosLayerView) return;
      if (!isPointerOverMap) {
        await applyHoverPreview(currentSelectedFeature);
        return;
      }
      try {
        const response = await view.hitTest(event, { include: [municipiosLayer] });
        if (!isPointerOverMap) {
          if (viewDivEl) viewDivEl.style.cursor = "default";
          await applyHoverPreview(currentSelectedFeature);
          return;
        }

        if (response.results.length > 0) {
          const graphic = response.results[0].graphic;
          if (graphic && graphic.layer === municipiosLayer) {
            if (viewDivEl) viewDivEl.style.cursor = "pointer";
            await applyHoverPreview(graphic);
            return;
          }
        }
        if (viewDivEl) viewDivEl.style.cursor = "default";
        // Al salir de cualquier municipio en el mapa, restaurar previsualización al municipio seleccionado fijado
        await applyHoverPreview(currentSelectedFeature);
      } catch (err) {
        console.warn("Error en handlePointerMove:", err);
      }
    }, 25);

    view.on("pointer-move", (event) => {
      handlePointerMove(event);
    });

    // Al hacer CLIC en un municipio: Fijar selección, actualizar combobox, animar zoom Y Cargar Pop-up
    view.on("click", async (event) => {
      const response = await view.hitTest(event, { include: [municipiosLayer] });
      if (response.results.length > 0) {
        const graphic = response.results[0].graphic;
        if (graphic && graphic.layer === municipiosLayer) {
          selectMunicipality(graphic, true);
        }
      }
    });

    const handleComboboxChange = () => {
      const selectedVal = selectMunicipio.value;
      if (!selectedVal || (Array.isArray(selectedVal) && selectedVal.length === 0)) return;

      let valStr = Array.isArray(selectedVal) ? selectedVal[0] : selectedVal;
      if (typeof valStr === "object" && valStr !== null) {
        valStr = valStr.value || valStr.id || String(valStr);
      }
      
      const objectId = Number(valStr);
      if (isNaN(objectId)) return;

      const foundFeature = allMunicipiosFeatures.find(f => f.attributes && (f.attributes.OBJECTID === objectId || Number(f.attributes.OBJECTID) === objectId));
      if (foundFeature) {
        console.log(`Activando selección desde combobox: ${foundFeature.attributes.NAME || objectId}`);
        selectMunicipality(foundFeature, true);
      }
    };

    selectMunicipio.addEventListener("calciteComboboxChange", handleComboboxChange);
    selectMunicipio.addEventListener("change", handleComboboxChange);

    btnResetAll.addEventListener("click", () => {
      clearSpatialFilter();
      view.goTo({
        center: [-74.2973, 4.5709],
        zoom: 6
      }, { duration: 1000 });
    });

    // Minimizar CAJA 4: TimeSlider Box
    if (btnToggleTimeSlider) {
      btnToggleTimeSlider.addEventListener("click", () => {
        boxTimeSlider.classList.toggle("minimized");
        btnToggleTimeSlider.icon = boxTimeSlider.classList.contains("minimized") ? "chevron-up" : "chevron-down";
      });
    }

    // Detección de Desplazamiento (Scroll / Rueda de Mouse / Trackpad / Teclado) para la versión Web Desktop
    const scrollHintEl = document.querySelector(".mobile-map-scroll-hint");
    let hasDismissedScrollHint = false;

    const dismissScrollHint = () => {
      // EXCLUSIVO ESCRITORIO (>992px): La cápsula solo se remueve en la versión Web Escritorio
      if (window.innerWidth <= 992) return;

      if (hasDismissedScrollHint || !scrollHintEl) return;
      hasDismissedScrollHint = true;
      scrollHintEl.classList.add("fade-out");
      setTimeout(() => {
        if (scrollHintEl && scrollHintEl.parentNode && window.innerWidth > 992) {
          scrollHintEl.style.display = "none";
        }
      }, 400);
    };

    // 1. Detección de evento wheel (Rueda del mouse o gesto de scroll en trackpad para la versión Web Desktop)
    const handleWheel = (e) => {
      if (e && e.deltaY > 0) {
        dismissScrollHint();
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: true, capture: true });
    document.addEventListener("wheel", handleWheel, { passive: true, capture: true });

    // 2. Detección de evento scroll en fase de captura (Captura cualquier contenedor en la versión Web Desktop)
    const handleScrollCheck = () => {
      dismissScrollHint();
    };
    window.addEventListener("scroll", handleScrollCheck, { passive: true, capture: true });
    document.addEventListener("scroll", handleScrollCheck, { passive: true, capture: true });

    const shellElement = document.querySelector("calcite-shell");
    if (shellElement) {
      shellElement.addEventListener("scroll", handleScrollCheck, { passive: true, capture: true });
    }

    // 3. Detección de navegación por teclado (Flecha Abajo, AvPág, Barra Espaciadora en Escritorio)
    window.addEventListener("keydown", (e) => {
      if (e && (["ArrowDown", "PageDown", "Space"].includes(e.code) || ["ArrowDown", "PageDown", "Space"].includes(e.key))) {
        dismissScrollHint();
      }
    }, { passive: true });

    // 4. Clic o Toque táctil directo sobre la cápsula flotante (Móvil: Desliza pantalla sin remover cápsula; Escritorio: Desliza y remueve)
    if (scrollHintEl) {
      const triggerScrollAndDismiss = (e) => {
        if (e) {
          try { e.preventDefault(); } catch(err) {}
          try { e.stopPropagation(); } catch(err) {}
        }

        if (boxPopupDetails) {
          try {
            boxPopupDetails.scrollIntoView({ behavior: "smooth", block: "start" });
          } catch(err) {}
        }
        try {
          const shellEl = document.querySelector("calcite-shell");
          if (shellEl) {
            shellEl.scrollTo({ top: shellEl.scrollHeight || 1200, behavior: "smooth" });
          }
        } catch(err) {}
        try {
          window.scrollTo({ top: document.body.scrollHeight || 1200, behavior: "smooth" });
        } catch(err) {}

        // En versión escritorio se remueve; en versión móvil se mantiene siempre visible
        if (window.innerWidth > 992) {
          dismissScrollHint();
        }
      };

      let isTouchHandled = false;
      scrollHintEl.addEventListener("touchend", (e) => {
        isTouchHandled = true;
        triggerScrollAndDismiss(e);
        setTimeout(() => { isTouchHandled = false; }, 400);
      }, { passive: false });

      scrollHintEl.addEventListener("click", (e) => {
        if (!isTouchHandled) {
          triggerScrollAndDismiss(e);
        }
      });
    }
  }

  function clearSpatialFilter() {
    currentSelectedFeature = null;
    currentActiveId = null;
    cachedSelectedUnionGeom = null;
    lastAppliedHoverId = undefined;
    if (municipiosLayerView) municipiosLayerView.featureEffect = null;
    if (viirsLayerView) viirsLayerView.featureEffect = null;
    if (viirsLayer) viirsLayer.definitionExpression = null;
    if (viirsLayerView) viirsLayerView.filter = null;
    calendarSelectedStart = null;
    calendarSelectedEnd = null;
    maskGraphic.geometry = null;
    selectedOutlineGraphic.geometry = null;
    selectMunicipio.value = [];
    if (popupBoxTitle) {
      popupBoxTitle.textContent = "INDICADORES DE ALERTA Y POP-UP WEBMAP DE ARCGIS ONLINE";
    }
    if (featureWidget) {
      featureWidget.graphic = null;
    }
    if (sheetContentContainer) {
      sheetContentContainer.innerHTML = "";
    }
    if (view && view.popup) view.popup.close();
    showAlert("Vista Limpia", "Se restableció la visualización del mapa y el filtro de fechas.", "info");
  }

  function showAlert(title, message, kind = "info") {
    alertTitle.textContent = title;
    alertMessage.textContent = message;
    appAlert.kind = kind;
    appAlert.open = true;
  }

  initApp();
});
