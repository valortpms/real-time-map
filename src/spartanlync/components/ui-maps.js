// eslint-disable-next-line no-unused-vars
import React, { Fragment } from "react";
import splSrv from "../services";
import moment from "moment-timezone";
import storage from "../../dataStore";
import { splSensorDataParser } from "../services/sensor-data-tools";
import { liveButtonModel } from "../../components/controls/live-button-model/live-button-model";
import { markerList } from "../../dataStore/map-data";

/**
 *  Manage the Vehicle Sensor Data shown on Map
 */
export const splSensorsOnMap = {

   /**
    *  Return in DIV HTML containing sensor data for Vehicle Map Popup
    *
    *  @returns string
    */
   getVehSensorDataDiv: function (vehId, vehName) {
      return new Promise((resolve, reject) => {
         let performSensorSearch = true;
         if (typeof splSrv.sdataTools._cache[vehId] !== "undefined" && splSrv.sdataTools._cache[vehId].noSensorDataFound) {
            if (typeof splSrv.sdataTools._cache[vehId].noSensorDataFoundExpiry === "undefined") {
               splSrv.sdataTools._cache[vehId].noSensorDataFoundExpiry = moment().utc().add(splSrv.sensorDataLifetime, "seconds").unix();
            }
            if (moment().utc().unix() < splSrv.sdataTools._cache[vehId].noSensorDataFoundExpiry) {
               performSensorSearch = false;
            }
         }
         if (performSensorSearch) {
            splSrv.sdataTools.fetchCachedSensorData(vehId, vehName)
               .then((sensorData) => {

                  // Delete NOSENSORDATAFOUND polling flag on successful receiving data
                  if (typeof splSrv.sdataTools._cache[vehId].noSensorDataFoundExpiry !== "undefined") {
                     delete splSrv.sdataTools._cache[vehId].noSensorDataFoundExpiry;
                  }

                  // The first time map sensor data popup opens, send content to popup by creating first-time flag
                  if (vehId && splSrv.sdataTools._cache !== null &&
                     typeof splSrv.sdataTools._cache[vehId] !== "undefined" &&
                     typeof splSrv.sdataTools._cache[vehId].popupOpenForFirstTime === "undefined") {
                     splSrv.sdataTools._cache[vehId].popupOpenForFirstTime = true;
                  }

                  // Fetch sensor data from cache,
                  // if
                  // 1. cached data available
                  // 2. recent search result empty
                  // 3. first time fetching data since vehicle map popup opened
                  //
                  if (typeof sensorData.vehId === "undefined" &&
                     vehId && splSrv.sdataTools._cache !== null &&
                     typeof splSrv.sdataTools._cache[vehId] !== "undefined" &&
                     splSrv.sdataTools._cache[vehId].popupOpenForFirstTime &&
                     splSrv.sdataTools._cache[vehId].data !== null) {
                     splSrv.sdataTools._cache[vehId].firstTime = true;
                     sensorData = splSrv.sdataTools._cache[vehId].data;
                  }
                  splSrv.sdataTools._cache[vehId].popupOpenForFirstTime = false;

                  // Render sensor data
                  const splHtml = splSensorDataParser.generateSensorDataHtml(sensorData, vehId, splSrv.sdataTools);
                  resolve(splHtml ? `<p class="SPL-popupSensor"> ${splHtml} </p>` : "");
               })
               .catch((reason) => {
                  const getToDateOverride = liveButtonModel.getToDateOverride();
                  const timeWarpClass = getToDateOverride ? "time-warp" : "";
                  const timeWarpLabelHtml = getToDateOverride ? "<span>" + splmap.tr("sensor_search_back_in_time") + "</span>" : "";
                  reject(reason === splSrv.sdataTools.getSensorSearchInProgressResponse ? "" : `<p class="SPL-popupSensor error ${timeWarpClass}"> ${reason}${timeWarpLabelHtml} </p>`);
               });
         }
         else {
            resolve("");
         }
      });
   },

   /**
    * Reset state of cache for vehicle
    *
    *  @returns void
    */
   resetVehCache: function (vehId) {
      if (typeof vehId !== "undefined" && vehId !== null &&
         typeof splSrv.sdataTools._cache !== null &&
         typeof splSrv.sdataTools._cache[vehId] !== "undefined" &&
         typeof splSrv.sdataTools._cache[vehId].data !== null &&
         !splSrv.sdataTools._cache[vehId].searching) {
         splSrv.sdataTools._cache[vehId].expiry = 0;
         splSrv.sdataTools._cache[vehId].popupOpenForFirstTime = true;
      }
   },

   /**
    * Delete cache for a vehicle
    *
    *  @returns void
    */
   clearVehCache: function (vehId) {
      splSrv.sdataTools.resetCache(vehId);
   }
};

/**
 *  Map Date/Time Utilities
 */
export const splMapUtil = {

   // Note which map popups were open, and re-open after Map reset due to map dateTime update on a date change
   // If only the time change but not the date, simply throw a dateTime change event
   reOpenPopupsAfterMapDateChangeReset(newTimeStamp) {
      const me = this;
      const reOpenPopupsArr = [];
      const hasDateChanged = me.hasDateChanged(newTimeStamp);

      // Date + Time changed
      if (hasDateChanged) {
         if (Object.keys(markerList).length) {
            Object.values(markerList).forEach(marker => {
               const markerPopup = marker.mapMarker._popup;
               if (typeof markerPopup.isOpen === "function" && markerPopup.isOpen()) {
                  reOpenPopupsArr.push(marker.deviceID);
               }
            });
         }

         // reOpen marker popups, 1sec apart after a short delay for the map to load
         splSrv.events.register("onDateUpdate", () => {
            me.throwOnDateTimeChangedEvent();

            if (reOpenPopupsArr.length) {
               setTimeout(() => {
                  me.reOpenPopups(reOpenPopupsArr);
               }, 2000);
            }
         });
      }
      // Time changed
      else {
         me.throwOnDateTimeChangedEvent();
      }
   },

   hasDateChanged(timeStamp) {
      const newTime = Math.round(timeStamp / 1000) * 1000;
      if (newTime < storage.dayStart.getTime() || newTime > storage.dayEnd.getTime()) {
         return true;
      }
      return false;
   },

   reOpenPopups(vehIds, idx) {
      const me = this;
      const i = typeof idx === "undefined" ? 0 : idx;
      const vehId = vehIds[i];
      let vehIdFound = false;

      if (i < vehIds.length) {
         setTimeout(() => {
            const vehName = typeof storage.selectedDevices[vehId] !== "undefined" ? storage.selectedDevices[vehId].name : vehId;
            for (const marker of Object.values(markerList)) {
               if (marker.deviceID === vehId && typeof marker.mapMarker !== "undefined") {
                  console.log(`--- reOpenPopupsAfterMapDateChangeReset() After date change on map; Opening popup for vehicle [ ${vehName} ]`);
                  marker.mapMarker.fire("click");
                  vehIdFound = true;
               }
            }
            if (!vehIdFound) {
               console.log(`--- reOpenPopupsAfterMapDateChangeReset() After date change on map; Could not re-open previously open popup for vehicle [ ${vehName} ]. Possibly GPS data not found.`);
            }
            me.reOpenPopups(vehIds, i + 1);
         }, 1000);
      }
   },

   throwOnDateTimeChangedEvent() {
      const me = this;

      // Clear sensor data cache when datetime changes
      me.clearAllMapMarkerVehCaches();

      // Throw onDateTimeChanged Event, for sensor data UI refresh on map and veh config panel
      splSrv.events.exec("onDateTimeChanged");
   },

   clearAllMapMarkerVehCaches() {
      for (const marker of Object.values(markerList)) {
         const vehId = marker.deviceID;
         if (vehId) {
            splSensorsOnMap.clearVehCache(vehId); // Clear stale sensor data
         }
      }
   },
};