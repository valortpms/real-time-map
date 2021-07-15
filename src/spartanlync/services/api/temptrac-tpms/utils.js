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

      // Attach DiagIdsLoaded listener (to update global diagIdsDB)
      aSyncGoLib.onDiagIdsLoaded((diagIdsDB) => {
         splSrv.vehCompDb = diagIdsDB;
      });

      // Fetch sensor data from Geotab API for vehicle
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
*  Asynchronously Fetch TPMS & TempTrac Vehicle Faults and Ignition data
*
*  @returns {array} objects
*/
export function fetchVehFaultsAndIgnitionAsync(vehId, firstTimeCallOverride) {
   const overrideFirstTimeCall = typeof firstTimeCallOverride === "undefined" ? null : firstTimeCallOverride;
   return new Promise((finalResolve) => {

      // Poll for TPMS Faults
      const fTask1 = new Promise((subResolve1) => {
         const aSyncGoLib = INITGeotabTpmsTemptracLib(
            apiConfig.api,
            splSrv.sensorSearchRetryRangeInDays,
            splSrv.sensorSearchTimeRangeForRepeatSearchesInSeconds,
            splSrv.faultSearchRetryRangeInDays,
            splSrv.faultSearchTimeRangeForRepeatSearchesInSeconds
         );
         aSyncGoLib.getFaults(vehId, function (faults, vehIgnitionInfo) {
            subResolve1([faults, vehIgnitionInfo]);
         }, overrideFirstTimeCall);
      });

      // Poll for TempTrac Faults
      const fTask2 = new Promise((subResolve2) => {
         const toFaultDateObj = moment.utc();
         const searchRangeArr = overrideFirstTimeCall === null ? splSrv.faultSearchRetryRangeInDays : [1];
         const searchUnit = overrideFirstTimeCall === null ? "days" : "hours";
         const vehTemptracThresholdType = splSrv.getTemptracVehThresholdSetting(vehId);
         getTempTracFaultsAsync(vehId, toFaultDateObj, searchRangeArr, searchUnit, vehTemptracThresholdType)
            .then((faults) => {
               subResolve2(faults);
            });
      });

      // Merge all the faults together
      Promise.all([fTask1, fTask2])
         .then(([[faults, vehIgnitionInfo], temptracFaults]) => {
            updateTempTracFaultStatusUsingIgnData(vehId, temptracFaults, vehIgnitionInfo);

            // Make each FaultId unique, so entire fault history is merged into Fault DB
            for (const idx in temptracFaults) {
               temptracFaults[idx].id = temptracFaults[idx].id + "_" + idx;
            }

            splSrv.cache.storeFaultData(vehId, temptracFaults, true);
            finalResolve([faults, vehIgnitionInfo]);
         })
         .catch(reason => console.log("VehicleID [ " + vehId + " ]: ---- ERROR while searching for FAULTS: ", reason));
   });
};


/**
*  Asynchronously Fetch Temptrac Faults for Vehicle using specified search data range Array
*
*  @returns {array} objects
*/
export function getTempTracFaultsAsync(vehId, toFaultDateObj, searchRangeArr, searchUnit, tempThreshold) {
   return new Promise((resolve) => {

      if (!vehId || !toFaultDateObj || !searchRangeArr || !searchUnit || !tempThreshold ||
         !Array.isArray(searchRangeArr) || !searchRangeArr.length ||
         typeof toFaultDateObj !== "object" || !moment.isMoment(toFaultDateObj)) {
         resolve(null);
      }

      (async () => {
         const toFaultDate = toFaultDateObj.format();
         let fdata = null;

         for (const idx in searchRangeArr) {
            const searchRange = searchRangeArr[idx];
            const fromFaultDate = moment.unix(toFaultDateObj.unix()).utc().subtract(searchRange, searchUnit).format();

            console.log("Please Wait...Attempt#" + (parseInt(idx) + 1) +
               " Retrieving TempTrac Fault data on VehicleID [ " + vehId + " ] using " +
               searchRange + " " + searchUnit + " date range: FROM: " +
               fromFaultDate + " UTC => TO: " + toFaultDate + " UTC");

            await new Promise((loopResolve) => {
               splSrv.sessionMgr.getTempTracFaults(vehId, fromFaultDate, toFaultDate, tempThreshold, (faults) => {
                  fdata = faults;
                  loopResolve();
               }, () => loopResolve());
            });
            if (fdata !== null) { break; }
         }

         // Report to console
         if (fdata === null || fdata && !fdata.length) {
            console.log("VehicleID [ " + vehId + " ]: NO TempTrac FAULT DATA FOUND for this date range!");
         }
         resolve(fdata);
      })();
   });
};


/**
* Update property "occurredOnLatestIgnition" on TempTrac fdata objects with latest ignition status from vehicle ignition data
*
*  @returns void
*/
export function updateTempTracFaultStatusUsingIgnData(vehId, fdata, ignData) {
   if (fdata && fdata.length) {
      let PostIgnFaultCount = 0;
      for (const idx in fdata) {
         if (ignData && ignData["on-latest"] && typeof fdata[idx].time !== "undefined" && fdata[idx].time < ignData["on-latest"]) {
            fdata[idx].occurredOnLatestIgnition = false;
         }
         else {
            fdata[idx].occurredOnLatestIgnition = true;
            PostIgnFaultCount++;
         }
      }
      if (PostIgnFaultCount) {
         console.log("VehicleID [ " + vehId + " ]: PROCESSED [" + PostIgnFaultCount + "] New Post-Ignition SpartanLync Temptrac FAULTS after the last search.");
      }
      else {
         console.log("VehicleID [ " + vehId + " ]: PROCESSED [" + fdata.length + "] SpartanLync Temptrac FAULTS after the last search.");
      }
   }
};
