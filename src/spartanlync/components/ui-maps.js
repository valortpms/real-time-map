// eslint-disable-next-line no-unused-vars
import React, { Fragment } from "react";
import splSrv from "../services";
import { splSensorDataParser } from "../services/sensor-data-tools";

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
         splSrv.sdataTools.fetchCachedSensorData(vehId, vehName)
            .then((sensorData) => {
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
               reject(reason === splSrv.sdataTools.getSensorSearchInProgressResponse ? "" : `<p class="SPL-popupSensor"> ${reason} </p>`);
            });
      });
   },

   /**
    * Reset state of a vehicle cache
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
   }
};
