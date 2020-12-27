import L from "leaflet";
import "../../../node_modules/leaflet-geometryutil";
import moment from "moment-timezone";
import splSrv from "../services";
import storage from "../../dataStore";
import layerModel from "../../components/map/layers/layer-model";
import { apiConfig } from "../../dataStore/api-config";
import { colorHexCodes } from "../../constants/color-hex-codes";
import { deviceSearch } from "../../components/configuration/vehicles-config/vehicle-search";
import { markerList } from "../../dataStore/map-data";
import { checkSameDay } from "../../utils/helper";
import { INITGeotabTpmsTemptracLib } from "../services/api/temptrac-tpms";

export function initSplMapFaults() {

   // Create Faults Timeline Event Mgr
   splMapFaultMgr.faults = new FaultTimelineEventMgr();

   // Available after SplServices init
   splSrv.events.register("onLoadSplServices", () => {

      splMapFaultMgr.initEventHandlers();

      // DEMO INIT - PLEASE DELETE ON PROD - DEBUG
      // DomButtonIds: speedLabel dateInputLabel timeRangeStartLabel currentTimeLabel
      //
      document.getElementById("speedLabel").addEventListener("click", demoVeh.step.bind(demoVeh));
      document.getElementById("currentTimeLabel").addEventListener("click", demoVeh.clear.bind(demoVeh));
      document.getElementById("dateInputLabel").addEventListener("click", demoVeh.utils.enableGetMapLatLng.bind(demoVeh));
   });
}

const demoVeh = {

   _onInitDrawXXLatLngs: 99,               // How many latLng points to draw on initialization
   _RandomizeOnInitDrawXXLatLngs: false,  // Randomize _onInitDrawXXLatLngs with a number between 1-10

   _mapGroupLayer: "splDemoLayer",  // Demo polyline layers are drawn on this layerGroup

   _polyLine: null,
   _step: null,

   init: function () {
      const me = this;
      me.data.init();
      me.initDemo();
   },

   initDemo: function () {
      const me = this;

      me._onInitDrawXXLatLngs = me._RandomizeOnInitDrawXXLatLngs ? Math.floor((Math.random() * 10) + 1) : me._onInitDrawXXLatLngs;

      if (!me.data.latLngArr || me.data.latLngArr && !me.data.latLngArr.length) { return; }
      me._onInitDrawXXLatLngs = me._onInitDrawXXLatLngs > me.data.latLngArr.length ? me.data.latLngArr.length : me._onInitDrawXXLatLngs;

      const vehLatlngArr = me.data.latLngArr.slice(0, me._onInitDrawXXLatLngs);
      me._step = me._onInitDrawXXLatLngs - 1;

      me._polyLine = L.polyline(vehLatlngArr, {
         smoothFactor: 1,
         weight: 3,
         color: colorHexCodes.geotabBlue
      });

      layerModel.addToLayer(me._mapGroupLayer, me._polyLine);
      me._polyLine.bringToFront();

      // Show what we have
      if (me._polyLine) {
         storage.map.fitBounds(me._polyLine.getBounds());
      }

      // Wait for Faults to Load
      splMapFaultMgr.faults.getTimelineEvents(me.data.deviceID).then((splFaultTimelineEvents) => {
         //           LIVE DATASOURCES:( vehMarker.deviceID  , Event.latLngs            , vehMarker   , vehMarker.deviceData        , splFaultTimelineEvents  )
         splMapFaultMgr.setLatLngFaults(demoVeh.data.deviceID, me._polyLine.getLatLngs(), demoVeh.data, demoVeh.data.latLngByTimeIdx, splFaultTimelineEvents);
      });
   },

   step: function () {
      const me = this;

      if (me._step === null) {
         me._step = 0;
         me.init();
         return;
      }

      // Show what we have
      if (me._polyLine) {
         storage.map.fitBounds(me._polyLine.getBounds());
      }

      // Show next segment, if there is more
      me._step++;
      if (me._step >= me.data.latLngArr.length) { return; }

      me._polyLine.addLatLng(me.data.latLngArr[me._step]);

      // Wait for Faults to Load
      splMapFaultMgr.faults.getTimelineEvents(me.data.deviceID).then((splFaultTimelineEvents) => {
         //           LIVE DATASOURCES:( vehMarker.deviceID  , Event.latLngs            , vehMarker   , vehMarker.deviceData        , splFaultTimelineEvents  )
         splMapFaultMgr.setLatLngFaults(demoVeh.data.deviceID, me._polyLine.getLatLngs(), demoVeh.data, demoVeh.data.latLngByTimeIdx, splFaultTimelineEvents);
      });
   },

   clear: function () {
      const me = this;
      me._step = 0;
      layerModel.clearLayersInGroup(me._mapGroupLayer);
      splMapFaultMgr.clear();
      me.initDemo();
   },

   //DEBUG
   utils: {

      _getMapLatLngEnabled: false,

      enableGetMapLatLng: function () {
         const me = this;
         if (!me._getMapLatLngEnabled) {
            console.log("==== demoVeh.utils.enableGetMapLatLng() ENABLED ====");
            storage.map.on("click", (evt) => { console.log(JSON.stringify(evt.latlng)); });
            me._getMapLatLngEnabled = true;
         }
      }
   },

   data: {

      deviceID: "b9999",      // Fake Geotab Vehicle DeviceID

      latLngArr: [],          // FROM: evt.target.getLatLngs()
      latLngByTimeIdx: {},    // FROM: vehMarker.deviceData
      orderedDateTimes: [],   // FROM: vehMarker.deviceData.orderedDateTimes

      // FROM: Auto-Generated by SpartanLync / Geotab API call
      // ( SpartanLync created Obj after querying Fault / Ignition events for entire day for all selected vehicles ) colorHexCodes.spartanLyncRed colorHexCodes.spartanLyncAmber
      _demoSplFaultTimelineEvents: [
         { latLngTime: "1606900000", realTime: "1606900000", evtType: "IGOn" },
         { latLngTime: "1606972480", realTime: "1606972480", evtType: "fault", evtState: "AMBER", evtColor: colorHexCodes.spartanLyncAmber, tooltipDesc: "Over Pressure ( Axle 1 Tire 1 - Tractor )" },
         { latLngTime: "1606994975", realTime: "1606994975", evtType: "fault", evtState: "AMBER", evtColor: colorHexCodes.spartanLyncAmber, tooltipDesc: "Over Pressure ( Axle 1 Tire 2 - Trailer 1 )" },

         { latLngTime: "1606997742", realTime: "1606997742", evtType: "fault", evtState: "RED", evtColor: colorHexCodes.spartanLyncRed, tooltipDesc: "Extreme Over Pressure ( Axle 2 Tire 1 - Tractor )" },
         { latLngTime: "1607024958", realTime: "1607024958", evtType: "fault", evtState: "RED", evtColor: colorHexCodes.spartanLyncRed, tooltipDesc: "Extreme Under Pressure ( Axle 2 Tire 2 - Trailer 1 )" },
         { latLngTime: "1607026007", realTime: "1607026007", evtType: "fault", evtState: "RED", evtColor: colorHexCodes.spartanLyncRed, tooltipDesc: "Under Pressure ( Axle 2 Tire 3 - Dolly )" },
         { latLngTime: "1607028007", realTime: "1607028007", evtType: "IGOff" },

         { latLngTime: "1607500000", realTime: "1607500000", evtType: "IGOn" },
         { latLngTime: "1607513796", realTime: "1607513796", evtType: "fault", evtState: "AMBER", evtColor: colorHexCodes.spartanLyncAmber, tooltipDesc: "Under Pressure ( Axle 3 Tire 1 - Tractor )" },
         { latLngTime: "1607515801", realTime: "1607515801", evtType: "fault", evtState: "AMBER", evtColor: colorHexCodes.spartanLyncAmber, tooltipDesc: "Over Pressure ( Axle 3 Tire 2 - Dolly )" },
         { latLngTime: "1607521493", realTime: "1607521493", evtType: "fault", evtState: "AMBER", evtColor: colorHexCodes.spartanLyncAmber, tooltipDesc: "Under Pressure ( Axle 3 Tire 3 - Tractor )" },
         { latLngTime: "1607528900", realTime: "1607531493", evtType: "IGOff" },
         //             1607528918
         //             1607530881
         //{ latLngTime: "1607531497", realTime: "1607531493", evtType: "IGOff" },

         { latLngTime: "1607532000", realTime: "1607532000", evtType: "IGOn" },
         { latLngTime: "1607532712", realTime: "1607532712", evtType: "fault", evtState: "AMBER", evtColor: colorHexCodes.spartanLyncAmber, tooltipDesc: "Under Pressure ( Axle 4 Tire 1 - Tractor )" },
         { latLngTime: "1607570184", realTime: "1607570184", evtType: "fault", evtState: "AMBER", evtColor: colorHexCodes.spartanLyncAmber, tooltipDesc: "Over Pressure ( Axle 4 Tire 2 - Trailer 1 )" },
         { latLngTime: "1607588184", realTime: "1607588184", evtType: "fault", evtState: "AMBER", evtColor: colorHexCodes.spartanLyncAmber, tooltipDesc: "Under Pressure ( Axle 4 Tire 3 - Dolly )" },
         { latLngTime: "1607608184", realTime: "1607608184", evtType: "IGOff" },
      ],

      // Demo data manually created to represent Vehicle route, automatically polled by Geotab API
      _demoVehDataWithTime: [
         { time: "1606972480", loc: { "lat": 43.72236612700568, "lng": -79.62405681610109 } }, //AMBER
         { time: "1606994975", loc: { "lat": 43.722839100953614, "lng": -79.62431430816652 } },

         { time: "1606997742", loc: { "lat": 43.72296315907589, "lng": -79.62488293647768 } }, //RED
         { time: "1607024958", loc: { "lat": 43.722575476590784, "lng": -79.62510824203493 } },
         { time: "1607026007", loc: { "lat": 43.722009455657265, "lng": -79.62525844573976 } },

         { time: "1607282326", loc: { "lat": 43.72152096753894, "lng": -79.6253764629364 } },
         { time: "1607511173", loc: { "lat": 43.72112552185925, "lng": -79.6255910396576 } },
         { time: "1607511921", loc: { "lat": 43.7208773977472, "lng": -79.62582170963289 } },

         { time: "1607513796", loc: { "lat": 43.72075333530584, "lng": -79.62568759918214 } }, //AMBER
         { time: "1607515801", loc: { "lat": 43.72053622541529, "lng": -79.62521553039552 } },
         { time: "1607521493", loc: { "lat": 43.720509086623636, "lng": -79.62512969970705 } },

         { time: "1607528918", loc: { "lat": 43.720784350940264, "lng": -79.62477564811708 } }, // NULL
         { time: "1607530881", loc: { "lat": 43.72113327572119, "lng": -79.62437868118288 } },  // NULL

         { time: "1607532712", loc: { "lat": 43.72150545991439, "lng": -79.62392807006837 } }, //AMBER - 11/19/2020
         { time: "1607570184", loc: { "lat": 43.721714812507, "lng": -79.62370812892915 } },
         { time: "1607588184", loc: { "lat": 43.7218311191868, "lng": -79.62369203567506 } },

         { time: "1607624367", loc: { "lat": 43.72212188489844, "lng": -79.62386369705202 } },
         { time: "1608452183", loc: { "lat": 43.72236612700567, "lng": -79.62405681610108 } },
      ],

      /* ==== PUBLIC METHODS ==== */

      init: function () {
         const me = this;

         me.latLngByTimeIdx = {};
         me.latLngArr = [];
         me.orderedDateTimes = [];

         me._demoVehDataWithTime.sort((a, b) => { return a.time > b.time; });
         for (const obj of me._demoVehDataWithTime) {
            me.latLngArr.push(obj.loc);
            me.latLngByTimeIdx[obj.time] = obj.loc;
            me.orderedDateTimes.push(obj.time);
         }
      }
   }
};

export const splMapFaultMgr = {

   faults: null, // Instance of FaultTimelineEventMgr Class

   _faultsLayerGroupName: "",
   _faultsSegmentNamePrefix: "fSeg-",

   _defaultPolylineWeight: 3,
   _defaultPolylineSmoothFactor: 1,

   _vehMarkers: {},

   _init: function (vehMarker, latLngByTimeIdx) {
      const me = this;

      if (typeof vehMarker !== "object" || typeof vehMarker.deviceID === "undefined") { return false; }

      const vehId = vehMarker.deviceID;

      // Tasks we do only once
      if (!me._faultsLayerGroupName) {

         // Create Faults Layer on Map
         me._faultsLayerGroupName = splSrv.mapFaultLayerName;
         if (!layerModel.layerList.hasOwnProperty(me._faultsLayerGroupName)) {
            layerModel.createNewLayer(me._faultsLayerGroupName);
         }
      }

      // Init Faults DB object, per Vehicle
      if (typeof vehMarker.splMapFaults === "undefined") {
         vehMarker.splMapFaults = {
            faultSegments: {},
            historicPathLatLngToTimeDB: new INITlatLngToTimeDB(latLngByTimeIdx)
         };
         me._vehMarkers[vehId] = vehMarker;
      }

      return vehMarker.splMapFaults;
   },

   _getVehName: function (vehId) {
      return typeof deviceSearch.selectedIDS[vehId] !== "undefined" ? deviceSearch.selectedIDS[vehId].name : vehId.toUpperCase();
   },

   _createPolyline: function (faultId, vehId, startIdx, endIdx, color, vehPathLatLngArr, vehDeviceData, splVehMapFaultsDB, splFaultTimelineEvents) {
      const me = this;
      let faultPolyline = null;
      try {
         faultPolyline = new FaultPolyline(
            faultId,
            vehId,
            me._getVehName(vehId),
            me._faultsLayerGroupName,
            me._defaultPolylineSmoothFactor,
            me._defaultPolylineWeight,
            color,
            vehPathLatLngArr.slice(startIdx, endIdx + 1)
         );
      }
      catch (err) {
         console.log("==== splMapFaultMgr._createPolyline() ERROR:", err);
         return null;
      }
      if (faultPolyline) {
         splVehMapFaultsDB.faultSegments[faultPolyline.getId()] = {
            polyline: faultPolyline
         };
         faultPolyline.enableFaultInfoTooltip(vehDeviceData, splFaultTimelineEvents);
      }
      return faultPolyline;
   },

   // eslint-disable-next-line complexity
   _searchVehPathForFaultSegments: function (vehId, vehPathLatLngArr, latLngByTimeIdx, splFaultTimelineEvents) {
      //const DEBUG = true;
      const me = this;
      const segmentsArr = [];
      const latLngByTimeVehAPI = me._vehMarkers[vehId].splMapFaults.historicPathLatLngToTimeDB;
      let sInfo = null;
      let sStart = 0;
      let sEnd = 0;

      // No need for search on single-point segments
      if (vehPathLatLngArr.length === 1) {
         const timestamp = splMapFaultUtils.latlngToTime(vehPathLatLngArr[0], null, latLngByTimeVehAPI, latLngByTimeIdx);
         const faultInfo = splMapFaultUtils.faultInfoByTimestamp(timestamp, splFaultTimelineEvents);

         if (faultInfo && faultInfo.faultState) {
            sInfo = faultInfo;
            const segmentId = splMapFaultUtils.createLatlngSegmentId(me._faultsSegmentNamePrefix + vehId, vehPathLatLngArr[sStart]);
            sInfo.id = segmentId ? segmentId : me._faultsSegmentNamePrefix + vehId + "-" + sStart;
            sInfo.startIdx = 0;
            sInfo.endIdx = 0;
            sInfo.pointCount = 1;
            delete sInfo.tooltipDesc;
            segmentsArr.push(sInfo);
         }
         return segmentsArr;
      }

      // Search multi-point paths
      for (const idx in vehPathLatLngArr) {
         const vehPathLatLng = vehPathLatLngArr[idx];
         const timestamp = splMapFaultUtils.latlngToTime(vehPathLatLng, null, latLngByTimeVehAPI, latLngByTimeIdx);
         const faultInfo = splMapFaultUtils.faultInfoByTimestamp(timestamp, splFaultTimelineEvents);

         if (!faultInfo) { return segmentsArr; }
         if (faultInfo.faultState) {
            if (sStart === sEnd) {
               sInfo = faultInfo;
               sStart = idx;
               sEnd = sStart + 1;
               if (typeof DEBUG !== "undefined" && DEBUG) { console.log("(", vehId, ")==== idx =", idx, " ================================== START SEGMENT"); }//DEBUG
            }
            else {
               if (sInfo.faultState !== faultInfo.faultState) {
                  const segmentId = splMapFaultUtils.createLatlngSegmentId(me._faultsSegmentNamePrefix + vehId, vehPathLatLngArr[sStart]);
                  sInfo.id = segmentId ? segmentId : me._faultsSegmentNamePrefix + vehId + "-" + sStart;
                  sInfo.startIdx = parseInt(sStart);
                  sInfo.endIdx = parseInt(idx);
                  sInfo.pointCount = idx - sStart + 1;
                  delete sInfo.tooltipDesc;
                  segmentsArr.push(sInfo);
                  if (typeof DEBUG !== "undefined" && DEBUG) { console.log("(", vehId, ")==== idx =", idx, " ================================== CREATE SEGMENT"); }//DEBUG

                  sInfo = faultInfo;
                  sStart = idx;
                  sEnd = sStart + 1;
                  if (typeof DEBUG !== "undefined" && DEBUG) { console.log("(", vehId, ")==== idx =", idx, " ================================== START SEGMENT"); }//DEBUG
               }
               else {
                  sEnd = idx;
                  if (typeof DEBUG !== "undefined" && DEBUG) { console.log("(", vehId, ")==== idx =", idx, " ================================== UPDATE SEGMENT END"); }//DEBUG
               }
            }
         }
         else {
            if (sStart !== sEnd) {
               const segmentId = splMapFaultUtils.createLatlngSegmentId(me._faultsSegmentNamePrefix + vehId, vehPathLatLngArr[sStart]);
               sInfo.id = segmentId ? segmentId : me._faultsSegmentNamePrefix + vehId + "-" + sStart;
               sInfo.startIdx = parseInt(sStart);
               sInfo.endIdx = parseInt(idx);
               sInfo.pointCount = idx - sStart + 1;
               delete sInfo.tooltipDesc;
               segmentsArr.push(sInfo);
               sInfo = null;
               sStart = sEnd = idx;
               if (typeof DEBUG !== "undefined" && DEBUG) { console.log("(", vehId, ")==== idx =", idx, " ================================== CREATE SEGMENT"); }//DEBUG
            }
         }
         if (typeof DEBUG !== "undefined" && DEBUG) { console.log("(", vehId, ")==== idx =", idx, timestamp, " f =", faultInfo); }//DEBUG
      }
      if (sStart !== sEnd) {
         const segmentId = splMapFaultUtils.createLatlngSegmentId(me._faultsSegmentNamePrefix + vehId, vehPathLatLngArr[sStart]);
         sInfo.id = segmentId ? segmentId : me._faultsSegmentNamePrefix + vehId + "-" + sStart;
         sInfo.startIdx = parseInt(sStart);
         sInfo.endIdx = parseInt(vehPathLatLngArr.length - 1);
         sInfo.pointCount = sInfo.endIdx - sInfo.startIdx + 1;
         delete sInfo.tooltipDesc;
         segmentsArr.push(sInfo);
         if (typeof DEBUG !== "undefined" && DEBUG) { console.log("(", vehId, ")==== idx =", idx, " ================================== CREATE SEGMENT"); }//DEBUG
      }

      return segmentsArr;
   },

   initEventHandlers: function () {
      const me = this;

      // Init CreateOrUpdate Faults Event Handler
      splSrv.events.register("onHistoricPathCreatedOrUpdated", (vehId, vehPathLatLngArr) => {
         const vehMarker = typeof markerList[vehId] !== "undefined" ? markerList[vehId] : null;
         if (vehPathLatLngArr.length && vehMarker) {
            // Wait for Faults to Load
            console.log("==== onHistoricPathCreatedOrUpdated(", vehId, ") INVOKED");//DEBUG
            splMapFaultMgr.faults.getTimelineEvents(vehId).then((splFaultTimelineEvents) => {
               splMapFaultMgr.setLatLngFaults(vehId, vehPathLatLngArr, vehMarker, vehMarker.deviceData, splFaultTimelineEvents);
            });//.catch(() => { });
         }
      }, false);

      // Init Cleanup Event Handler
      splSrv.events.register("onPreDateTimeChange", () => me.clear(), false);
   },

   setLatLngFaults: function (vehId, vehPathLatLngArr, vehMarker, vehDeviceData, splFaultTimelineEvents) {
      const me = this;
      const splVehMapFaultsDB = me._init(vehMarker, vehDeviceData);
      if (!splVehMapFaultsDB || !vehPathLatLngArr.length) { return; }

      // Search veh Path for fault segments
      for (const newFaultSegmentInfo of me._searchVehPathForFaultSegments(vehId, vehPathLatLngArr, vehDeviceData, splFaultTimelineEvents)) {
         let faultSegment;

         // Create Segment
         if (typeof splVehMapFaultsDB.faultSegments[newFaultSegmentInfo.id] === "undefined") {
            me._createPolyline(
               newFaultSegmentInfo.id, vehId,
               newFaultSegmentInfo.startIdx, newFaultSegmentInfo.endIdx,
               newFaultSegmentInfo.faultColor,
               vehPathLatLngArr, vehDeviceData,
               splVehMapFaultsDB, splFaultTimelineEvents
            );
            faultSegment = splVehMapFaultsDB.faultSegments[newFaultSegmentInfo.id];
            if (faultSegment) {
               faultSegment.info = newFaultSegmentInfo;
            }
            console.log("==== splMapFaultMgr.setLatLngFaults(", vehId, ") CREATE =", faultSegment); // DEBUG
         }

         // Update Segment
         else {

            // Update PolyLine
            faultSegment = splVehMapFaultsDB.faultSegments[newFaultSegmentInfo.id];
            if (newFaultSegmentInfo.pointCount > faultSegment.info.pointCount) {
               const numNewPoints = newFaultSegmentInfo.pointCount - faultSegment.info.pointCount;
               let i = 1;
               console.log("==== splMapFaultMgr.setLatLngFaults(", vehId, ") UPDATE =", faultSegment, " splVehMapFaultsDB =", splVehMapFaultsDB); // DEBUG
               while (i <= numNewPoints) {
                  const newPointIdx = faultSegment.info.endIdx + i;
                  const newLatLng = vehPathLatLngArr[newPointIdx];
                  faultSegment.polyline.addLatLngToFault(newLatLng, vehDeviceData);
                  i++;
               }
            }

            // Update Segment Details
            faultSegment.info = newFaultSegmentInfo;
         }
      }
   },

   getVehMarker: function (vehId) {
      const me = this;
      return typeof me._vehMarkers[vehId] !== "undefined" ? me._vehMarkers[vehId] : null;
   },

   clear: function () {
      const me = this;
      const vehsCleared = [];

      // Clear Faults on Map
      layerModel.clearLayersInGroup(me._faultsLayerGroupName);

      // Clear Fault metadata
      for (const vehMarker of Object.values(me._vehMarkers)) {
         if (typeof vehMarker !== "undefined" && typeof vehMarker.splMapFaults !== "undefined" && vehMarker && vehMarker.splMapFaults) {
            if (storage.selectedDevices[vehMarker.deviceID] && storage.selectedDevices[vehMarker.deviceID].name) {
               vehsCleared.push(storage.selectedDevices[vehMarker.deviceID].name);
            }
            delete vehMarker.splMapFaults;
         }
      }
      me._vehMarkers = {};

      // Log It
      if (vehsCleared.length) {
         console.log("---- splMapFaultMgr: Faults on Map cleared for Vehicle(s) [", vehsCleared.join(" + "), "]");
      }
   }
};

const splMapFaultUtils = {

   /**
   * searchLatlngArrForTime() Get Unix timestamp of nearest LatLng point in a Leaflet polyline, by searching every segments
   *
   * @param {object} latlng          - LatLng position on polyline, as starting point for timestamp search
   * @param {array} latLngByArr      - Array of Leaflet LatLng points making up polyline
   * @param {object} latLngByTimeIdx - Object of LatLng points, with Unix timestamps as keys
   *
   * @return {int}                   - Unix timestamp of nearest LatLng point to supplied LatLng point in Leaflet polyline
   */
   searchLatlngArrForTime: function (latlng, latLngByArr, latLngByTimeFaultAPI, latLngByTimeVehAPI, latLngByTimeIdx) {
      const me = this;
      const info = me.findLatLngSegment(latlng, latLngByArr);
      if (info.found && info.nearestIdx !== null) {
         const latLngNeedle = info.nearestLatLng;
         return me.latlngToTime(latLngNeedle, latLngByTimeFaultAPI, latLngByTimeVehAPI, latLngByTimeIdx);
      }
      return null;
   },

   /**
   * latlngToTime() Return Unix timestamp key to a specific LatLng point value by scanning for a LatLng match in multiple DB indexes
   *
   * @param {object} latlng               - Specific Real LatLng position in Db
   * @param {object} latLngByTimeFaultAPI - API for get() method to lookup in Fault Time Index
   * @param {object} latLngByTimeVehAPI   - API for get() method to lookup in Veh Time Index
   * @param {object} latLngByTimeIdx      - Object of LatLng points, with Unix timestamps as keys to sequentially search (Last resort b4 giving up)
   *
   * @return {int}                        - Unix timestamp of specified LatLng point or NULL if not found
   */
   latlngToTime: function (latlng, latLngByTimeFaultAPI, latLngByTimeVehAPI, latLngByTimeIdx) {
      const me = this;
      let timestamp;
      const [lat, lng] = me.parseLatLng(latlng);
      if (lat && lng) {
         const latLngNeedle = L.latLng({ "lat": lat, "lng": lng });

         // Try Local Db
         if (latLngByTimeFaultAPI && typeof latLngByTimeFaultAPI.get === "function") {
            timestamp = latLngByTimeFaultAPI.get(latLngNeedle);
            if (timestamp) { return timestamp; }
         }
         // Try Veh Historical Path Db
         if (latLngByTimeVehAPI && typeof latLngByTimeVehAPI.get === "function") {
            timestamp = latLngByTimeVehAPI.get(latLngNeedle);
            if (latLngByTimeFaultAPI && typeof latLngByTimeFaultAPI.updateDB === "function") {
               latLngByTimeFaultAPI.updateDB(timestamp, latLngNeedle);
            }
            if (timestamp) { return timestamp; }
         }
         // Finally try sequential search of Veh Time Index
         if (latLngByTimeIdx && typeof latLngByTimeIdx === "object") {
            for (const time of Object.keys(latLngByTimeIdx)) {
               if (isNaN(time)) { continue; }
               if (latLngNeedle.equals(me.cleanLatLng(latLngByTimeIdx[time]))) {
                  if (latLngByTimeFaultAPI && typeof latLngByTimeFaultAPI.updateDB === "function") {
                     latLngByTimeFaultAPI.updateDB(time, latLngNeedle);
                  }
                  if (latLngByTimeVehAPI && typeof latLngByTimeVehAPI.updateDB === "function") {
                     latLngByTimeVehAPI.updateDB(time, latLngNeedle);
                  }
                  return time;
               }
            }
         }
      }
      return null;
   },

   /**
   * faultInfoByTimestamp() SpartanLync Fault Info at a specific time on Leaflet polyline
   *
   * @param {int} currentSecond - Unix timstamp of fault to search for details
   * @param {array} timelineArr - Array of fault event objects sorted on a timeline of sensor faults and ignition events
   *
   * @return {object}           - Details of AMBER/RED prioritized faults occuring on a specied second
   */
   faultInfoByTimestamp: function (currentSecond, timelineArr) {

      const currentStateObj = {
         faultState: "",
         faultColor: "",
         faultTime: "",
         tooltipDesc: "",
      };

      if (!isNaN(currentSecond) && Array.isArray(timelineArr) && timelineArr.length > 1) {
         timelineArr.sort((a, b) => { return a.latLngTime > b.latLngTime; });
         if (currentSecond < timelineArr[0].latLngTime || currentSecond > timelineArr[timelineArr.length - 1].latLngTime) {
            return currentStateObj; // Search out of bounds of fault timeline
         }
         for (const idx in timelineArr) {
            if (idx >= timelineArr.length - 1) { continue; }
            const evtNow = timelineArr[parseInt(idx)];
            const evtNext = timelineArr[parseInt(idx) + 1];

            if (typeof evtNow.evtState === "undefined") {
               currentStateObj.faultState = currentStateObj.faultColor = currentStateObj.tooltipDesc = "";
            }
            else {
               currentStateObj.faultState = evtNow.evtState;
               currentStateObj.faultColor = evtNow.evtColor;
               currentStateObj.faultTime = evtNow.realTime;
               currentStateObj.tooltipDesc = evtNow.tooltipDesc;
            }

            if ((typeof evtNow.evtState !== "undefined" && currentStateObj.faultState !== evtNow.evtState) ||
               (currentSecond >= evtNow.latLngTime && currentSecond < evtNext.latLngTime)) {
               return currentStateObj;
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
         segmentStatusObj.startLatLng = segmentStatusObj.endLatLng = segmentStatusObj.nearestLatLng = latLngArr[0];
         segmentStatusObj.startIdx = segmentStatusObj.endIdx = segmentStatusObj.nearestIdx = 0;
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
   },

   /**
   * createLatlngSegmentId() Generate a unique Id based on supplied LatLng object and prefix string
   *
   * @param {string} idPrefix - What will prefix the Id
   * @param {object} latlng   - LatLng object supplying Unique Id values
   *
   * @return {string}         - Unique Id for Segment
   */
   createLatlngSegmentId: function (idPrefix, latLng) {
      const me = this;
      const [lat, lng] = me.parseLatLng(latLng);
      if (lat && lng) {
         const id = lat + "" + lng;
         return idPrefix + "_" + id;
      }
      return "";
   },

   /**
   * convertSecondsToHMS() Convert seconds to human readable format
   *
   * @param {int} seconds  - time in seconds to convert
   *
   * @return {string}      - Formatted Time in Human format
   */
   convertSecondsToHMS: function (seconds) {
      const sec = Number(seconds);
      if (sec < 0.01) {
         return "< 0.01 seconds";
      }
      const h = Math.floor(sec / 3600);
      const m = Math.floor(sec % 3600 / 60);
      const s = Math.floor((sec % 3600 % 60) * 100) / 100;

      const hDisplay = h > 0 ? h + (h === 1 ? " hour" : " hours") : "";
      const mDisplay = m > 0 ? m + (m === 1 ? " minute" : " minutes") : "";
      const sDisplay = s > 0 ? s + (s === 1 ? " second" : " seconds") : "";

      return hDisplay + (hDisplay && mDisplay ? ", " : "") + mDisplay + ((hDisplay || mDisplay) && sDisplay ? ", " : "") + sDisplay;
   },

   /**
   * cleanLatLng() Remove speed property from LatLng Object
   *
   * @param {object} latlng - LatLng Object to inspect and clean
   *
   * @return {object}       - Inspected and cleaned LatLng Object
   */
   cleanLatLng: function (latLngObj) {
      if (typeof latLngObj.speed !== "undefined" && Array.isArray(latLngObj.latLng)) {
         const [lat, lng] = latLngObj.latLng;
         return { "lat": lat, "lng": lng };
      }
      else {
         return latLngObj;
      }
   },

   /**
   * parseLatLng() Parse LatLng object into seperate Lap/Lng points
   *
   * @param {object} latlng - LatLng position on polyline, as starting point for timestamp search
   *
   * @return {array}        - Array of format [ Lat, Lng ] with values NULL if error
   */
   parseLatLng: function (latLngObj) {
      const me = this;
      try {
         const loc = L.latLng(me.cleanLatLng(latLngObj));
         if (typeof loc.lat !== "undefined" && typeof loc.lng !== "undefined") {
            return [loc.lat, loc.lng];
         }
      }
      catch (err) {
         console.log("==== splMapFaultUtils.parseLatLng() Error Parsing LatLng: [", latLngObj, "]: Reason:", err);
      }
      return [null, null];
   }
};

const INITlatLngToTimeDB = function (latLngByTimeIdx) {
   //
   // Utiltiy to manage Hash of LatLng points with hashed LatLng object as Key and Timestamp as value
   // Required to speed up sequential multiple searches on large Indexes
   //

   this._db = {};

   this.generateDB = function (latLngByTimeIdx) {
      const me = this;
      if (typeof latLngByTimeIdx === "undefined" || typeof latLngByTimeIdx !== "object") {
         throw new Error("INITlatLngToTimeDB.generateDB() Error: Invalid latLngByTimeIdx object specified [", latLngByTimeIdx, "]");
      }
      for (const time of Object.keys(latLngByTimeIdx)) {
         if (isNaN(time)) { continue; }
         const [lat, lng] = splMapFaultUtils.parseLatLng(splMapFaultUtils.cleanLatLng(latLngByTimeIdx[time]));
         if (lat && lng) {
            const key = lat + "" + lng;
            me._db[key] = time;
         }
      }
   };

   this.updateDB = function (timestamp, latLng) {
      const me = this;
      const [lat, lng] = splMapFaultUtils.parseLatLng(latLng);
      if (lat && lng) {
         const key = lat + "" + lng;
         if (typeof me._db[key] === "undefined") {
            me._db[key] = timestamp;
         }
      }
   };

   this.get = function (latLng) {
      const me = this;
      const [lat, lng] = splMapFaultUtils.parseLatLng(latLng);
      if (lat && lng) {
         const key = lat + "" + lng;
         if (typeof me._db[key] !== "undefined") {
            return me._db[key];
         }
      }
      return null;
   };

   this.clear = function () {
      this._db = {};
   };

   this.configure = function (latLngByTimeIdx) {
      this.generateDB(latLngByTimeIdx);
   };

   this.configure(latLngByTimeIdx);
};

class FaultPolyline {

   constructor(faultId, vehId, vehName, layerGroupName, smoothFactor, weight, color, myLatLngArr) {

      this.id = faultId;
      this.vehId = vehId;
      this.vehName = vehName;

      this.layerGroupName = layerGroupName;
      this.smoothFactor = smoothFactor;
      this.weight = weight;
      this.color = color;

      this.myLatLngArr = myLatLngArr;
      this.latLngByTimeAPI = null;

      this.polyLine = null;

      if (this.isUndefinedOrEmpty(faultId, vehId, vehName, layerGroupName, smoothFactor, weight, color)) {
         throw new Error("Missing or invalid default layerGroupName, smoothFactor, weight, color, faultId, vehId, or vehName");
      }
      if (typeof myLatLngArr === "undefined" || !myLatLngArr.length) {
         throw new Error("No LatLng points to draw on map");
      }
      this.draw();
   }

   isUndefinedOrEmpty(faultId, vehId, vehName, layerGroupName, smoothFactor, weight, color) {
      if (typeof faultId === "undefined" ||
         typeof vehId === "undefined" ||
         typeof vehName === "undefined" ||
         typeof layerGroupName === "undefined" ||
         typeof smoothFactor === "undefined" ||
         typeof weight === "undefined" ||
         typeof color === "undefined" ||
         !vehId || !vehName || !layerGroupName || !smoothFactor || !weight || !color) {
         return true;
      }
      return false;
   }

   enableFaultInfoTooltip(vehDeviceData, splFaultTimelineEvents) {
      const me = this;
      if (me.polyLine) {
         const latLngByTimeVehAPI = splMapFaultMgr.getVehMarker(me.vehId).splMapFaults.historicPathLatLngToTimeDB;

         me.latLngByTimeAPI = new INITlatLngToTimeDB(vehDeviceData);

         me.polyLine.on("mouseover", (evt) => {
            me.polyLine.unbindTooltip();

            const timestamp = splMapFaultUtils.searchLatlngArrForTime(evt.latlng, me.myLatLngArr, me.latLngByTimeAPI, latLngByTimeVehAPI, vehDeviceData);
            const faultInfo = splMapFaultUtils.faultInfoByTimestamp(timestamp, splFaultTimelineEvents);
            const humanTime = faultInfo.faultTime ? "<br />@" + moment.unix(faultInfo.faultTime).format(storage.humanDateTimeFormat) : "";
            const alertHeader = faultInfo.faultState === "RED" ? splmap.tr("alert_header_red") : splmap.tr("alert_header_amber");
            const latLngTxt = me.vehName + (faultInfo.faultState ? `: ${alertHeader}:<br />${faultInfo.tooltipDesc}${humanTime}` : "");

            me.polyLine.bindTooltip(latLngTxt, {
               "className": "spl-map-vehicle-tooltip",
            }).openTooltip(evt.latlng);
         });
      }
   }

   draw() {
      const me = this;
      if (!me.polyLine) {
         me.polyLine = L.polyline(me.myLatLngArr, {
            smoothFactor: me.smoothFactor,
            weight: me.weight,
            color: me.color
         });
         layerModel.addToLayer(me.layerGroupName, me.polyLine);
         me.polyLine.bringToFront();
      }
   }

   addLatLngToFault(newLatLng, vehDeviceData) {
      const me = this;
      try {
         if (newLatLng) {
            const latLngByTimeVehAPI = splMapFaultMgr.getVehMarker(me.vehId).splMapFaults.historicPathLatLngToTimeDB;
            const timestamp = splMapFaultUtils.latlngToTime(newLatLng, me.latLngByTimeAPI, latLngByTimeVehAPI, vehDeviceData);
            me.polyLine.addLatLng(L.latLng(newLatLng));
            if (timestamp) {
               me.latLngByTimeAPI.updateDB(timestamp, newLatLng);
            }
            else {
               console.log("==== FaultPolyline.addLatLngToFault() Error finding timestamp for LatLng [", newLatLng, "] on Vehicle :[", me.vehName, "]");
            }
         }
      }
      catch (err) {
         console.log("==== FaultPolyline.addLatLngToFault() Error Adding [", newLatLng, "]: Reason:", err);
      }
   }

   getId() {
      const me = this;
      return me.id;
   }
}

class FaultTimelineEventMgr {

   constructor() {

      this._isfetchComplete = false;
      this._historicalFaultData = {};
      this._historicalIgnData = {};

      this._isLiveDay = true;
      this._dateTimeObj = null;
      this._dayEndUnix = null;

      this.init();
   }

   init() {
      const me = this;
      me.initEvts();
   }

   initEvts() {
      const me = this;

      // Flush Timetime on Date Change
      splSrv.events.register("onMapDateChangeResetReOpenPopups", (newTimestamp) => me._onDateChange(newTimestamp), false);

      // If not LiveDay, update Historical Ign/Fault data for new vehicles added to Config Panel
      splSrv.events.register("onVehConfigPanelLoad", (vehId) => me._onVehConfigPanelLoadHandler(vehId), false);
   }

   _onDateChange(newTimestamp) {
      const me = this;
      me._dateTimeObj = moment.unix(newTimestamp);
      me._dayEndUnix = me._dateTimeObj.clone().endOf("day").unix();

      me.clear();
      if (!checkSameDay(me._dateTimeObj, moment())) {
         me._isLiveDay = false;
         me.fetchIgnAndFaults();
      }
      else {
         me._isLiveDay = true;
      }
   }

   _locObjArrToHuman(faultLocArr) {
      const me = this;
      const descArr = [];
      if (typeof faultLocArr !== "undefined" && Array.isArray(faultLocArr) && faultLocArr.length) {
         faultLocArr.forEach(locObj => {
            descArr.push(
               splmap.tr("alert_desc_axle") + " " + locObj.axle + " " +
               splmap.tr("alert_desc_tire") + " " + locObj.tire + " - " +
               me._locDescTr(splSrv.vehCompDb.names[locObj.vehComp])
            );
         });
      }
      return descArr.join(" / ");
   }

   _locDescTr(rawVal) {
      let val = rawVal.toString().trim();
      if (val) {
         val = val.replace("Axle", splmap.tr("alert_desc_axle"));
         val = val.replace("Tire", splmap.tr("alert_desc_tire"));
         val = val.replace("Tractor", splmap.tr("alert_desc_tractor"));
         val = val.replace("Trailer", splmap.tr("alert_desc_trailer"));
         val = val.replace("Dolly", splmap.tr("alert_desc_dolly"));
      }
      return val;
   }

   _onVehConfigPanelLoadHandler(vehId) {
      const me = this;

      const busyPollingFrequency = 1000; // If Busy, poll every 1 second(s) for fetching resource to become free
      let busyPollingHandlerId = null;

      if (!me._isLiveDay) {
         if (me._isfetchComplete) {
            me.fetchIgnAndFaults(vehId);
         }
         // Busy fetching other vehicles, must wait and poll till free
         else {
            if (!busyPollingHandlerId) {
               busyPollingHandlerId = setInterval(() => {
                  if (me._isfetchComplete) {
                     clearInterval(busyPollingHandlerId);
                     busyPollingHandlerId = null;
                     me.fetchIgnAndFaults(vehId);
                  }
               }, busyPollingFrequency);
            }
         }
      }
   }

   createTimelineFromFaultIgnData(vehId, faultData, ignData) {
      const me = this;
      const timeline = [];

      // Create timeline array from combination of either/both Fault/Ignition data
      if (faultData || ignData) {
         if (faultData && Array.isArray(faultData) && faultData.length) {
            for (const faultObj of faultData) {
               if (faultObj && typeof faultObj.alert !== "undefined") {
                  const faultLocDesc = faultObj.loc ? me._locObjArrToHuman(faultObj.loc) : "";
                  timeline.push({
                     latLngTime: parseInt(faultObj.time),
                     realTime: parseInt(faultObj.time),
                     evtType: "fault",
                     evtState: faultObj.alert.color,
                     evtColor: faultObj.alert.color === "RED" ? colorHexCodes.spartanLyncRed : colorHexCodes.spartanLyncAmber,
                     tooltipDesc: splmap.tr(faultObj.alert.trId) + (faultLocDesc ? ` ( ${faultLocDesc} )` : "")
                  });
               }
            }
         }
         if (ignData && ignData.byTime && typeof ignData.byTime === "object") {
            for (const time of Object.keys(ignData.byTime)) {
               const ignStatus = ignData.byTime[time];
               timeline.push({
                  latLngTime: parseInt(time),
                  realTime: parseInt(time),
                  evtType: ignStatus === "on" ? "IGOn" : "IGOff"
               });
            }
         }
      }

      // Sort timeline
      timeline.sort((a, b) => a.latLngTime.toString().localeCompare(b.latLngTime.toString(), undefined, { numeric: true, sensitivity: "base" }));
      console.log("==== FaultTimelineEventMgr.getTimelineEvents(", vehId, ") timeline =", timeline);//DEBUG

      return timeline;
   }

   getTimelineEvents(vehId) {
      const me = this;
      return new Promise(function (resolve, reject) {

         if (vehId === demoVeh.data.deviceID) { resolve(demoVeh.data._demoSplFaultTimelineEvents); } // DEBUG - For Demo

         // Fetch current fault/ignition data from Vehicle cache
         if (me._isLiveDay) {

            const faultData = splSrv.cache.getFaultData(vehId);
            const ignData = splSrv.cache.getIgnData(vehId);

            // Wait for fault/ignition data, if none available.
            // AND NOT "faultDataNotFound" condition (no Fault Data, only Ign data)
            if (faultData === null && ignData === null) {
               splSrv.events.register("onFaultAlert", (faultVehId) => {
                  if (faultVehId === vehId) {
                     resolve(me.createTimelineFromFaultIgnData(vehId, splSrv.cache.getFaultData(vehId), splSrv.cache.getIgnData(vehId)));
                  }
               });
               return;
            }

            // Respond with what we got
            resolve(me.createTimelineFromFaultIgnData(vehId, faultData, ignData));
         }

         // Fetch historic fault/ignition data from Geotab APIs
         else {
            if (me._isfetchComplete) {
               resolve(me.createTimelineFromFaultIgnData(vehId, me._historicalFaultData[vehId], me._historicalIgnData[vehId]));
            }
            else {
               splSrv.events.register("onFaultTimelineEventMgrFetchComplete", (vehIdCompleted, opSuccessful) => {
                  // Complete Operation
                  if (vehIdCompleted === vehId) {
                     if (opSuccessful) {
                        resolve(me.createTimelineFromFaultIgnData(vehIdCompleted, me._historicalFaultData[vehIdCompleted], me._historicalIgnData[vehIdCompleted]));
                     }
                     else {
                        reject();
                     }
                  }
               }, true, vehId);
            }
         }
      });
   }

   fetchIgnAndFaults(onlyVehId) {
      const me = this;
      const vehIds = typeof onlyVehId !== "undefined" && onlyVehId ? [onlyVehId] : Object.values(deviceSearch.selectedIDS).map(vehObj => { return vehObj.id; });
      const toDateOverride = me._dayEndUnix;

      if (!me._isLiveDay) {

         me._isfetchComplete = false;

         // Fetch some data
         (async () => {
            const promises = vehIds.map(async (vehId) => {
               await (() => {
                  return new Promise((resolve, reject) => {

                     const aSyncGoLib = INITGeotabTpmsTemptracLib(
                        apiConfig.api,
                        splSrv.sensorSearchRetryRangeInDays,
                        splSrv.sensorSearchTimeRangeForRepeatSearchesInSeconds,
                        [1], // Only use a search range of 1 day for faults & ignition data
                        splSrv.faultSearchTimeRangeForRepeatSearchesInSeconds
                     );
                     aSyncGoLib.getFaults(vehId, function (faults, vehIgnitionInfo) {

                        if (faults) {

                           // Update Ign/Fault data
                           if (vehIgnitionInfo && (vehIgnitionInfo["on-latest"] || vehIgnitionInfo["off-latest"])) {
                              me._historicalFaultData[vehId] = faults;
                              me._historicalIgnData[vehId] = vehIgnitionInfo;
                              resolve();
                           }
                           // Report on Ignition data missing
                           else {
                              me._historicalFaultData[vehId] = faults;
                              reject([vehId, "Ignition data not found"]);
                           }
                           return;
                        }
                        else {

                           // Update Ignition data, but report Fault data missing
                           if (vehIgnitionInfo && (vehIgnitionInfo["on-latest"] || vehIgnitionInfo["off-latest"])) {
                              me._historicalIgnData[vehId] = vehIgnitionInfo;
                              reject([vehId, "Fault data not found"]);
                           }
                           // Report on Fault and Ignition data missing
                           else {
                              reject([vehId, "Fault + Ignition data not found"]);
                           }
                           return;
                        }

                     }, true, toDateOverride);

                     return;
                  });
               })();

               splSrv.events.queueExec("onFaultTimelineEventMgrFetchComplete", vehId, true);
            });

            await Promise.allSettled(promises).then(resultArr => resultArr.map((result) => {
               if (result.status === "rejected") {
                  const [failedVehId, reason] = result.reason;
                  if (failedVehId) {
                     const vehName = deviceSearch.selectedIDS[failedVehId] !== "undefined" ? deviceSearch.selectedIDS[failedVehId].name + ` (${failedVehId})` : failedVehId;
                     console.log("---- FaultTimelineEventMgr() Error fetching historical data from Vehicle [", vehName, "]:", reason);
                     splSrv.events.queueExec("onFaultTimelineEventMgrFetchComplete", failedVehId, false);
                  }
               }
            }));

            // Purge any leftover Registrations (By this point they are failed)
            me._isfetchComplete = true;
            splSrv.events.queueClear("onFaultTimelineEventMgrFetchComplete");
         })();
      }
   }

   clear() {
      const me = this;
      me._historicalFaultData = {};
      me._historicalIgnData = {};
   }
}
