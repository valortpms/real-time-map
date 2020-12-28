// eslint-disable-next-line no-unused-vars
import React from "react";
import splSrv from "../..";
import moment from "moment-timezone";
import { INITGeotabTpmsTemptracLib } from "../temptrac-tpms";
import { apiConfig } from "../../../../dataStore/api-config";
import { liveButtonModel } from "../../../../components/controls/live-button-model/live-button-model";

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
      }, overrideFirstTimeCall, liveButtonModel.getToDateOverride());
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

      // Poll for TPMS Faults
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

      // Poll for TempTrac Faults
      const toFaultDate = moment.utc().format();
      const searchRangeArr = overrideFirstTimeCall ? faultSearchRetryRangeInDays : [1];
      const searchUnit = overrideFirstTimeCall ? "days" : "hours";
      splSrv.sessionMgr.getTempTracFaults("fridge", toFaultDate, searchRangeArr, searchUnit, (faults) => {
         console.log("==== fetchVehFaultsAndIgnitionAsync.getTempTracFaults() faults =", faults);//DEBUG
      }, (reason) => { /* Handle error condition */ });

   });
};
