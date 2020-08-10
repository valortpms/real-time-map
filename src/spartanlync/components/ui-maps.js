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
               const splHtml = splSensorDataParser.generateSensorDataHtml(sensorData, splSrv.sdataTools);
               resolve(splHtml ? `<p class="SPL-popupSensor"> ${splHtml} </p>` : "");
            })
            .catch((reason) => {
               reject(reason === splSrv.sdataTools.getSensorSearchInProgressResponse ? "" : `<p class="SPL-popupSensor"> ${reason} </p>`);
            });
      });
   },

   /**
    * Clear the Sensor data cache for all vehicles
    *
    *  @returns void
    */
   clearCache: function () {
      splSrv.sdataTools.resetCache();
   }
};
