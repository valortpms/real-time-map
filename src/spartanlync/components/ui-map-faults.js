import L from "leaflet";
import leafletPolycolor from "leaflet-polycolor";
import "../../../node_modules/leaflet-geometryutil";
import storage from "../../dataStore";
import splSrv from "../services";

leafletPolycolor(L);

export function initSplMapFaults() {
   splSrv.events.register("onLoadSplServices", () => {
      document.getElementById("speedLabel").addEventListener("click", doDemo); //DEBUG - TEST - PLEASE DELETE ON PROD
   });
}

function doDemo() {
   /*
   storage.map.on("click", (evt) => {
      console.log(JSON.stringify(evt.latlng) + ","); //DEBUG
   });
   */

   const latLngs = [
      { "lat": 43.72236612700568, "lng": -79.62405681610109 },
      { "lat": 43.722839100953614, "lng": -79.62431430816652 },
      { "lat": 43.72296315907589, "lng": -79.62488293647768 },
      { "lat": 43.722575476590784, "lng": -79.62510824203493 },
      { "lat": 43.722009455657265, "lng": -79.62525844573976 },
      { "lat": 43.72152096753894, "lng": -79.6253764629364 },
      { "lat": 43.72112552185925, "lng": -79.6255910396576 },
      { "lat": 43.7208773977472, "lng": -79.62582170963289 },
      { "lat": 43.72075333530584, "lng": -79.62568759918214 },
      { "lat": 43.72053622541529, "lng": -79.62521553039552 },
      { "lat": 43.720509086623636, "lng": -79.62512969970705 },
      { "lat": 43.720784350940264, "lng": -79.62477564811708 },
      { "lat": 43.72113327572119, "lng": -79.62437868118288 },
      { "lat": 43.72150545991439, "lng": -79.62392807006837 },
      { "lat": 43.721714812507, "lng": -79.62370812892915 },
      { "lat": 43.7218311191868, "lng": -79.62369203567506 },
      { "lat": 43.72212188489844, "lng": -79.62386369705202 },
      { "lat": 43.72236612700568, "lng": -79.62405681610109 },
   ];
   const colors = [
      null,
      null,
      "#BD2727",
      "#BD2727",
      "#BD2727",
      null,
      null,
      null,
      "#FBBD04",
      "#FBBD04",
      "#FBBD04",
      null,
      null,
      "#FBBD04",
      "#FBBD04",
      "#FBBD04",
      null,
      null,
   ];

   const polyColorLine = L.polycolor(latLngs, {
      colors: colors,
      weight: 3
   }).addTo(storage.map);

   polyColorLine.on("mouseover", (evt) => {
      polyColorLine.unbindTooltip();
      const segmentStatus = getPolyColorLineSegmentInfo(evt);
      const latLngTxt = (segmentStatus.color ? `color: ${segmentStatus.color} ` : "") + `lat: ${evt.latlng.lat} lng: ${evt.latlng.lng}`;
      polyColorLine.bindTooltip(latLngTxt, {
         "className": "spl-map-vehicle-tooltip",
      }).openTooltip(evt.latlng);
   });

   storage.map.fitBounds(polyColorLine.getBounds());
}

function getPolyColorLineSegmentInfo(evt) {

   let i = 0;
   const polylineCoordsArr = evt.target.getLatLngs();
   const polylineColorsArr = evt.target._colorParts;
   const segmentStatusObj = {
      found: false,
      startLatLng: {},
      endLatLng: {},
      startIdx: null,
      endIdx: null,
      color: ""
   };
   while (polylineCoordsArr[i + 1]) {
      const segmentFound = L.GeometryUtil.belongsSegment(evt.latlng, polylineCoordsArr[i], polylineCoordsArr[i + 1]);
      if (segmentFound) {
         segmentStatusObj.found = true;
         segmentStatusObj.startIdx = i;
         segmentStatusObj.endIdx = i + 1;
         segmentStatusObj.startLatLng = polylineCoordsArr[segmentStatusObj.startIdx];
         segmentStatusObj.endLatLng = polylineCoordsArr[segmentStatusObj.endIdx];
         if (segmentStatusObj.endIdx <= polylineColorsArr.length) {
            segmentStatusObj.color = polylineColorsArr[segmentStatusObj.startIdx];
         }
         break;
      }
      i++;
   }
   return segmentStatusObj;
}