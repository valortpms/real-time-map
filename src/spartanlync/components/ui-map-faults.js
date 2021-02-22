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
import { getTempTracFaultsAsync, updateTempTracFaultStatusUsingIgnData } from "../services/api/temptrac-tpms/utils";
import {
   filterMarkerButton,
   getStrongText,
   escapeQuotes,
   getDefaultPopupText,
   closeAllTooltips
} from "../../components/map/popups/popup-helpers";

export function initSplMapFaults() {

   // Create Faults Timeline Event Mgr
   splMapFaultMgr.faults = new FaultTimelineEventMgr();

   // Available after SplServices init
   splSrv.events.register("onLoadSplServices", () => {

      splMapFaultMgr.initEventHandlers();

      // DEMO INIT - PLEASE DELETE ON PROD - DEBUG
      // DomButtonIds: speedLabel dateInputLabel timeRangeStartLabel currentTimeLabel
      //
      if (!L.Browser.mobile) { // Disabled for Mobile Browsers
         document.getElementById("speedLabel").addEventListener("click", debugTools.utils.switchDebugMode.bind(debugTools));
         document.getElementById("dateInputLabel").addEventListener("click", debugTools.clear.bind(debugTools));
      }
   });
}

//DEBUG
const debugTools = {

   _mapGroupLayer: "splDemoLayer",        // Demo polyline layers are drawn on this layerGroup

   clear: function () {
      const me = this;
      layerModel.clearLayersInGroup(me._mapGroupLayer);
   },

   utils: {

      debugTracingLevel: 0,

      switchDebugMode: function () {
         debugTools.utils.debugTracingLevel = debugTools.utils.debugTracingLevel + 1 > 3 ? 0 : debugTools.utils.debugTracingLevel + 1;
         console.log("============ DEBUG TRACING", !debugTools.utils.debugTracingLevel ? "DISABLED" : "@ LEVEL " + debugTools.utils.debugTracingLevel, "============");
      }
   }
};

export const splMapFaultMgr = {

   faults: null, // Instance of FaultTimelineEventMgr Class

   _faultsLayerGroupName: "",
   _faultsSegmentNamePrefix: "fSeg-",

   _defaultPolylineWeight: 3,
   _defaultCircleMarkerRadius: 2,
   _defaultPolylineSmoothFactor: 1,

   _maxDiffInYAxisFor0DegreeLineAngle: 2,
   _maxDiffInYAxisFor90DegreeLineAngle: 70,

   _vehMarkers: {},
   _vehLatLngTimestampCache: {},

   _init: function (vehMarker, latLngByTimeIdx, timestamps) {
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
            latLngTimestampIdx: null,
            historicPathLatLngToTimeDB: new INITlatLngToTimeDB(latLngByTimeIdx)
         };
         me._importLatLngTimestampFromCache(vehId, vehMarker);
         me._vehMarkers[vehId] = vehMarker;
      }

      // Update Timestamps DB
      if (Array.isArray(timestamps) && timestamps.length) {
         vehMarker.splMapFaults.latLngTimestampIdx = timestamps;
      }
      else {
         if (!Array.isArray(vehMarker.splMapFaults.latLngTimestampIdx)) {
            vehMarker.splMapFaults.latLngTimestampIdx = [];
         }
         vehMarker.splMapFaults.latLngTimestampIdx.push(timestamps);
      }

      return vehMarker.splMapFaults;
   },

   _importLatLngTimestampFromCache: function (vehId, vehMarker) {
      const me = this;
      if (typeof me._vehLatLngTimestampCache[vehId] !== "undefined" && vehMarker && vehMarker.splMapFaults && vehMarker.splMapFaults.historicPathLatLngToTimeDB) {
         for (const timestamp of Object.keys(me._vehLatLngTimestampCache[vehId])) {
            const latLng = me._vehLatLngTimestampCache[vehId][timestamp];
            vehMarker.splMapFaults.historicPathLatLngToTimeDB.updateDB(timestamp, latLng);
         }
      }
   },

   _getVehName: function (vehId) {
      return typeof deviceSearch.selectedIDS[vehId] !== "undefined" ? deviceSearch.selectedIDS[vehId].name : vehId.toUpperCase();
   },

   _createPolyline: function (faultId, vehId, startIdx, endIdx, color, vehPathLatLngArr, vehPathLatLngTimestampArr, vehDeviceData, splVehMapFaultsDB, splFaultTimelineEvents) {
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
            me._defaultCircleMarkerRadius,
            color,
            vehPathLatLngArr.slice(startIdx, endIdx + 1),
            vehPathLatLngTimestampArr
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

         if (debugTools.utils.debugTracingLevel === 3) { console.log("(", vehId, ")==== t =", timestamp, " LatLng =", vehPathLatLngArr[0], " faultInfo =", faultInfo); }//DEBUG

         if (faultInfo && faultInfo.faultState) {
            sInfo = faultInfo;
            const segmentId = splMapFaultUtils.createLatlngSegmentId(me._faultsSegmentNamePrefix + vehId, vehPathLatLngArr[sStart]);
            sInfo.id = segmentId ? segmentId : me._faultsSegmentNamePrefix + vehId + "-" + sStart;
            sInfo.startIdx = 0;
            sInfo.endIdx = 0;
            sInfo.pointCount = 1;
            delete sInfo.tooltipDesc;
            segmentsArr.push(sInfo);
            if (debugTools.utils.debugTracingLevel === 3) { console.log("(", vehId, ")==== ================================== CREATE SEGMENT"); }//DEBUG
         }
         return segmentsArr;
      }

      // Search multi-point paths
      for (const idx in vehPathLatLngArr) {
         const vehPathLatLng = vehPathLatLngArr[idx];
         const timestamp = splMapFaultUtils.latlngToTime(vehPathLatLng, null, latLngByTimeVehAPI, latLngByTimeIdx);
         const faultInfo = splMapFaultUtils.faultInfoByTimestamp(timestamp, splFaultTimelineEvents);

         if (debugTools.utils.debugTracingLevel === 3) { console.log("(", vehId, ")==== idx =", idx, " t =", timestamp, " LatLng =", vehPathLatLng); }//DEBUG

         if (!faultInfo) { return segmentsArr; }
         if (faultInfo.faultState) {
            if (sStart === sEnd) {
               sInfo = faultInfo;
               sStart = idx;
               sEnd = sStart + 1;
               if (debugTools.utils.debugTracingLevel === 3) { console.log("(", vehId, ")==== idx =", idx, " ================================== START SEGMENT-1"); }//DEBUG
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
                  if (debugTools.utils.debugTracingLevel === 3) { console.log("(", vehId, ")==== idx =", idx, " ================================== CREATE SEGMENT-1"); }//DEBUG

                  sInfo = faultInfo;
                  sStart = idx;
                  sEnd = sStart + 1;
                  if (debugTools.utils.debugTracingLevel === 3) { console.log("(", vehId, ")==== idx =", idx, " ================================== START SEGMENT-2"); }//DEBUG
               }
               else {
                  sEnd = idx;
                  if (debugTools.utils.debugTracingLevel === 3) { console.log("(", vehId, ")==== idx =", idx, " ================================== UPDATE SEGMENT END"); }//DEBUG
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
               if (debugTools.utils.debugTracingLevel === 3) { console.log("(", vehId, ")==== idx =", idx, " ================================== CREATE SEGMENT-2"); }//DEBUG
            }
         }
         if (debugTools.utils.debugTracingLevel === 3) { console.log("(", vehId, ")==== idx =", idx, " f =", faultInfo); }//DEBUG
      }
      if (sStart !== sEnd) {
         const segmentId = splMapFaultUtils.createLatlngSegmentId(me._faultsSegmentNamePrefix + vehId, vehPathLatLngArr[sStart]);
         sInfo.id = segmentId ? segmentId : me._faultsSegmentNamePrefix + vehId + "-" + sStart;
         sInfo.startIdx = parseInt(sStart);
         sInfo.endIdx = parseInt(vehPathLatLngArr.length - 1);
         sInfo.pointCount = sInfo.endIdx - sInfo.startIdx + 1;
         delete sInfo.tooltipDesc;
         segmentsArr.push(sInfo);
         if (debugTools.utils.debugTracingLevel === 3) { console.log("(", vehId, ")====================================== CREATE SEGMENT-3"); }//DEBUG
      }

      return segmentsArr;
   },

   initEventHandlers: function () {
      const me = this;

      // Init CreateOrUpdate Faults Event Handler
      splSrv.events.register("onHistoricPathCreatedOrUpdated", (vehId, vehPathLatLngArr, timestamps) => {
         const vehMarker = typeof markerList[vehId] !== "undefined" ? markerList[vehId] : null;
         if (vehPathLatLngArr.length && vehMarker) {
            // Wait for Faults to Load
            if (debugTools.utils.debugTracingLevel === 3) { console.log("============ onHistoricPathCreatedOrUpdated(", vehId, ") INVOKED vehPathLatLngArr =", vehPathLatLngArr, " timestamps =", timestamps); }//DEBUG
            splMapFaultMgr.faults.getTimelineEvents(vehId).then(splFaultTimelineEvents => {
               splMapFaultMgr.setLatLngFaults(vehId, vehPathLatLngArr, vehMarker, vehMarker.deviceData, splFaultTimelineEvents, timestamps);
            }).catch(reason => console.log("---- onHistoricPathCreatedOrUpdated ERROR:", reason));
         }
      }, false);

      // Catch Event for storing mising Interpolated LatLng timestamps into LOCAL Vehicle DB
      splSrv.events.register("onAddingNewVehicleLatLngTimestamp", (vehId, timestamp, latLng) => me.addLatLngTimestampToVeh(vehId, timestamp, latLng), false);

      // Fault Popup Closure Event Handler
      splSrv.events.register("onCloseAllPopupsForVeh", (vehId) => me.closeAllPopupsFor(vehId), false);

      // Init Cleanup Event Handler
      splSrv.events.register("onPreDateTimeChange", () => me.clear(), false);
   },

   setLatLngFaults: function (vehId, vehPathLatLngArr, vehMarker, vehDeviceData, splFaultTimelineEvents, timestamps) {
      const me = this;
      const splVehMapFaultsDB = me._init(vehMarker, vehDeviceData, timestamps);
      if (!splVehMapFaultsDB || !vehPathLatLngArr.length) { return; }

      // Search veh Path for fault segments
      for (const newFaultSegmentInfo of me._searchVehPathForFaultSegments(vehId, vehPathLatLngArr, vehDeviceData, splFaultTimelineEvents)) {
         let faultSegment;
         const vehPathLatLngTimestampArr = Array.isArray(splVehMapFaultsDB.latLngTimestampIdx) && splVehMapFaultsDB.latLngTimestampIdx.length ?
            splVehMapFaultsDB.latLngTimestampIdx.slice(newFaultSegmentInfo.startIdx, newFaultSegmentInfo.endIdx + 1) : [];

         // Create Segment
         if (typeof splVehMapFaultsDB.faultSegments[newFaultSegmentInfo.id] === "undefined") {
            me._createPolyline(
               newFaultSegmentInfo.id, vehId,
               newFaultSegmentInfo.startIdx, newFaultSegmentInfo.endIdx,
               newFaultSegmentInfo.faultColor,
               vehPathLatLngArr, vehPathLatLngTimestampArr,
               vehDeviceData,
               splVehMapFaultsDB, splFaultTimelineEvents
            );
            faultSegment = splVehMapFaultsDB.faultSegments[newFaultSegmentInfo.id];
            if (faultSegment) {
               faultSegment.info = newFaultSegmentInfo;
            }
            if (debugTools.utils.debugTracingLevel === 1) { console.log("==== splMapFaultMgr.setLatLngFaults(", vehId, ") CREATE =", faultSegment); } // DEBUG
         }

         // Update Segment
         else {

            // Update PolyLine
            faultSegment = splVehMapFaultsDB.faultSegments[newFaultSegmentInfo.id];
            if (newFaultSegmentInfo.pointCount > faultSegment.info.pointCount) {
               const numNewPoints = newFaultSegmentInfo.pointCount - faultSegment.info.pointCount;
               let i = 1;
               if (debugTools.utils.debugTracingLevel === 1) { console.log("==== splMapFaultMgr.setLatLngFaults(", vehId, ") UPDATE =", faultSegment, " splVehMapFaultsDB =", splVehMapFaultsDB); } // DEBUG
               while (i <= numNewPoints) {
                  const newPointIdx = faultSegment.info.endIdx + i;
                  const newLatLng = vehPathLatLngArr[newPointIdx];
                  const newLatLngTimestamp = typeof splVehMapFaultsDB.latLngTimestampIdx[newPointIdx] !== "undefined" ? splVehMapFaultsDB.latLngTimestampIdx[newPointIdx] : null;
                  faultSegment.polyline.addLatLngToFault(newLatLng, newLatLngTimestamp, vehDeviceData);
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

   addLatLngTimestampToVeh: function (vehId, timestamp, latLng) {
      const me = this;
      const latLngByTimeVehAPI = typeof me._vehMarkers[vehId] !== "undefined" ? me._vehMarkers[vehId].splMapFaults.historicPathLatLngToTimeDB : null;

      // Add to vehMarker Historical Path Db
      if (latLngByTimeVehAPI) {
         latLngByTimeVehAPI.updateDB(timestamp, latLng);
      }
      // Alternatively add to vehLatLngTimestampCache if vehMarker not yet created
      else {
         if (typeof me._vehLatLngTimestampCache[vehId] === "undefined") {
            me._vehLatLngTimestampCache[vehId] = {};
         }
         me._vehLatLngTimestampCache[vehId][timestamp] = latLng;
      }
   },

   closeAllPopupsFor: function (vehId) {
      const me = this;
      for (const vehMarker of Object.values(me._vehMarkers)) {
         if (typeof vehMarker !== "undefined" && typeof vehMarker.splMapFaults !== "undefined" &&
            vehMarker && vehMarker.splMapFaults && vehMarker.splMapFaults.vehFaultsPopupObj) {
            const vehFaultsPopupObj = vehMarker.splMapFaults.vehFaultsPopupObj;
            if (vehId === vehMarker.deviceID) {
               vehFaultsPopupObj.closePopup();
            }
         }
      }
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

         // Try Local PolyLine DB
         if (latLngByTimeFaultAPI && typeof latLngByTimeFaultAPI.get === "function") {
            timestamp = latLngByTimeFaultAPI.get(latLngNeedle);
            if (timestamp) { return timestamp; }
         }
         // Try Veh Historical Path DB
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
               const latLngHaystack = me.cleanLatLng(latLngByTimeIdx[time]);
               if (latLngNeedle.equals(latLngHaystack)) {
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
   * faultInfoByTimestamp() SpartanLync Fault Info at a specific time on Timeline Array
   *
   * @param {int} currentSecond - Unix timstamp of fault to search for details
   * @param {array} timelineArr - Array of fault event objects sorted on a timeline of sensor faults and ignition events
   *
   * @return {object}           - Details of AMBER/RED prioritized faults occuring on a specied second
   */
   // eslint-disable-next-line complexity
   faultInfoByTimestamp: function (currentSecond, timelineArr) {
      const me = this;

      const currentStateObj = {
         faultState: "",
         faultColor: "",
         faultTime: {
            temptrac: "",
            tpms: ""
         },
         tooltipDesc: {
            temptrac: "",
            tpms: ""
         },
      };

      if (currentSecond && Array.isArray(timelineArr) && timelineArr.length > 1) {
         timelineArr.sort((a, b) => { return a.latLngTime > b.latLngTime; });

         // Search out of bounds of fault timeline
         if (currentSecond < timelineArr[0].latLngTime || currentSecond > timelineArr[timelineArr.length - 1].latLngTime) {

            // If search is after end of timeline, return last fault if exists
            if (currentSecond > timelineArr[timelineArr.length - 1].latLngTime) {

               // Scan backwards till last tpms/temptrac record(s) or FaultOff record (NULL)
               const lastTpmsEvt = me.findLastTimelineEvent(false, timelineArr);
               const lastTempTracEvt = me.findLastTimelineEvent(true, timelineArr);

               if (lastTpmsEvt && lastTempTracEvt) {
                  if (lastTpmsEvt.evtState === lastTempTracEvt.evtState) {
                     currentStateObj.faultState = lastTpmsEvt.evtState;
                     currentStateObj.faultColor = lastTpmsEvt.evtColor;

                     currentStateObj.faultTime.temptrac = lastTempTracEvt.realTime;
                     currentStateObj.faultTime.tpms = lastTpmsEvt.realTime;

                     currentStateObj.tooltipDesc.temptrac = lastTempTracEvt.tooltipDesc;
                     currentStateObj.tooltipDesc.tpms = lastTpmsEvt.tooltipDesc;
                  }
                  else {
                     const redStateEvt = lastTempTracEvt.faultState === "RED" ? lastTempTracEvt : lastTpmsEvt;
                     currentStateObj.faultState = redStateEvt.evtState;
                     currentStateObj.faultColor = redStateEvt.evtColor;

                     currentStateObj.tooltipDesc.temptrac = redStateEvt.tooltipDesc;
                     currentStateObj.faultTime.temptrac = redStateEvt.realTime;
                     currentStateObj.faultTime.tpms = currentStateObj.tooltipDesc.tpms = "";
                  }
               }
               else if (lastTpmsEvt) {
                  currentStateObj.faultState = lastTpmsEvt.evtState;
                  currentStateObj.faultColor = lastTpmsEvt.evtColor;

                  currentStateObj.faultTime.temptrac = "";
                  currentStateObj.faultTime.tpms = lastTpmsEvt.realTime;

                  currentStateObj.tooltipDesc.temptrac = "";
                  currentStateObj.tooltipDesc.tpms = lastTpmsEvt.tooltipDesc;
               }
               else if (lastTempTracEvt) {
                  currentStateObj.faultState = lastTempTracEvt.evtState;
                  currentStateObj.faultColor = lastTempTracEvt.evtColor;

                  currentStateObj.faultTime.temptrac = lastTempTracEvt.realTime;
                  currentStateObj.faultTime.tpms = "";

                  currentStateObj.tooltipDesc.temptrac = lastTempTracEvt.tooltipDesc;
                  currentStateObj.tooltipDesc.tpms = "";
               }
            }
            return currentStateObj;
         }
         for (const idx in timelineArr) {
            if (idx >= timelineArr.length - 1) { continue; }
            const evtNow = timelineArr[parseInt(idx)];
            const evtNext = timelineArr[parseInt(idx) + 1];

            if (typeof evtNow.evtState === "undefined") {
               currentStateObj.tooltipDesc.temptrac = evtNow.evtType.indexOf("temptrac") > -1 ? "" : currentStateObj.tooltipDesc.temptrac;
               currentStateObj.tooltipDesc.tpms = evtNow.evtType.indexOf("temptrac") > -1 ? currentStateObj.tooltipDesc.tpms : "";

               currentStateObj.faultTime.temptrac = evtNow.evtType.indexOf("temptrac") > -1 ? "" : currentStateObj.faultTime.temptrac;
               currentStateObj.faultTime.tpms = evtNow.evtType.indexOf("temptrac") > -1 ? currentStateObj.faultTime.tpms : "";

               if (currentStateObj.tooltipDesc.temptrac === "" && currentStateObj.tooltipDesc.tpms === "") {
                  currentStateObj.faultState = currentStateObj.faultColor = "";
               }
            }
            else {
               currentStateObj.faultState = evtNow.evtState;
               currentStateObj.faultColor = evtNow.evtColor;

               currentStateObj.faultTime.temptrac = evtNow.evtType === "temptracFault" ? evtNow.realTime : currentStateObj.faultTime.temptrac;
               currentStateObj.faultTime.tpms = evtNow.evtType === "tpmsFault" ? evtNow.realTime : currentStateObj.faultTime.tpms;

               currentStateObj.tooltipDesc.temptrac = evtNow.evtType === "temptracFault" ? evtNow.tooltipDesc : currentStateObj.tooltipDesc.temptrac;
               currentStateObj.tooltipDesc.tpms = evtNow.evtType === "tpmsFault" ? evtNow.tooltipDesc : currentStateObj.tooltipDesc.tpms;
            }

            if ((typeof evtNow.evtState !== "undefined" && currentStateObj.faultState !== evtNow.evtState) ||
               (currentSecond >= evtNow.latLngTime && currentSecond < evtNext.latLngTime)) {
               return currentStateObj;
            }
         }
      }
      return currentStateObj;
   },

   /**
   * findLastTimelineEvent() Fetch last TempTrac/TPMS record in timeline Array
   *
   * @param {boolean} searchForTemptrac - TRUE if searching for TempTrac record, FALSE for TPMS
   * @param {array} timelineArr         - Array of fault event objects sorted on a timeline of sensor faults and ignition events
   *
   * @return {object}                   - Last record found in Array, after either Fault OFF or Ignition Event (NULL if none found)
   */
   findLastTimelineEvent: function (searchForTemptrac, timelineArr) {
      let evtFound = null;
      for (let i = timelineArr.length - 1; i >= 0; i--) {
         const evt = timelineArr[i];
         if (searchForTemptrac && (typeof evt.evtState === "undefined" || (evtFound && evtFound.evtType.indexOf("temptrac") > -1))) {
            return evtFound;
         }
         if (!searchForTemptrac && ((typeof evt.evtState === "undefined" && evt.evtType.indexOf("temptrac") === -1) ||
            (evtFound && evtFound.evtType.indexOf("temptrac") === -1))) {
            return evtFound;
         }
         evtFound = searchForTemptrac && evt.evtType.indexOf("temptrac") > -1 ? evt : evtFound; // TEMPTRAC
         evtFound = !searchForTemptrac && evt.evtType.indexOf("temptrac") === -1 ? evt : evtFound; // TPMS
      }
      return evtFound;
   },

   /**
   * findLatLngSegment() Search for nearest bounding LatLng points to a target LatLng position within Leaflet polyline Array
   *
   * @param {object} latlng           - LatLng position to search for nearest polyline point
   * @param {array} latLngArr         - Array of Leaflet LatLng points assembling polyline
   *
   * @return {object}                 - Details of the segment points boundary of a specied LatLng position on Leaflet polyline Array
   */
   findLatLngSegment: function (latlng, latLngArr) {
      const me = this;
      const segmentStatusObj = {
         startLatLng: {},
         endLatLng: {},
         nearestLatLng: {},
         startIdx: null,
         endIdx: null,
         nearestIdx: null
      };

      if (!latLngArr.length) { return segmentStatusObj; }
      if (latLngArr.length === 1) {
         segmentStatusObj.startLatLng = segmentStatusObj.endLatLng = segmentStatusObj.nearestLatLng = latLngArr[0];
         segmentStatusObj.startIdx = segmentStatusObj.endIdx = segmentStatusObj.nearestIdx = 0;
         return segmentStatusObj;
      }

      if (debugTools.utils.debugTracingLevel === 2) { console.log("================================"); } //DEBUG

      // Search from FIRST point to LAST in Array
      let i = 0;
      while (latLngArr[i + 1]) {
         const isLatLngInSegment = me.isPointIntersectOnLine(
            storage.map.latLngToLayerPoint(L.latLng(latlng)),
            storage.map.latLngToLayerPoint(L.latLng(latLngArr[i])),
            storage.map.latLngToLayerPoint(L.latLng(latLngArr[i + 1]))
         );
         if (isLatLngInSegment) {
            const distanceToA = L.latLng(latLngArr[i]).distanceTo(latlng);
            const distanceToB = L.latLng(latLngArr[i + 1]).distanceTo(latlng);

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
            return [loc.lat.toString().match(/^-?\d+(?:\.\d{0,7})?/)[0], loc.lng.toString().match(/^-?\d+(?:\.\d{0,7})?/)[0]]; // If longer, truncate to 7 decimal places
         }
      }
      catch (err) {
         console.log("==== splMapFaultUtils.parseLatLng() Error Parsing LatLng: [", latLngObj, "]: Reason:", err);
      }
      return [null, null];
   },

   /**
   * isPointIntersectOnLine() Plots all cooordinates between two points looking for intersection with target point
   *
   * @param {object} targetPoint    - Target point to search for intersection on Line
   * @param {object} LineBeginPoint - One end of Segment
   * @param {object} LineEndPoint   - Other end of Segment
   *
   * @return {boolean}              - TRUE if target intersects on Line Segment
   */
   isPointIntersectOnLine: function (targetPoint, LineBeginPoint, LineEndPoint) {
      const me = this;
      const waypoints = me.getPointsOnLine(LineBeginPoint, LineEndPoint);
      for (const idx in waypoints) {
         const haystackPoint = waypoints[idx];
         const getLineAngle = (originX, originY, targetX, targetY) => {
            const dx = originX - targetX;
            const dy = originY - targetY;

            // let theta = Math.atan2(dy, dx);  // [0, Ⲡ] then [-Ⲡ, 0]; clockwise; 0° = west
            // let theta = Math.atan2(-dy, dx); // [0, Ⲡ] then [-Ⲡ, 0]; anticlockwise; 0° = west
            // let theta = Math.atan2(dy, -dx); // [0, Ⲡ] then [-Ⲡ, 0]; anticlockwise; 0° = east
            let theta = Math.atan2(-dy, -dx);   // [0, Ⲡ] then [-Ⲡ, 0]; clockwise; 0° = east

            theta *= 180 / Math.PI;             // [0, 180] then [-180, 0]; clockwise; 0° = east
            //if (theta < 0) { theta += 360; }  // (0 - 360); clockwise; 0° = east
            if (theta < 0) { theta += 180; }    // (0 - 90); clockwise;
            if (theta > 90) { theta -= 180; }   // (90 - 0); clockwise;

            return Math.abs(Math.round(theta));
         };
         const calcMaxDifference = (angle) => {
            // position will be between 0 and 90 degrees
            const minp = 0;
            const maxp = 90;

            // The needs to be between 2 and 35 difference in tolerance
            const minv = Math.log(splMapFaultMgr._maxDiffInYAxisFor0DegreeLineAngle);
            const maxv = Math.log(splMapFaultMgr._maxDiffInYAxisFor90DegreeLineAngle);

            // calculate adjustment factor
            const scale = (maxv - minv) / (maxp - minp);

            return Math.round(Math.exp(minv + scale * (angle - minp)));
         };
         const lineAngle = getLineAngle(LineBeginPoint.x, LineBeginPoint.y, LineEndPoint.x, LineEndPoint.y);
         const maxYDiff = calcMaxDifference(lineAngle);
         const yDiff = Math.abs(targetPoint.y - haystackPoint.y);

         // DEBUG
         if (targetPoint.x === haystackPoint.x && debugTools.utils.debugTracingLevel === 2) {
            console.log("==== [", targetPoint.x, ",", targetPoint.y, "] == [", haystackPoint.x, ",", haystackPoint.y, "] ([" + LineBeginPoint.x + "," + LineBeginPoint.y + "]x[" + LineEndPoint.x + "," + LineEndPoint.y + "]) Angle =", lineAngle, "yDiff =", yDiff, "Limit =", maxYDiff); //DEBUG
         }

         if (targetPoint.x === haystackPoint.x && yDiff <= maxYDiff) {
            return true;
         }
      }
      return false;
   },

   /**
   * getPointsOnLine() Returns all point coordinates between two ends of a Line
   *
   * @param {object} pointA - One end of Line
   * @param {object} pointB - Other end of Line
   *
   * @return {array}        - Array of Points
   */
   getPointsOnLine: function (pointA, pointB) {
      const startPoint = pointA.x < pointB.x ? [pointA.x, pointA.y] : [pointB.x, pointB.y];
      const endPoint = pointA.x < pointB.x ? [pointB.x, pointB.y] : [pointA.x, pointA.y];
      const pointsArr = [];

      const slope = ((a, b) => {
         if (a[0] === b[0]) {
            return null;
         }
         return (b[1] - a[1]) / (b[0] - a[0]);
      })(startPoint, endPoint);

      const intercept = ((point, slope) => {
         if (slope === null) {
            return point[0]; // vertical line
         }
         return point[1] - slope * point[0];
      })(startPoint, slope);

      for (let x = startPoint[0]; x <= endPoint[0]; x++) {
         const y = slope * x + intercept;
         pointsArr.push({ x: x, y: Math.round(y) });
      }
      return (pointsArr);
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

   // eslint-disable-next-line complexity
   constructor(faultId, vehId, vehName, layerGroupName, smoothFactor, weight, radius, color, myLatLngArr, myLatLngTimestampArr) {

      this.id = faultId;
      this.vehId = vehId;
      this.vehName = vehName;

      this.layerGroupName = layerGroupName;
      this.smoothFactor = smoothFactor;
      this.weight = weight;
      this.radius = radius;
      this.color = color;

      this.vehMarker = null;
      this.vehDeviceData = null;
      this.latLngByTimeAPI = null;
      this.splFaultTimelineEvents = null;

      this.polyLine = null;
      this.circleMarkers = [];

      this.enablePopupOn = this.enablePopupOn.bind(this);
      this.enableToolipOn = this.enableToolipOn.bind(this);

      if (typeof faultId === "undefined" ||
         typeof vehId === "undefined" ||
         typeof vehName === "undefined" ||
         typeof layerGroupName === "undefined" ||
         typeof smoothFactor === "undefined" ||
         typeof weight === "undefined" ||
         typeof radius === "undefined" ||
         typeof color === "undefined" ||
         !vehId || !vehName || !layerGroupName || !smoothFactor || !weight || !radius || !color) {
         throw new Error("Missing or invalid default layerGroupName, smoothFactor, weight, radius, color, faultId, vehId, or vehName");
      }
      if (typeof myLatLngArr === "undefined" || !myLatLngArr.length) {
         throw new Error("No LatLng points to draw on map");
      }
      if (typeof myLatLngTimestampArr === "undefined" || !myLatLngTimestampArr.length) {
         throw new Error("No LatLng Timestamps to use");
      }
      if (myLatLngArr.length !== myLatLngTimestampArr.length) {
         throw new Error("No LatLng + Timestamp Arrays do not match");
      }
      this.drawPolyline(myLatLngArr, myLatLngTimestampArr);
      this.initRedrawFaultPolyline();
   }

   // eslint-disable-next-line complexity
   getFaultDescHtml(latLng, toolTipTimestamp) {
      const me = this;
      let timestamp = toolTipTimestamp ? toolTipTimestamp : null;

      if (!toolTipTimestamp) {
         const info = splMapFaultUtils.findLatLngSegment(latLng, me.polyLine.getLatLngs());

         if (info.nearestIdx !== null && typeof me.vehMarker.splMapFaults.latLngTimestampIdx !== "undefined") {
            timestamp = me.vehMarker.splMapFaults.latLngTimestampIdx[info.nearestIdx];
         }
         // DEBUG - PLEASE DELETE FOR PROD
         if (info.nearestIdx !== null && debugTools.utils.debugTracingLevel >= 2) {
            layerModel.clearLayersInGroup(debugTools._mapGroupLayer);

            const targetCircle = L.circleMarker(info.nearestLatLng, { radius: 5, stroke: true, fill: true, color: colorHexCodes.testPurple, weight: 2 });
            let partnerCircle;
            if (info.nearestIdx === info.startIdx) {
               partnerCircle = L.circleMarker(info.endLatLng, { radius: 5, stroke: true, fill: true, color: colorHexCodes.testLimeGreen, weight: 2 });
            }
            else {
               partnerCircle = L.circleMarker(info.startLatLng, { radius: 5, stroke: true, fill: true, color: colorHexCodes.testLimeGreen, weight: 2 });
            }
            layerModel.addToLayer(debugTools._mapGroupLayer, targetCircle);
            layerModel.addToLayer(debugTools._mapGroupLayer, partnerCircle);
            targetCircle.bringToBack();
            partnerCircle.bringToBack();
         }
         if (info.nearestIdx === null && debugTools.utils.debugTracingLevel === 2) { console.log("===== getFaultDescHtml(", me.vehId, ") ======= TIMESTAMP NOT FOUND ======="); } //DEBUG
      }
      if (debugTools.utils.debugTracingLevel >= 2) { console.log("======== getFaultDescHtml(", me.vehId, ") timestamp =", timestamp); }//DEBUG

      const faultInfo = splMapFaultUtils.faultInfoByTimestamp(timestamp, me.splFaultTimelineEvents);
      const alertHeader = faultInfo.faultState === "RED" ? splmap.tr("alert_header_red") : splmap.tr("alert_header_amber");

      const faultTimeTemptracHtml = faultInfo.faultTime.temptrac ? moment.unix(faultInfo.faultTime.temptrac).format(storage.humanDateTimeFormat) : "";
      const faultValueTemptrac = faultInfo.faultTime.temptrac ? me.getFaultValueHtml(true, faultInfo.faultTime.temptrac) : "";
      const faultValueTemptracHtml = faultValueTemptrac ? "<br />" + faultValueTemptrac : "";

      const vehTemptracThresholdType = splSrv.getTemptracVehThresholdSetting(me.vehId);
      const temptracThresholdTypeDesc = vehTemptracThresholdType === "fridge" ? splmap.tr("label_temptrac_threshold_fri") : splmap.tr("label_temptrac_threshold_fre");
      const vehTemptracThresholdTypeHtml = faultInfo.tooltipDesc.temptrac ? "<br />" + splmap.tr("label_temptrac_threshold") + ": " + temptracThresholdTypeDesc : "";

      const faultTimeTpmsHtml = faultInfo.faultTime.tpms ? moment.unix(faultInfo.faultTime.tpms).format(storage.humanDateTimeFormat) : "";
      const faultValueTpms = faultInfo.faultTime.tpms ? me.getFaultValueHtml(false, faultInfo.faultTime.tpms) : "";
      const faultValueTpmsHtml = faultValueTpms ? "<br />" + faultValueTpms : "";

      const tooltipDesc =
         faultInfo.tooltipDesc.temptrac + vehTemptracThresholdTypeHtml +
         (faultTimeTemptracHtml && faultTimeTemptracHtml !== faultTimeTpmsHtml ? "<br />@" + faultTimeTemptracHtml + faultValueTemptracHtml : faultValueTemptracHtml) +
         (faultInfo.tooltipDesc.temptrac ? "<br />" : "") + faultInfo.tooltipDesc.tpms +
         (faultTimeTpmsHtml ? "<br />@" + faultTimeTpmsHtml : "") + faultValueTpmsHtml;

      const latLngTxt = me.vehName + (faultInfo.faultState ? `: ${alertHeader}:<br />${tooltipDesc}` : "");

      return latLngTxt;
   }

   getFaultValueHtml(isTemptrac, timestamp) {
      const me = this;
      let html = "";

      //console.log("==== getFaultValueHtml(", me.vehId, ") sdata =", splSrv.sdataTools._cache); //DEBUG




      /*
            const showVal = Math.random() < 0.5 ? 0 : 1;
            html = showVal ? (isTemptrac ? "9.9 <span class='temp-press-symbol'>&#8451;</span> &hyphen; 98 <span class='temp-press-symbol'>&#8457;</span>" : "77.7 <span class='temp-press-symbol'>Psi</span> &hyphen; 77.6 <span class='temp-press-symbol'>kPa</span> &hyphen; 77.5 <span class='temp-press-symbol'>Bar</span>") : html;
      */

      return html;
   }

   enableToolipOn(leafletObj) {
      const me = this;

      if (leafletObj && !L.Browser.mobile) {
         const tooltipFunc = (evt) => {
            const timestamp = typeof evt.target.options.timestamp !== "undefined" ? evt.target.options.timestamp : null;
            leafletObj.unbindTooltip();
            closeAllTooltips();
            leafletObj.bindTooltip(me.getFaultDescHtml(evt.latlng, timestamp), {
               className: "spl-map-vehicle-tooltip",
            }).openTooltip(evt.latlng);
         };
         leafletObj.on("mouseover", tooltipFunc);
      }
   }

   enablePopupOn(leafletObj) {
      const me = this;

      if (leafletObj) {
         const popupObj = me.initPopup(leafletObj);
         const popupFunc = (evt) => {
            let popupHtml = "";
            const vehNameEscaped = escapeQuotes(me.vehName);

            // Mobile-only Fault Popup Content
            if (L.Browser.mobile) {
               const timestamp = typeof evt.target.options.timestamp !== "undefined" ? evt.target.options.timestamp : null;
               popupHtml = filterMarkerButton(me.vehId, vehNameEscaped) + me.getFaultDescHtml(evt.latlng, timestamp);
            }
            // Non-Mobile VehName-only Popup content
            else {
               popupHtml = filterMarkerButton(me.vehId, vehNameEscaped) + getStrongText(vehNameEscaped);
            }
            popupObj
               .openPopup(evt.latlng)
               .setPopupContent(popupHtml)
               .bringToFront();
         };
         leafletObj.on("click", popupFunc);
      }
   }

   initPopup(leafletObj) {
      const me = this;
      if (leafletObj) {

         // Use the first Leaflet object as the Vehicle Popup Hosting Layer,
         // then we just move it around as the user clicks on it.
         if (typeof me.vehMarker.splMapFaults.vehFaultsPopupObj !== "undefined") {
            return me.vehMarker.splMapFaults.vehFaultsPopupObj;
         }
         me.vehMarker.splMapFaults.vehFaultsPopupObj = leafletObj;
         leafletObj.bindPopup(getDefaultPopupText(me.vehId), {
            className: L.Browser.mobile ? "map-popup-content-mobile" : "map-popup-content",
            maxWidth: 500,
            autoClose: false,
         });

         leafletObj.on("popupopen", (evt) => {

            // Resolving overlap, bring active popup to front
            if (evt.popup._container.getAttribute("data-click-to-front") === null) {
               evt.popup._container.addEventListener("click", function () {
                  evt.popup.bringToFront();
               });
               evt.popup._container.setAttribute("data-click-to-front", true);
            }

            // Close other popups
            if (me.vehMarker && me.vehMarker.historicPath && me.vehMarker.historicPath.polyline) {
               const vehHistoricPathPolylineObj = me.vehMarker.historicPath.polyline;
               const vehLivePathPolylineObj = me.vehMarker.livePath.polyline;
               if (vehHistoricPathPolylineObj && vehHistoricPathPolylineObj.isPopupOpen()) {
                  vehHistoricPathPolylineObj.closePopup();
               }
               if (vehLivePathPolylineObj && vehLivePathPolylineObj.isPopupOpen()) {
                  vehLivePathPolylineObj.closePopup();
               }
            }
         });

         return me.vehMarker.splMapFaults.vehFaultsPopupObj;
      }
   }

   enableFaultInfoTooltip(vehDeviceData, splFaultTimelineEvents) {
      const me = this;
      if (me.polyLine) {
         me.vehDeviceData = vehDeviceData;
         me.latLngByTimeAPI = new INITlatLngToTimeDB(me.vehDeviceData);
         me.vehMarker = splMapFaultMgr.getVehMarker(me.vehId);
         me.splFaultTimelineEvents = splFaultTimelineEvents;

         // Enable Tooltips / Popups  on polyLine
         me.enableToolipOn(me.polyLine);
         me.enablePopupOn(me.polyLine);

         // Enable Tooltips / Popups on all current CircleMarkers
         if (me.circleMarkers && me.circleMarkers.length) {
            for (const circleMarker of me.circleMarkers) {
               me.enableToolipOn(circleMarker);
               me.enablePopupOn(circleMarker);
            }
         }
      }
   }

   drawPolyline(myLatLngArr, myLatLngTimestampArr) {
      const me = this;
      if (!me.polyLine && Array.isArray(myLatLngArr) && myLatLngArr.length) {
         me.polyLine = L.polyline(myLatLngArr, {
            smoothFactor: me.smoothFactor,
            weight: me.weight,
            color: me.color
         });
         layerModel.addToLayer(me.layerGroupName, me.polyLine);
         me.polyLine.bringToFront();

         // Create circleMarkers on Fault Path
         for (const idx in myLatLngArr) {
            const latLng = myLatLngArr[idx];
            const timestamp = myLatLngTimestampArr[idx];
            me.drawCircleMarker(L.latLng(latLng), timestamp);
         }
      }
   }

   drawCircleMarker(latLng, timestamp) {
      const me = this;
      if (latLng && me.polyLine) {
         const circleMarker = L.circleMarker(latLng, {
            radius: me.radius,
            stroke: true,
            fill: true,
            color: me.color,
            weight: me.weight,
            timestamp: timestamp
         });
         layerModel.addToLayer(me.layerGroupName, circleMarker);
         circleMarker.bringToFront();
         me.circleMarkers.push(circleMarker);

         // Enable Tooltip / Popup
         if (me.vehDeviceData && me.latLngByTimeAPI && me.splFaultTimelineEvents && me.vehMarker) {
            me.enableToolipOn(circleMarker);
            me.enablePopupOn(circleMarker);
         }
      }
   }

   initRedrawFaultPolyline() {
      const me = this;
      splSrv.events.register("onVehicleFaultReDraw", (vehId) => {

         // Add PolyLine + Markers
         if (vehId === me.vehId) {
            layerModel.addToLayer(me.layerGroupName, me.polyLine);
            for (const circleMarker of me.circleMarkers) {
               layerModel.addToLayer(me.layerGroupName, circleMarker);
            }
         }
      }, false);
   }

   addLatLngToFault(newLatLng, newLatLngTimestamp, vehDeviceData) {
      const me = this;
      try {
         if (newLatLng) {
            const latLngByTimeVehAPI = splMapFaultMgr.getVehMarker(me.vehId).splMapFaults.historicPathLatLngToTimeDB;
            const timestamp = splMapFaultUtils.latlngToTime(newLatLng, me.latLngByTimeAPI, latLngByTimeVehAPI, vehDeviceData);
            me.polyLine.addLatLng(L.latLng(newLatLng));
            me.drawCircleMarker(L.latLng(newLatLng), newLatLngTimestamp);
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
            if (typeof locObj.zone !== "undefined") {
               descArr.push(
                  splmap.tr("alert_desc_zone") + " " + locObj.zone + " - " +
                  me._locDescTr(splSrv.vehCompDb.names[locObj.vehComp])
               );
            }
            else {
               descArr.push(
                  splmap.tr("alert_desc_axle") + " " + locObj.axle + " " +
                  splmap.tr("alert_desc_tire") + " " + locObj.tire + " - " +
                  me._locDescTr(splSrv.vehCompDb.names[locObj.vehComp])
               );
            }
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

   getTimelineEvents(vehId) {
      const me = this;
      return new Promise(function (resolve, reject) {

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
                        reject("VehicleID [ " + vehId + " ]: Timeline NOT CREATED. Error fetching data");
                     }
                  }
               }, true, vehId);
            }
         }
      });
   }

   // eslint-disable-next-line complexity
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
                     evtType: faultObj.id.indexOf("temptrac") > -1 ? "temptracFault" : "tpmsFault",
                     evtState: faultObj.alert.color,
                     evtColor: faultObj.alert.color === "RED" ? colorHexCodes.spartanLyncRed : colorHexCodes.spartanLyncAmber,
                     tooltipDesc: splmap.tr(faultObj.alert.trId) + (faultLocDesc ? ` ( ${faultLocDesc} )` : "")
                  });
               }
               else if (faultObj && typeof faultObj.id !== "undefined" && faultObj.id.indexOf("temptrac") > -1 && faultObj.time) {
                  timeline.push({
                     latLngTime: parseInt(faultObj.time),
                     realTime: parseInt(faultObj.time),
                     evtType: faultObj.id.indexOf("_") > -1 ? faultObj.id.split("_")[0] : faultObj.id
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
      if (debugTools.utils.debugTracingLevel) { console.log("==== FaultTimelineEventMgr.getTimelineEvents(", vehId, ") timeline =", timeline); }//DEBUG

      return timeline;
   }

   fetchIgnAndFaults(onlyVehId) {
      const me = this;
      const vehIds = typeof onlyVehId !== "undefined" && onlyVehId ? [onlyVehId] : Object.values(deviceSearch.selectedIDS).map(vehObj => { return vehObj.id; });
      const toDateOverride = me._dayEndUnix;
      const firstTimeCallOverride = true;
      const showAllFaults = true;

      if (!me._isLiveDay) {

         me._isfetchComplete = false;

         // Fetch some data
         (async () => {
            const promises = vehIds.map(async (vehId) => {
               await (() => {
                  return new Promise((finalResolve, finalReject) => {
                     const searchRangeArr = [1]; // Only use a search range of 1 day for faults & ignition data

                     // Poll for TPMS Faults
                     const fTask1 = new Promise((subResolve1, subReject1) => {
                        const aSyncGoLib = INITGeotabTpmsTemptracLib(
                           apiConfig.api,
                           splSrv.sensorSearchRetryRangeInDays,
                           splSrv.sensorSearchTimeRangeForRepeatSearchesInSeconds,
                           searchRangeArr,
                           splSrv.faultSearchTimeRangeForRepeatSearchesInSeconds
                        );
                        aSyncGoLib.getFaults(vehId, function (faults, vehIgnitionInfo) {

                           if (faults) {
                              if (debugTools.utils.debugTracingLevel === 1) { console.log("======== fetchIgnAndFaults(", vehId, ") TPMS faults =", faults); }//DEBUG
                              if (debugTools.utils.debugTracingLevel === 1) { console.log("======== fetchIgnAndFaults(", vehId, ") TPMS vehIgnitionInfo =", vehIgnitionInfo); }//DEBUG

                              // Update Ign/Fault data
                              if (vehIgnitionInfo && (vehIgnitionInfo["on-latest"] || vehIgnitionInfo["off-latest"])) {
                                 me._historicalFaultData[vehId] = faults;
                                 me._historicalIgnData[vehId] = vehIgnitionInfo;
                                 subResolve1();
                              }
                              // Report on Ignition data missing
                              else {
                                 me._historicalFaultData[vehId] = faults;
                                 subReject1([vehId, "Ignition data not found"]);
                              }
                              return;
                           }
                           else {

                              // Update Ignition data, but report Fault data missing
                              if (vehIgnitionInfo && (vehIgnitionInfo["on-latest"] || vehIgnitionInfo["off-latest"])) {
                                 me._historicalIgnData[vehId] = vehIgnitionInfo;
                                 subReject1([vehId, "Fault data not found"]);
                              }
                              // Report on Fault and Ignition data missing
                              else {
                                 subReject1([vehId, "Fault + Ignition data not found"]);
                              }
                              return;
                           }

                        }, firstTimeCallOverride, toDateOverride, showAllFaults);
                     });

                     // Poll for TempTrac Faults
                     const fTask2 = new Promise((subResolve2) => {
                        const searchUnit = "days";
                        const toFaultDateObj = moment.unix(toDateOverride).utc();
                        const vehTemptracThresholdType = splSrv.getTemptracVehThresholdSetting(vehId);
                        getTempTracFaultsAsync(vehId, toFaultDateObj, searchRangeArr, searchUnit, vehTemptracThresholdType)
                           .then((faults) => {
                              if (debugTools.utils.debugTracingLevel === 1) { console.log("======== fetchIgnAndFaults(", vehId, ") TEMPTRAC faults =", faults); }//DEBUG
                              subResolve2(faults);
                           });
                     });

                     // Merge all the faults together
                     Promise.allSettled([fTask1, fTask2])
                        .then(([tpms, temptrac]) => {
                           const tpmsRejectInfo = tpms.status === "rejected" ? tpms.reason : false;
                           const temptracFaults = temptrac.value;

                           if (vehId && temptracFaults && temptracFaults.length) {
                              updateTempTracFaultStatusUsingIgnData(vehId, temptracFaults, me._historicalIgnData[vehId]);

                              // Init
                              if (typeof me._historicalFaultData[vehId] === "undefined") {
                                 me._historicalFaultData[vehId] = [];
                              }

                              // Merge into Historical Faults
                              for (const idx in temptracFaults) {
                                 temptracFaults[idx].id = temptracFaults[idx].id + "_" + idx; // Make each FaultId unique, so entire fault history is collected
                                 me._historicalFaultData[vehId].push(temptracFaults[idx]);
                              }

                              // Sort Historical Faults
                              me._historicalFaultData[vehId].sort((a, b) => a.time.toString().localeCompare(b.time.toString(), undefined, { numeric: true, sensitivity: "base" }));
                           }
                           if (tpmsRejectInfo) {
                              // Do not reject based only on missing Ignition data.
                              // As this is a common scenario for 2-wire TempTrac installations
                              // where we can still use the provided mandatory fault data
                              const rejectReason = tpmsRejectInfo[1];
                              if (rejectReason !== "Ignition data not found") {
                                 finalReject(tpmsRejectInfo);
                              }
                           }
                           finalResolve();
                        });
                  });
               })();

               splSrv.events.queueExec("onFaultTimelineEventMgrFetchComplete", vehId, true);
            });

            await Promise.allSettled(promises).then(resultArr => resultArr.map((result) => {
               if (result.status === "rejected") {
                  const [failedVehId, reason] = result.reason;
                  if (failedVehId) {
                     const vehName = deviceSearch.selectedIDS[failedVehId] !== "undefined" ? deviceSearch.selectedIDS[failedVehId].name + ` (${failedVehId})` : failedVehId;
                     console.log("!!!! Vehicle [", vehName, "] ERROR fetching historical data:", reason);
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
