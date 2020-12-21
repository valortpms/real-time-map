import L from "leaflet";
import "../../../node_modules/leaflet-geometryutil";
import splSrv from "../services";
import storage from "../../dataStore";
import layerModel from "../../components/map/layers/layer-model";
import { colorHexCodes } from "../../constants/color-hex-codes";

export function initSplMapFaults() {
   splSrv.events.register("onLoadSplServices", () => {
      demoVeh.init();

      // DEBUG - TEST - PLEASE DELETE ON PROD
      //    speedLabel dateInputLabel timeRangeStartLabel currentTimeLabel
      //
      document.getElementById("speedLabel").addEventListener("click", demoVeh.step.bind(demoVeh));
      document.getElementById("dateInputLabel").addEventListener("click", demoVeh.clear.bind(demoVeh));
      document.getElementById("timeRangeStartLabel").addEventListener("click", demoVeh.utils.enableGetMapLatLng.bind(demoVeh));
   });
}

const demoVeh = {

   _onInitDrawXXLatLngs: 8,         // How many latLng points to draw on initialization (default: 1)

   _mapGroupLayer: "splDemoLayer",

   _polyLine: null,
   _step: 0,

   init: function () {
      const me = this;
      me.data.init();
      me.resetDemo();
   },

   resetDemo: function () {
      const me = this;

      if (!me.data.latLngArr || me.data.latLngArr && !me.data.latLngArr.length) { return; }

      const latlngArr = me.data.latLngArr.slice(0, me._onInitDrawXXLatLngs);
      me._step = me._onInitDrawXXLatLngs - 1;

      me._polyLine = L.polyline(latlngArr, {
         smoothFactor: 1,
         weight: 3,
         color: colorHexCodes.testPurple // testYellow testLimeGreen
      });

      me._polyLine.on("mouseover", (evt) => {
         me._polyLine.unbindTooltip();

         const timestamp = splMapFaultUtils.latlngToTime(evt.latlng, evt.target.getLatLngs(), demoVeh.data.latLngIdx);
         const faultInfo = splMapFaultUtils.faultInfoByCurrentSecond(timestamp, demoVeh.data.splFaultTimelineEvents);
         const latLngTxt = (faultInfo.faultState ? `${faultInfo.faultState} fault: ${faultInfo.tooltipDesc} ` : `lat: ${evt.latlng.lat} lng: ${evt.latlng.lng}`);

         me._polyLine.bindTooltip(latLngTxt, {
            "className": "spl-map-vehicle-tooltip",
         }).openTooltip(evt.latlng);
      });

      layerModel.addToLayer(me._mapGroupLayer, me._polyLine);
      me._polyLine.bringToFront();

      if (me._onInitDrawXXLatLngs > 1) {
         splMapFaultMgr.setLatLngs(me._polyLine.getLatLngs(), demoVeh.data);
      }
   },

   step: function () {
      const me = this;

      me._step++;
      if (me._step >= me.data.latLngArr.length) { return; }

      me._polyLine.addLatLng(me.data.latLngArr[me._step]);
      splMapFaultMgr.addLatLng(me._polyLine.getLatLngs(), demoVeh.data);

      storage.map.fitBounds(me._polyLine.getBounds());
   },

   clear: function () {
      const me = this;
      me._step = 0;
      layerModel.clearLayersInGroup(me._mapGroupLayer);
      me.resetDemo();
   },

   utils: {

      _getMapLatLngEnabled: false,

      enableGetMapLatLng: function () {
         const me = this;
         if (!me._getMapLatLngEnabled) {
            console.log("==== demoVeh.utils.enableGetMapLatLng() ENABLED ====");//DEBUG
            storage.map.on("click", (evt) => { console.log(JSON.stringify(evt.latlng) + ","); });
            me._getMapLatLngEnabled = true;
         }
      }
   },

   data: {

      latLngArr: [],          // FROM: evt.target.getLatLngs()
      latLngIdx: {},          // FROM: deviceData
      orderedDateTimes: [],   // FROM: deviceData.orderedDateTimes

      // FROM: SpartanLync / Geotab API call
      // ( SpartanLync created Obj after querying Fault / Ignition events for entire day for all selected vehicles )
      splFaultTimelineEvents: [
         { time: "1606900000", evtType: "IGOn" },
         { time: "1606997742", evtType: "fault", evtState: "RED", evtColor: "#BD2727", tooltipDesc: "Extreme Over Pressure ( Axle 3 Tire 4 - Tractor )" },
         { time: "1607007742", evtType: "fault", evtState: "AMBER", evtColor: "#FBBD04", tooltipDesc: "Over Pressure ( Axle 3 Tire 2 - Tractor )" },
         { time: "1607024958", evtType: "fault", evtState: "RED", evtColor: "#BD2727", tooltipDesc: "Extreme Under Pressure ( Axle 1 Tire 2 - Trailer 1 )" },
         { time: "1607026007", evtType: "fault", evtState: "RED", evtColor: "#BD2727", tooltipDesc: "Under Pressure ( Axle 1 Tire 1 - Tractor )" },
         { time: "1607028007", evtType: "IGOff" },

         { time: "1607500000", evtType: "IGOn" },
         { time: "1607513796", evtType: "fault", evtState: "AMBER", evtColor: "#FBBD04", tooltipDesc: "Under Pressure ( Axle 1 Tire 2 - Tractor )" },
         { time: "1607515801", evtType: "fault", evtState: "AMBER", evtColor: "#FBBD04", tooltipDesc: "Over Pressure ( Axle 2 Tire 1 - Tractor )" },
         { time: "1607521493", evtType: "fault", evtState: "AMBER", evtColor: "#FBBD04", tooltipDesc: "Under Pressure ( Axle 1 Tire 2 - Tractor )" },
         { time: "1607531493", evtType: "IGOff" },

         { time: "1607532000", evtType: "IGOn" },
         { time: "1607532712", evtType: "fault", evtState: "AMBER", evtColor: "#FBBD04", tooltipDesc: "Under Pressure ( Axle 1 Tire 1 - Tractor )" },
         { time: "1607570184", evtType: "fault", evtState: "AMBER", evtColor: "#FBBD04", tooltipDesc: "Over Pressure ( Axle 1 Tire 2 - Tractor )" },
         { time: "1607588184", evtType: "fault", evtState: "AMBER", evtColor: "#FBBD04", tooltipDesc: "Under Pressure ( Axle 2 Tire 1 - Trailer 1 )" },
         { time: "1607608184", evtType: "IGOff" },
      ],

      /* ==== PRIVATE DATA ==== */

      _locInTimeDb: [
         { time: "1606972480", loc: { "lat": 43.72236612700568, "lng": -79.62405681610109 } },
         { time: "1606994975", loc: { "lat": 43.722839100953614, "lng": -79.62431430816652 } },

         { time: "1606997742", loc: { "lat": 43.72296315907589, "lng": -79.62488293647768 } },
         { time: "1607024958", loc: { "lat": 43.722575476590784, "lng": -79.62510824203493 } },
         { time: "1607026007", loc: { "lat": 43.722009455657265, "lng": -79.62525844573976 } },

         { time: "1607282326", loc: { "lat": 43.72152096753894, "lng": -79.6253764629364 } },
         { time: "1607511173", loc: { "lat": 43.72112552185925, "lng": -79.6255910396576 } },
         { time: "1607511921", loc: { "lat": 43.7208773977472, "lng": -79.62582170963289 } },

         { time: "1607513796", loc: { "lat": 43.72075333530584, "lng": -79.62568759918214 } },
         { time: "1607515801", loc: { "lat": 43.72053622541529, "lng": -79.62521553039552 } },
         { time: "1607521493", loc: { "lat": 43.720509086623636, "lng": -79.62512969970705 } },

         { time: "1607528918", loc: { "lat": 43.720784350940264, "lng": -79.62477564811708 } },
         { time: "1607530881", loc: { "lat": 43.72113327572119, "lng": -79.62437868118288 } },

         { time: "1607532712", loc: { "lat": 43.72150545991439, "lng": -79.62392807006837 } },
         { time: "1607570184", loc: { "lat": 43.721714812507, "lng": -79.62370812892915 } },
         { time: "1607588184", loc: { "lat": 43.7218311191868, "lng": -79.62369203567506 } },

         { time: "1607624367", loc: { "lat": 43.72212188489844, "lng": -79.62386369705202 } },
         { time: "1608452183", loc: { "lat": 43.72236612700568, "lng": -79.62405681610109 } },
      ],

      /* ==== PUBLIC METHODS ==== */

      init: function () {
         const me = this;

         me.latLngIdx = {};
         me.latLngArr = [];
         me.orderedDateTimes = [];

         me._locInTimeDb.sort((a, b) => { return a.time > b.time; });
         for (const obj of me._locInTimeDb) {
            me.latLngArr.push(obj.loc);
            me.latLngIdx[obj.time] = obj.loc;
            me.orderedDateTimes.push(obj.time);
         }
      }
   }
};

export const splMapFaultMgr = {

   _faultsLayerGroupName: "",

   _init: function () {
      const me = this;
      if (!me._faultsLayerGroupName) {
         me._faultsLayerGroupName = splSrv.mapFaultLayerName;

         if (!layerModel.layerList.hasOwnProperty(me._faultsLayerGroupName)) {
            layerModel.createNewLayer(me._faultsLayerGroupName);
         }
      }
   },

   addLatLng: function (polyLineLatLngArr, vehObj) {
      const me = this;
      me._init();

      //console.log("==== splMapFaultMgr.addLatLng() polyLineLatLngArr =", polyLineLatLngArr);//DEBUG
      //layerModel.addToLayer(faultsLayerGroupName, me._polyLine);
   },

   setLatLngs: function (latLngArr, vehObj) {
      const me = this;
      me._init();

      //console.log("==== splMapFaultMgr.setLatLngs() latLngArr =", latLngArr, " vehObj =", vehObj);//DEBUG
   }
};

export const splMapFaultUtils = {

   /**
   * faultInfoByCurrentSecond() SpartanLync Fault Info at a specific time on Leaflet polyline
   *
   * @param {int} currentSecond - Unix timstamp of fault to search for details
   * @param {array} timelineArr - Array of fault event objects sorted on a timeline of sensor faults and ignition events
   *
   * @return {object}           - Detail of AMBER/RED prioritized faults occuring on a specied second
   */
   faultInfoByCurrentSecond: function (currentSecond, timelineArr) {

      const currentStateObj = {
         faultState: "",
         faultColor: "",
         tooltipDesc: "",
      };

      if (!isNaN(currentSecond) && Array.isArray(timelineArr) && timelineArr.length > 1) {
         timelineArr.sort((a, b) => { return a.time > b.time; });
         if (currentSecond < timelineArr[0].time || currentSecond > timelineArr[timelineArr.length - 1].time) {
            return currentStateObj; // Search out of bounds of fault timeline
         }
         for (const idx in timelineArr) {
            if (idx >= timelineArr.length - 1) { continue; }
            const evtNow = timelineArr[idx];
            const evtNext = timelineArr[parseInt(idx) + 1];

            if (typeof evtNow.evtState === "undefined") {
               currentStateObj.faultState = currentStateObj.faultColor = currentStateObj.tooltipDesc = "";
            }
            else if (!(currentStateObj.faultState === "RED" && evtNow.evtState === "AMBER")) {
               currentStateObj.faultState = evtNow.evtState;
               currentStateObj.faultColor = evtNow.evtColor;
               currentStateObj.tooltipDesc = evtNow.tooltipDesc;
            }
            if (currentSecond >= evtNow.time && currentSecond <= evtNext.time) {
               return currentStateObj;
            }
         }
      }
      return null;
   },

   /**
   * latlngToTime() Get Unix timestamp of the nearest Leaflet polyline segment point, when supplied a LatLng position on the polyline
   *
   * @param {object} latlng          - LatLng position on polyline, as starting point for timestamp search
   * @param {array} latLngByArr      - Array of Leaflet LatLng points making up polyline
   * @param {object} latLngByTimeIdx - Object of LatLng points, with Unix timestamps as keys
   *
   * @return {int}                   - Unix timestamp of nearest Leaflet polyline segment point to specified LatLng position on polyline
   */
   latlngToTime: function (latlng, latLngByArr, latLngByTimeIdx) {
      const me = this;
      const info = me.findLatLngSegment(latlng, latLngByArr);
      if (info.found && info.nearestIdx !== null) {
         const latLngNeedle = info.nearestLatLng;
         for (const time of Object.keys(latLngByTimeIdx)) {
            if (isNaN(time)) { continue; }
            if (latLngNeedle.equals(latLngByTimeIdx[time])) {
               return time;
            }
         }
      }
      return null;
   },

   /**
   * findLatLngSegment() Get info on the LatLng points bounding a LatLng position on a Leaflet polyline Array
   *
   * @param {object} latlng   - LatLng position on polyline to search on boundary points
   * @param {array} latLngArr - Array of Leaflet LatLng points making up polyline
   *
   * @return {object}         - Details of the segment points boundary of a specied LatLng position on Leaflet polyline Array
   */
   findLatLngSegment: function (latlng, latLngArr) {

      let i = 0;
      const segmentStatusObj = {
         found: false,
         startLatLng: {},
         endLatLng: {},
         nearestLatLng: {},
         startIdx: null,
         endIdx: null,
         nearestIdx: null
      };

      if (!latLngArr.length) { return segmentStatusObj; }
      if (latLngArr.length === 1) {
         segmentStatusObj.found = true;
         segmentStatusObj.startLatLng = segmentStatusObj.endLatLng = latLngArr[0];
         segmentStatusObj.startIdx = segmentStatusObj.endIdx = 0;
         return segmentStatusObj;
      }

      while (latLngArr[i + 1]) {
         const segmentFound = L.GeometryUtil.belongsSegment(L.latLng(latlng), L.latLng(latLngArr[i]), L.latLng(latLngArr[i + 1]));
         if (segmentFound) {
            const distanceToA = L.latLng(latLngArr[i]).distanceTo(latlng);
            const distanceToB = L.latLng(latLngArr[i + 1]).distanceTo(latlng);

            segmentStatusObj.found = true;
            segmentStatusObj.startIdx = i;
            segmentStatusObj.endIdx = i + 1;
            segmentStatusObj.nearestIdx = distanceToA <= distanceToB ? i : i + 1;
            segmentStatusObj.startLatLng = L.latLng(latLngArr[segmentStatusObj.startIdx]);
            segmentStatusObj.endLatLng = L.latLng(latLngArr[segmentStatusObj.endIdx]);
            segmentStatusObj.nearestLatLng = L.latLng(latLngArr[segmentStatusObj.nearestIdx]);
            break;
         }
         i++;
      }
      return segmentStatusObj;
   }
};

/*
//create new path, every path must belong to a marker.
export function initHistoricPath(deviceMarker) {

   const {
      deviceID,
      deviceData,
   } = deviceMarker;

   const latLngList = getLatLngsForTimeRange(storage.timeRangeStart, storage.currentTime, deviceData);
   const polyline = L.polyline(latLngList, {
      smoothFactor: 1,
      weight: 3,
      color: colorHexCodes.testLimeGreen //DEBUG  geotabBlue
   });

   const historicPathConstructors = {
      deviceID,
      deviceData,
      polyline
   };

   const newHistoricPath = {
      ...historicPathModel,
      ...historicPathConstructors
   };

   layerModel.addToMovingLayer(polyline);
   bindDeviceNamePopup(deviceID, polyline);
   return newHistoricPath;
}

export const historicPathModel = {
   deviceID: undefined,
   deviceData: undefined,
   polyline: undefined,
   delayedInterval: undefined,

   timeChangedUpdate(currentSecond) {
      clearTimeout(this.delayedInterval);
      this.delayedInterval = null;
      const latLngs = getLatLngsForTimeRange(storage.timeRangeStart, currentSecond, this.deviceData);
      this.polyline.setLatLngs(latLngs);
   },

   updateHistoricPath(currentSecond, realLatLng) {
      this.delayedInterval = setTimeout(() => {
         this.polyline.addLatLng(realLatLng);

         if (typeof storage.selectedDevices[this.deviceID] !== "undefined") {
            console.log("==== historicPathModel.updateHistoricPath(" + storage.selectedDevices[this.deviceID].name + ") currentSecond =", currentSecond, "realLatLng = ", realLatLng);//DEBUG
         }

      }, storage.dateKeeper$.getPeriod() * 0.75);
   },
};
*/