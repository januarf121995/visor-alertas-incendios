# 🔥 Visor Territorial de Puntos de Calor y Alertas de Incendio - Colombia

![ArcGIS Maps SDK](https://img.shields.io/badge/ArcGIS_SDK-4.31-blue?logo=esri)
![Calcite Design System](https://img.shields.io/badge/Calcite_DS-2.13.2-0079c1)
![JavaScript ES6+](https://img.shields.io/badge/JavaScript-ES6+-yellow?logo=javascript)
![Theme](https://img.shields.io/badge/Theme-Dark_Fire_Glassmorphism-orange)
![Deployment](https://img.shields.io/badge/GitHub_Pages-Ready-brightgreen?logo=github)

Visor geográfico interactivo de alta precisión para el monitoreo en tiempo real de puntos de calor satelitales (**VIIRS**) y niveles de alerta por incendios forestales (**IDEAM**) a nivel municipal en Colombia.

---

## 🌟 Características Principales

1. **Branding & Tema Visual Dark Fire Glassmorphism**:
   - Paleta de color optimizada de alto contraste en tonos oscuro obsidiana (`#0d0d0f`) y naranja fuego eléctrico (`#ff9500` / `#f97316`).
   - Interfaz con efectos de cristal esmerilado (*backdrop-filter glassmorphism*) y bordes punteados térmicos.

2. **Filtrado Inteligente de Municipios con Alerta IDEAM (`PROBABILID >= 1`)**:
   - El menú desplegable superior (`selectMunicipio`) filtra y muestra únicamente los municipios de Colombia que registran alerta activa del IDEAM.
   - Identificación por insignias de color:
     - 🔴 **Alerta Alta (Roja)** (`PROBABILID = 3`)
     - 🟠 **Alerta Media (Naranja)** (`PROBABILID = 2`)
     - 🟡 **Alerta Baja (Amarilla)** (`PROBABILID = 1`)

3. **Recorte de Basemap y Adyacencia Espacial**:
   - Al seleccionar o pasar el cursor (*hover*) sobre un municipio, la aplicación calcula los municipios vecinos colindantes (`geometryEngine.touches`) y genera una máscara espacial recortada para enfocar el territorio activo sin perder contexto.

4. **Calendario Térmico Glassmorphism (Filtro VIIRS `ACQ_DATE`)**:
   - Modal emergente para consultar puntos de calor satelitales en fechas únicas o rangos temporales continuos.
   - Restricción automática de días fuera del rango de datos disponibles en la capa.

5. **Caja 3: Pop-up Nativo del WebMap con Expresiones Arcade**:
   - Sección horizontal fija ubicada en la parte inferior que renderiza el widget de características (`FeatureWidget`) con las expresiones Arcade nativas configuradas en el WebMap de ArcGIS Online.

6. **Geolocalización GPS Automática**:
   - Detección de coordenadas GPS al iniciar para centrar la vista y seleccionar el municipio del usuario automáticamente.

---

## 🏗️ Estructura del Proyecto

```
APP SDK JS ARCGIS/
├── index.html            # Estructura principal HTML5 con Calcite Shell
├── src/
│   ├── main.js           # Lógica JavaScript (ArcGIS JS SDK 4.31, Arcade, Filtros y Eventos)
│   └── style.css         # Estilos globales y tema Dark Fire Glassmorphism
├── .gitignore            # Exclusiones para control de versiones Git
└── README.md             # Documentación del proyecto
```

---

## 🚀 Instalación y Ejecución Local

Dado que la aplicación está desarrollada con estándares web nativos (HTML5, CSS3, JavaScript ES6+) utilizando CDN de Esri y Calcite, no requiere de compilación previa.

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/TU-USUARIO/NOMBRE-REPO.git
   cd NOMBRE-REPO
   ```

2. **Ejecutar servidor local**:
   - Con Python:
     ```bash
     python -m http.server 8080
     ```
   - Con Node.js:
     ```bash
     npx servor . 8080
     ```

3. **Abrir en el navegador**:
   Navega a `http://localhost:8080`

---

## 🌐 Despliegue en GitHub Pages

Este proyecto está 100% preparado para ser desplegado en **GitHub Pages** en un clic.

### Pasos para Activar GitHub Pages:
1. Crea un repositorio público en GitHub (ej. `visor-incendios-colombia`).
2. En tu terminal local, vincula el remoto y sube el proyecto:
   ```bash
   git remote add origin https://github.com/TU-USUARIO/NOMBRE-REPO.git
   git branch -M main
   git push -u origin main
   ```
3. En GitHub, ve a la pestaña **Settings** > **Pages**.
4. En **Build and deployment** > **Source**, selecciona **Deploy from a branch**.
5. En **Branch**, elige `main` y carpeta `/ (root)`.
6. Haz clic en **Save**. En un par de minutos tu sitio web estará disponible públicamente en:
   `https://TU-USUARIO.github.io/NOMBRE-REPO/`

---

## 🛠️ Tecnologías Utilizadas

- **ArcGIS Maps SDK for JavaScript 4.31**: Visualización geoespacial, FeatureEffect, GeometryEngine y FeatureWidget.
- **Calcite Design System 2.13.2**: Componentes web (`calcite-shell`, `calcite-combobox`, `calcite-action`, `calcite-alert`).
- **Arcade Expressions**: Evaluación nativa de indicadores de alerta desde el WebMap de ArcGIS Online.
