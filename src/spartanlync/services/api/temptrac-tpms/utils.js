// eslint-disable-next-line no-unused-vars
import React from "react";
import splSrv from "../..";
import { INITGeotabTpmsTemptracLib } from "../temptrac-tpms";
import { apiConfig } from "../../../../dataStore/api-config";

/**
*  Asynchronously Fetch Temptrac and TPMS sensor data
*
*  @returns object / string (on Error)
*/
export function fetchVehSensorDataAsync(vehId, vehComp, firstTimeCallOverride) {
   const vehComponent = vehComp || "";
   const overrideFirstTimeCall = typeof firstTimeCallOverride === "undefined" ? null : firstTimeCallOverride;
   return new Promise((resolve, reject) => {
      const aSyncGoLib = INITGeotabTpmsTemptracLib(
         apiConfig.api,
         splSrv.sensorSearchRetryRangeInDays,
         splSrv.sensorSearchTimeRangeForRepeatSearchesInSeconds,
         splSrv.faultSearchRetryRangeInDays,
         splSrv.faultSearchTimeRangeForRepeatSearchesInSeconds
      );
      aSyncGoLib.getData(vehId, vehComponent, function (sensorData) {
         if (sensorData === null) {
            reject(splSrv.sensorDataNotFoundMsg);
         } else {
            resolve(sensorData);
         }
      }, overrideFirstTimeCall);
   });
};

/**
*  Asynchronously Fetch Vehicle Faults and Ignition data
*
*  @returns {array} objects
*/
export function fetchVehFaultsAndIgnitionAsync(vehId, firstTimeCallOverride) {
   const overrideFirstTimeCall = typeof firstTimeCallOverride === "undefined" ? null : firstTimeCallOverride;
   return new Promise((resolve) => {
      const aSyncGoLib = INITGeotabTpmsTemptracLib(
         apiConfig.api,
         splSrv.sensorSearchRetryRangeInDays,
         splSrv.sensorSearchTimeRangeForRepeatSearchesInSeconds,
         splSrv.faultSearchRetryRangeInDays,
         splSrv.faultSearchTimeRangeForRepeatSearchesInSeconds
      );
      aSyncGoLib.getFaults(vehId, function (faults, vehIgnitionInfo) {
         resolve([faults, vehIgnitionInfo]);
      }, overrideFirstTimeCall);
   });
};