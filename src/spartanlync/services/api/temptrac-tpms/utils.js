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
export function fetchVehSensorDataAsync(vehId) {
   return new Promise((resolve, reject) => {
      const aSyncGoLib = INITGeotabTpmsTemptracLib(
         apiConfig.api,
         splSrv.sensorSearchRetryRangeInDays,
         splSrv.sensorSearchTimeRangeForRepeatSearchesInSeconds
      );
      aSyncGoLib.getData(vehId, "", function (sensorData) {
         if (sensorData === null) {
            reject(splSrv.sensorDataNotFoundMsg);
         } else {
            resolve(sensorData);
         }
      });
   });
};