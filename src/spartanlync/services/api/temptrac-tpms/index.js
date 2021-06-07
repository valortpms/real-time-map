import moment from "moment-timezone";
import "core-js/stable";
import "regenerator-runtime/runtime";

/* eslint-disable complexity */
/* eslint-disable camelcase */
export function INITGeotabTpmsTemptracLib(api, retrySearchRange, repeatingSearchRange, retryFaultSearchRange, repeatingFaultSearchRange) {
   return function () {
      const me = {

         /**
          *  Private Variables
          */
         _timer: {},

         _api: api,
         _apiFaultFirstTimeCall: true,
         _apiFirstTimeCall: true,

         _apiCallFaultRetryCount: 0,
         _apiCallRetryCount: 0,

         _devId: null,
         _devConfig: {},
         _devSelectedComp: "",
         _devComponents: {
            ids: "tractor,trailer1,trailer2,trailer3",
            names: {
               tractor: "Tractor",
               trailer1: "Trailer 1",
               trailer2: "Dolly",
               trailer3: "Trailer 2"
            },
            diagIds: {
               byName: {
                  tractor: "aZNP-UxNzh0-V3Ljt4HTUvg",
                  trailer1: "ac_i2dUgutECBw4Zf3HLmUg",
                  trailer2: "aV6_asxQPAECKNay3aEReFA",
                  trailer3: "adiDqu3dghUe9XxGp7lkgDQ"
               },
               byIds: {
                  "aZNP-UxNzh0-V3Ljt4HTUvg": "tractor",
                  "ac_i2dUgutECBw4Zf3HLmUg": "trailer1",
                  "aV6_asxQPAECKNay3aEReFA": "trailer2",
                  "adiDqu3dghUe9XxGp7lkgDQ": "trailer3"
               }
            }
         },

         _tpmsAlerts: {
            "aKLJDxjee7kuoKR9UxakwaA": {
               name: "Missing Sensor",
               type: "Sensor Fault",
               trId: "alert_missing_sensor",
               color: "RED"
            },
            "DiagnosticVehicleBatteryLowVoltageId": {
               name: "Vehicle Battery has LOW Voltage",
               type: "Battery Fault",
               trId: "alert_battery_low_voltage",
               color: "AMBER"
            },

            "aZOW3ovi390i98yF2ZKR1qg": {
               name: "Leak Detected",
               type: "Tire Pressure Fault",
               trId: "leak_detected",
               color: "RED"
            },
            "aDXwtFQfg4EKkLSFd5Hs2rA": {
               name: "Extreme Over Pressure",
               type: "Tire Pressure Fault",
               trId: "alert_pressure_extreme_over",
               color: "RED"
            },
            "aZStc9p8eaUi8_ORP7eZ8eQ": {
               name: "Extreme Under Pressure",
               type: "Tire Pressure Fault",
               trId: "alert_pressure_extreme_under",
               color: "RED"
            },
            "ak1udf2L2UEemAp833dbAZQ": {
               name: "Over Temperature",
               type: "Tire Temperature Fault",
               trId: "alert_temperature_over",
               color: "AMBER"
            },
            "alCsVoz4p50ap9rPVxYnr_A": {
               name: "Over Pressure",
               type: "Tire Pressure Fault",
               trId: "alert_pressure_over",
               color: "AMBER"
            },
            "alDp49zHqz0eqtLawXDYc_g": {
               name: "Under Pressure",
               type: "Tire Pressure Fault",
               trId: "alert_pressure_under",
               color: "AMBER"
            }
         },

         _vehIgnitionData: null,

         _sDataCallback: null,
         _fDataCallback: null,

         _fromDate: null,
         _toDate: null,
         _toDateOverride: null,

         _fromFaultDate: null,
         _toFaultDate: null,
         _toFaultDateOverride: null,
         _showAllFaults: false,

         _repSType: null,
         _repCallback: null,

         _timeRangeForRepeatSearchesInSeconds: repeatingSearchRange,
         _timeSearchRetryRangeInDays: retrySearchRange,

         _timeRangeForRepeatFaultSearchesInSeconds: repeatingFaultSearchRange,
         _timeFaultSearchRetryRangeInDays: retryFaultSearchRange,

         /**
         * getData() Retrieves TPMS /Temptrac sensor data from Geotab API
         *
         * @param {string} devId    - Geotab Device Id
         * @param {string} devComp  - Vehicle component (null = all/any, tractor, trailer1, dolly, trailer2)
         * @param {string} callback - Callback func to invoke upon retrieval of data
         * @param {any} firstTimeCallOverride - Manually override firstTime/repeat behaviour
         * @param {int} toDateOverride - Manually override value of _toDate property
         *
         * If first call, start with a search over last 24 hours.
         * - If nothing found, retry with 2 days, then 1 week, 1 month, 2 months, then we give up
         * - If sensor data found,
         *   (1) convert sensor data to a time-sorted array of sensor objects and
         *   (2) pass back to supplied callback function
         *
         * @return {array} Array of Sensor objects, sorted by time from oldest to newest
         */
         getData: function (devId, devComp, callback, firstTimeCallOverride, toDateOverride) {
            if (devId.toString().trim() === "" || typeof callback === "undefined" || typeof callback !== "function") {
               return;
            }
            if (typeof firstTimeCallOverride !== "undefined" && firstTimeCallOverride !== null) {
               me._apiFirstTimeCall = firstTimeCallOverride;
            }
            if (typeof toDateOverride !== "undefined" && toDateOverride !== null) {
               me._toDateOverride = toDateOverride;
            }
            me._devId = devId;
            me._devSelectedComp = devComp;
            me._sDataCallback = callback;
            me._setDateRangeAndInvokeCall();
         },

         /**
         * getFaults() Retrieves Vehicle faults and ignition data from Geotab API
         *
         * @param {string} devId    - Geotab Device Id
         * @param {string} callback - Callback func to invoke upon retrieval of fault data
         * @param {any} firstTimeCallOverride - Manually override firstTime/repeat behaviour
         * @param {int} toDateOverride - Manually override value of _toFaultDate property
         *
         * If first call, start with a search over last 24 hours.
         * - If nothing found, retry with 2 days, then 1 week, 1 month, 2 months, then we give up
         * - If sensor data found,
         *   (1) convert sensor data to a time-sorted array of sensor objects and
         *   (2) pass back to supplied callback function
         *
         * @return {array} Array of Fault objects, sorted by time from oldest to newest
         * @return {array} Array of Ignition data objects, sorted by time from oldest to newest
         */
         getFaults: function (devId, callback, firstTimeCallOverride, toDateOverride, showAllFaults) {
            if (devId.toString().trim() === "" || typeof callback === "undefined" || typeof callback !== "function") {
               return;
            }
            if (typeof firstTimeCallOverride !== "undefined" && firstTimeCallOverride !== null) {
               me._apiFaultFirstTimeCall = firstTimeCallOverride;
            }
            if (typeof toDateOverride !== "undefined" && toDateOverride !== null) {
               me._toFaultDateOverride = toDateOverride;
            }
            me._devId = devId;
            me._fDataCallback = callback;
            me._showAllFaults = typeof showAllFaults !== "undefined" && showAllFaults === true ? true : false;
            me._setDateRangeAndInvokeFaultCalls();
         },

         /**
         * getVehStatus() Retrieves Vehicle status info from Geotab API
         *
         * @param {string} devId    - Geotab Device Id
         * @param {string} callback - Callback func to invoke upon retrieval of data
         *
         * @return {array} Vehicle status object
         */
         getVehStatus: function (devId, vStatusCallback) {
            if (devId.toString().trim() === "" || typeof vStatusCallback === "undefined" || typeof vStatusCallback !== "function") {
               return;
            }

            // Build DeviceStatus API Call
            const apiCall = {
               typeName: "DeviceStatusInfo",
               search: {
                  deviceSearch: {
                     id: devId
                  }
               }
            };
            console.log("VehicleID [ " + devId + " ]: getVehStatus(): Collecting latest Vehicle Status information...");

            // Invoke Device Status API Call
            me._timer.a1 = new Date();
            me._api.call("Get", apiCall,
               function (result) {
                  if (result && result.length) {
                     const vehStatusObj = result[0];
                     me._timer.a2 = new Date();
                     console.log("VehicleID [ " + devId + " ]: getVehStatus(): Vehicle Status Info retrieved - " + me._convertSecondsToHMS((me._timer.a2 - me._timer.a1) / 1000));
                     vStatusCallback(vehStatusObj);
                  }
                  else {
                     console.log("--- Error: getVehStatus.api.call(): EMPTY RESPONSE");
                     vStatusCallback(null);
                  }
               },
               function (errorString) {
                  me._timer.a2 = new Date();
                  console.log("VehicleID [ " + devId + " ]: ERROR: Vehicle Status Info retrieval failed - " + me._convertSecondsToHMS((me._timer.a2 - me._timer.a1) / 1000));
                  console.log("VehicleID [ " + devId + " ]: ERROR: getVehStatus.api.call(): " + errorString);
                  vStatusCallback(null);
               });
         },

         getVehComponentDB: function () {
            return me._devComponents;
         },

         getTpmsAlerts: function () {
            return me._tpmsAlerts;
         },

         resetAsFirstTime: function () {
            me._devId = null;
            me._devConfig = {};
            me._devSelectedComp = "";
            me._apiCallFaultRetryCount = 0;
            me._apiCallRetryCount = 0;
            me._apiFirstTimeCall = true;
            me._apiFaultFirstTimeCall = true;
            me._vehIgnitionData = null;
            me._showAllFaults = false;
         },

         resetForNewVehComponent: function () {
            me._devId = null;
            me._devSelectedComp = "";
            me._apiCallFaultRetryCount = 0;
            me._apiCallRetryCount = 0;
            me._apiFirstTimeCall = true;
            me._apiFaultFirstTimeCall = true;
            me._vehIgnitionData = null;
            me._showAllFaults = false;
         },

         _setDateRangeAndInvokeFaultCalls: function () {
            me._toFaultDate = me._toFaultDateOverride ? moment.unix(me._toFaultDateOverride).utc().format() : moment().utc().format();

            // First call, search for data over last few days
            if (me._apiFaultFirstTimeCall) {

               // If retry limit is reached without fault data, send a callback failure response
               if (me._apiCallFaultRetryCount === me._timeFaultSearchRetryRangeInDays.length) {
                  me._apiCallFaultRetryCount = 0;
                  me._toFaultDateOverride = null;
                  me._fDataCallback(null, me._vehIgnitionData);
                  return;
               }
               // Iterate date range array USING _apiCallFaultRetryCount until a successful API response
               me._fromFaultDate = moment().utc().subtract(me._timeFaultSearchRetryRangeInDays[me._apiCallFaultRetryCount], "day").format();
               if (me._toFaultDateOverride) {
                  // Calculate FROM using user-supplied UNIX timestamp instead of NOW
                  me._fromFaultDate = moment.unix(me._toFaultDateOverride).utc().subtract(me._timeFaultSearchRetryRangeInDays[me._apiCallFaultRetryCount], "day").format();
               }
            }
            // Repeat call, search over the last few minutes
            else {
               me._fromFaultDate = moment().utc().subtract(me._timeRangeForRepeatFaultSearchesInSeconds, "seconds").format();
               if (me._toFaultDateOverride) {
                  // Calculate FROM using user-supplied UNIX timestamp instead of NOW
                  me._fromFaultDate = moment.unix(me._toFaultDateOverride).utc().subtract(me._timeRangeForRepeatFaultSearchesInSeconds, "seconds").format();
               }
            }

            // Build then perform TPMS/Temptrac Multicall
            console.log("Please Wait...Attempt#" + (me._apiCallFaultRetryCount + 1) +
               " Retrieving TPMS Fault data on VehicleID [ " + me._devId + " ] using " + (
                  me._apiFaultFirstTimeCall ?
                     me._timeFaultSearchRetryRangeInDays[me._apiCallFaultRetryCount] + " day" :
                     me._convertSecondsToHMS(me._timeRangeForRepeatFaultSearchesInSeconds)
               ) + " date range: FROM: " + me._fromFaultDate + " => TO: " + me._toFaultDate);

            // Invoke Get.Fault + Get.TireLocation(Using DiagIds from VehComponentsTable) API Calls
            const apiCall = [
               ["Get", {
                  typeName: "FaultData",
                  search: {
                     fromDate: me._fromFaultDate,
                     toDate: me._toFaultDate,
                     deviceSearch: {
                        id: me._devId
                     }
                  }
               }],
               ["Get", {
                  typeName: "StatusData",
                  search: {
                     fromDate: me._fromFaultDate,
                     toDate: me._toFaultDate,
                     deviceSearch: {
                        id: me._devId
                     },
                     diagnosticSearch: {
                        id: "DiagnosticIgnitionId"
                     }
                  }
               }]
            ];
            if (Object.keys(me._devComponents["diagIds"]["byIds"]).length) {
               Object.keys(me._devComponents["diagIds"]["byIds"]).forEach(diagId => {
                  apiCall.push(["Get", {
                     typeName: "StatusData",
                     search: {
                        fromDate: me._fromFaultDate,
                        toDate: me._toFaultDate,
                        deviceSearch: {
                           id: me._devId
                        },
                        diagnosticSearch: {
                           id: diagId
                        }
                     }
                  }]);
               });
            }

            me._timer.b3 = new Date();
            api.multiCall(apiCall,
               function (result) {
                  if (result && result.length >= 3) {
                     const fromFaultDateUnix = moment(me._fromFaultDate).unix();
                     const toFaultDateUnix = moment(me._toFaultDate).unix();
                     let faultDataFound = false;
                     let tireLocData = {};
                     const fdata = {};

                     me._timer.b4 = new Date();
                     console.log("Fault data for VehicleID [ " + me._devId + " ] retrieved - " + me._convertSecondsToHMS((me._timer.b4 - me._timer.b3) / 1000));
                     console.log("Fault data for VehicleID [ " + me._devId + " ] being analyzed - Almost There!");

                     // Collect Ignition data
                     me._vehIgnitionData = me._generateVehIgnitionDb(result[1]);

                     // Assemble and merge Tire Location data from multi-vehicle Component query
                     for (let i = 2; i < result.length; i++) {
                        tireLocData = { ...tireLocData, ...me._generateFaultAxleLocDb(result[i]) };
                     }

                     // Analyze fault data
                     me._timer.b3 = new Date();
                     for (const frec of result[0]) {
                        const frecDateUnix = moment(frec.dateTime).unix();
                        if (!frec.id || frec.device.id !== me._devId || typeof frec.diagnostic.id === "undefined" ||
                           !(frecDateUnix >= fromFaultDateUnix && frecDateUnix <= toFaultDateUnix)) {
                           continue; // Invalid records discarded
                        }
                        const faultId = !me._showAllFaults ? frec.diagnostic.id : frec.diagnostic.id + "_" + (Math.random().toString(36).substr(2, 5));
                        const recObj = {
                           id: faultId,
                           diagId: frec.diagnostic.id,
                           time: frecDateUnix
                        };

                        // Keep the most recent fault record by time
                        if (typeof fdata[faultId] === "undefined") {
                           fdata[faultId] = recObj;
                        }
                        else if (recObj.time > fdata[faultId].time) {
                           fdata[faultId] = recObj;
                        }

                        // Attach VehComponent/Axle/Tire location to Fault record (If found in Tire Location DB)
                        if (Object.keys(tireLocData).length) {
                           Object.keys(tireLocData).forEach(vehComp => {
                              if (typeof tireLocData[vehComp][fdata[faultId].time] !== "undefined") {
                                 const tireLocRec = tireLocData[vehComp][fdata[faultId].time];
                                 tireLocRec.vehComp = vehComp;
                                 if (typeof fdata[faultId].loc === "undefined") {
                                    fdata[faultId].loc = [];
                                 }
                                 fdata[faultId].loc.push(tireLocRec);
                              }
                           });
                        }

                        // Attach Alert level to a few Faults (TPMS-related)
                        if (typeof fdata[faultId].alert === "undefined" && typeof me._tpmsAlerts[fdata[faultId].diagId] !== "undefined") {
                           fdata[faultId].alert = me._tpmsAlerts[fdata[faultId].diagId];
                        }

                        // Specify whether fault occurred after the most recent ignition
                        fdata[faultId].occurredOnLatestIgnition = fdata[faultId].time >= me._vehIgnitionData["on-latest"] ? true : false;

                        faultDataFound = true;
                     }
                     if (!faultDataFound) {
                        if (me._apiFaultFirstTimeCall) {

                           // If its a first time call + no fault date found, Retry with a different date range
                           console.log("VehicleID [ " + me._devId + " ]: NO FAULT DATA FOUND! Retrying search with another date range...");
                           me._apiCallFaultRetryCount++;
                           me._setDateRangeAndInvokeFaultCalls();
                           return;
                        }
                        else {

                           // Repeat calls will fails with "No Results" found. No Retry. Return "No Results" callback response
                           console.log("VehicleID [ " + me._devId + " ]: NO FAULT DATA FOUND for this date range!");
                           me._apiCallFaultRetryCount = 0;
                           me._toFaultDateOverride = null;
                           me._fDataCallback(null, me._vehIgnitionData);
                           return;
                        }
                     }
                     else {
                        // Future calls after this successful response will not be a first-timer
                        me._apiFaultFirstTimeCall = false;

                        // Build API calls for searching for diagnostic descriptions for the Fault Ids found
                        const calls = [];
                        const faultArr = [];
                        const diagDesc = {};
                        if (Object.keys(fdata).length) {
                           for (const faultId of Object.keys(fdata)) {
                              if (typeof diagDesc[fdata[faultId].diagId] === "undefined") {
                                 calls.push(["Get", {
                                    typeName: "Diagnostic",
                                    search: {
                                       id: fdata[faultId].diagId
                                    }
                                 }]);
                                 diagDesc[fdata[faultId].diagId] = "";
                              }
                           }

                           // Search for Diagnostic descriptions
                           api.multiCall(calls,
                              function (result) {
                                 if (result && result.length) {

                                    // Assemble Diagnostic descriptions
                                    for (const res of result) {
                                       if (Array.isArray(res) && res.length) {
                                          for (const frec of res) {
                                             if (typeof frec.name === "undefined" || !frec.id) {
                                                continue; // Invalid / missing records discarded
                                             }
                                             diagDesc[frec.id] = frec.name;
                                          }
                                       }
                                       else if (typeof res === "object" && typeof res.name !== "undefined" && res.id) {
                                          diagDesc[res.id] = res.name;
                                       }
                                    }

                                    // Merge Diagnostic descriptions with Fault data
                                    for (const faultId of Object.keys(fdata)) {
                                       if (diagDesc[fdata[faultId].diagId]) {
                                          fdata[faultId].msg = diagDesc[fdata[faultId].diagId];
                                          faultArr.push(fdata[faultId]);
                                       }
                                    }

                                    me._timer.b4 = new Date();
                                    console.log("Fault data for VehicleID [ " + me._devId + " ] analyzed and sorted - " + me._convertSecondsToHMS((me._timer.b4 - me._timer.b3) / 1000) + ".");

                                    // Return fault data to callback
                                    me._apiCallFaultRetryCount = 0;
                                    me._toFaultDateOverride = null;
                                    me._fDataCallback(faultArr, me._vehIgnitionData);
                                    return;
                                 }
                                 else {
                                    if (me._apiFaultFirstTimeCall) {
                                       me._apiCallFaultRetryCount++;
                                       me._setDateRangeAndInvokeFaultCalls();
                                       return;
                                    }

                                    // Return "NOT-FOUND" callback response
                                    me._apiCallFaultRetryCount = 0;
                                    me._fDataCallback(null, me._vehIgnitionData);
                                 }
                              });
                        }
                        else {
                           if (me._apiFaultFirstTimeCall) {
                              me._apiCallFaultRetryCount++;
                              me._setDateRangeAndInvokeFaultCalls();
                              return;
                           }

                           // Return "NOT-FOUND" callback response
                           me._apiCallFaultRetryCount = 0;
                           me._fDataCallback(null, me._vehIgnitionData);
                        }
                     }
                  }

                  // No results from API Call, Retry
                  else {

                     // Retry if its a first time call
                     if (me._apiFaultFirstTimeCall) {
                        me._apiCallFaultRetryCount++;
                        me._setDateRangeAndInvokeFaultCalls();
                        return;
                     }

                     // Return "NOT-FOUND" callback response
                     console.log("VehicleID [ " + me._devId + " ]: NO FAULT DATA FOUND for this date range!");
                     me._apiCallFaultRetryCount = 0;
                     me._toFaultDateOverride = null;
                     me._fDataCallback(null, me._vehIgnitionData);
                  }
               },
               function (errorString) {
                  me._timer.b4 = new Date();
                  console.log("VehicleID [ " + me._devId + " ]: ---- Sensor data retrieval failed - " + me._convertSecondsToHMS((me._timer.b4 - me._timer.b3) / 1000));
                  console.log("VehicleID [ " + me._devId + " ]: ERROR: getFaults.api.multiCall(): " + errorString);

                  // Retry if its a first time call
                  if (me._apiFaultFirstTimeCall) {
                     me._apiCallFaultRetryCount++;
                     me._setDateRangeAndInvokeFaultCalls();
                     return;
                  }

                  // Return "NOT-FOUND" callback response
                  me._apiCallFaultRetryCount = 0;
                  me._toFaultDateOverride = null;
                  me._fDataCallback(null, me._vehIgnitionData);
               });
         },

         _setDateRangeAndInvokeCall: function () {
            let vehComps = "";
            me._toDate = me._toDateOverride ? moment.unix(me._toDateOverride).utc().format() : moment().utc().format();

            // First call, search for data over last few days
            if (me._apiFirstTimeCall) {

               // If retry limit is reached without sensor data, send a failure response to callback func
               if (me._apiCallRetryCount === me._timeSearchRetryRangeInDays.length) {
                  me._apiCallRetryCount = 0;
                  me._toDateOverride = null;
                  me._sDataCallback(null);
                  return;
               }

               // Iterate date range array USING _apiCallRetryCount until a successful API response
               me._fromDate = moment().utc().subtract(me._timeSearchRetryRangeInDays[me._apiCallRetryCount], "day").format();
               if (me._toDateOverride) {
                  // Calculate FROM using user-supplied UNIX timestamp instead of NOW
                  me._fromDate = moment.unix(me._toDateOverride).utc().subtract(me._timeSearchRetryRangeInDays[me._apiCallRetryCount], "day").format();
               }
            }
            // Repeat call, search over the last few minutes
            else {
               me._fromDate = moment().utc().subtract(me._timeRangeForRepeatSearchesInSeconds, "seconds").format();
               if (me._toDateOverride) {
                  // Calculate FROM using user-supplied UNIX timestamp instead of NOW
                  me._fromDate = moment.unix(me._toDateOverride).utc().subtract(me._timeRangeForRepeatSearchesInSeconds, "seconds").format();
               }
            }

            // Search for all Vehicle componenents, if a specific component not specified
            vehComps = me._devSelectedComp ? me._devSelectedComp : me._devComponents.ids;

            // Build then perform TPMS/Temptrac Multicall
            console.log("Please Wait...Attempt#" + (me._apiCallRetryCount + 1) +
               " Retrieving " + (me._devSelectedComp ? me._devComponents.names[me._devSelectedComp].toUpperCase() : "ALL") +
               " Sensor Data on VehicleID [ " + me._devId + " ] using " + (
                  me._apiFirstTimeCall ?
                     me._timeSearchRetryRangeInDays[me._apiCallRetryCount] + " day" :
                     me._convertSecondsToHMS(me._timeRangeForRepeatSearchesInSeconds)
               ) + " date range: FROM: " + me._fromDate + " => TO: " + me._toDate);

            me._timer.b1 = new Date();
            me._api.multiCall(me._buildApiCall(vehComps),
               function (result) {
                  if (result && result.length) {
                     const fromDateUnix = moment(me._fromDate).unix();
                     const toDateUnix = moment(me._toDate).unix();
                     let sensorDataFound = false;
                     const sdata = {};

                     me._timer.b2 = new Date();
                     console.log("Sensor data for VehicleID [ " + me._devId + " ] retrieved - " + me._convertSecondsToHMS((me._timer.b2 - me._timer.b1) / 1000));

                     // Analyze and Sort sensor data
                     console.log("Sensor data for VehicleID [ " + me._devId + " ] being analyzed - Almost There!");
                     me._timer.b1 = new Date();
                     for (const res of result) {
                        if (Array.isArray(res) && res.length) {
                           for (const srec of res) {
                              const srecDateUnix = moment(srec.dateTime).unix();
                              if (!srec.id || !srec.dateTime || srec.device.id !== me._devId || typeof srec.diagnostic.id === "undefined" ||
                                 !(srecDateUnix > fromDateUnix && srecDateUnix < toDateUnix)) {
                                 continue; // Invalid records discarded
                              }
                              const diagName = me._locLib.idxIds[srec.diagnostic.id];
                              const vehCompType = me._locLib[diagName].type;

                              // Init Sensor Data ordered by Vehicle component
                              if (typeof sdata[vehCompType] === "undefined") {
                                 sdata[vehCompType] = {
                                    tpmstemp: {},
                                    tpmspress: {},
                                    temptrac: {}
                                 };
                              }

                              // Store Temptrac sensor reading
                              if (diagName.indexOf("reefer temperature") > -1) {
                                 const zone = me._extractZoneFromLoc(diagName);
                                 const locId = "temptrac_" + zone.trim().replace(/ /g, "").toLowerCase();
                                 const recObj = {
                                    id: locId,
                                    type: "Temptrac",
                                    time: srecDateUnix,
                                    zone: zone,
                                    val: me._fromDataToValueObj(srec)
                                 };

                                 // Remember most recent records by Location
                                 if (typeof sdata[vehCompType].temptrac[locId] === "undefined") {
                                    sdata[vehCompType].temptrac[locId] = recObj;
                                 }
                                 else if (recObj.time > sdata[vehCompType].temptrac[locId].time) {
                                    sdata[vehCompType].temptrac[locId] = recObj;
                                 }
                              }
                              // Store TPMS Temperature sensor reading
                              else if (diagName.indexOf("ire temperature:") > -1) {
                                 const axle = me._extractAxleFromLoc(diagName).replace(/^trailer [0-9] /g, "");
                                 const locId = "tiretemp_" + axle.trim().replace(/ /g, "").toLowerCase();
                                 const recObj = {
                                    id: locId,
                                    type: "Tire Temperature",
                                    time: srecDateUnix,
                                    axle: axle,
                                    val: me._fromDataToValueObj(srec)
                                 };

                                 // Remember most recent records by Location
                                 if (typeof sdata[vehCompType].tpmstemp[locId] === "undefined") {
                                    sdata[vehCompType].tpmstemp[locId] = recObj;
                                 }
                                 else if (recObj.time > sdata[vehCompType].tpmstemp[locId].time) {
                                    sdata[vehCompType].tpmstemp[locId] = recObj;
                                 }
                              }
                              // Store TPMS Pressure sensor reading
                              else if (diagName.indexOf("ire pressure:") > -1) {
                                 const axle = me._extractAxleFromLoc(diagName).replace(/^trailer [0-9] /g, "");
                                 const locId = "tirepress_" + axle.trim().replace(/ /g, "").toLowerCase();
                                 const recObj = {
                                    id: locId,
                                    type: "Tire Pressure",
                                    time: srecDateUnix,
                                    axle: axle,
                                    val: me._fromDataToValueObj(srec)
                                 };

                                 // Remember most recent records by Location
                                 if (typeof sdata[vehCompType].tpmspress[locId] === "undefined") {
                                    sdata[vehCompType].tpmspress[locId] = recObj;
                                 }
                                 else if (recObj.time > sdata[vehCompType].tpmspress[locId].time) {
                                    sdata[vehCompType].tpmspress[locId] = recObj;
                                 }
                              }
                              sensorDataFound = true;
                           }
                        }
                     }

                     if (!sensorDataFound) {
                        if (me._apiFirstTimeCall) {

                           // If its a first time call + no sensor date found, Retry with a different date range
                           console.log("NO SENSOR DATA FOUND on VehicleID [ " + me._devId + " ]! Retrying search with another date range...");
                           me._apiCallRetryCount++;
                           me._setDateRangeAndInvokeCall();
                           return;
                        }
                        else {

                           // Repeat calls will fails with "No Results" found. No Retry. Return "No Results" response to callback
                           me._apiCallRetryCount = 0;
                           me._toDateOverride = null;
                           me._sDataCallback(null);
                           return;
                        }
                     }
                     else {
                        me._timer.b2 = new Date();
                        console.log("Sensor data for VehicleID [ " + me._devId + " ] analyzed and sorted - " + me._convertSecondsToHMS((me._timer.b2 - me._timer.b1) / 1000) + ".");

                        if (!me._devSelectedComp) {

                           // Search results for the Entire Vehicle Train chooses the highest-priority vehicle component found in search results
                           const vehCompsFound = Object.keys(sdata);
                           if (vehCompsFound.length === 1) {
                              me._devSelectedComp = vehCompsFound[0];
                           }
                           else {
                              for (const comp of me._devComponents.ids.split(",")) {
                                 if (vehCompsFound.includes(comp)) {
                                    me._devSelectedComp = comp;
                                    break;
                                 }
                              }
                           }

                           // Build vehicle component configuration, returned on future search results
                           me._devConfig = {
                              ids: vehCompsFound,
                              total: vehCompsFound.length,
                              compsdata: sdata
                           };
                        }
                        me._devConfig.active = me._devSelectedComp;

                        // Future calls after this successful response will not be a first-timer
                        me._apiFirstTimeCall = false;

                        // Return sensor data for single Vehicle component to UI callback
                        me._apiCallRetryCount = 0;
                        const compdata = JSON.parse(JSON.stringify(sdata[me._devSelectedComp]));
                        compdata.vehId = me._devId;
                        compdata.vehCfg = me._devConfig;

                        // If toDate override supplied in parameters, return toDate property in result data
                        if (compdata && me._toDateOverride) {
                           compdata.toDate = me._toDateOverride;
                        }
                        me._toDateOverride = null;
                        me._sDataCallback(compdata);
                        return;
                     }
                  }

                  // No results from multicall, Retry
                  else {
                     me._apiCallRetryCount++;
                     me._setDateRangeAndInvokeCall();
                     return;
                  }
               },
               function (errorString) {
                  me._timer.b2 = new Date();
                  console.log("VehicleID [ " + me._devId + " ]: ---- Sensor data retrieval failed - " + me._convertSecondsToHMS((me._timer.b2 - me._timer.b1) / 1000));
                  console.log("VehicleID [ " + me._devId + " ]: ERROR: getData.api.multiCall(): " + errorString);

                  // Retry if its a first time call
                  if (me._apiFirstTimeCall) {
                     me._apiCallRetryCount++;
                     me._setDateRangeAndInvokeCall();
                  }
               });
         },

         _generateFaultAxleLocDb: function (result) {
            const locData = {};

            if (result && result.length) {
               for (const res of result) {
                  if (Array.isArray(res) && res.length) {
                     for (const frec of res) {
                        if (typeof frec.data === "undefined" ||
                           typeof frec.dateTime === "undefined" ||
                           typeof frec.diagnostic === "undefined" ||
                           typeof frec.diagnostic.id === "undefined") {
                           continue; // Invalid / missing records discarded
                        }
                        const time = moment(frec.dateTime).unix();
                        const vehComp = me._devComponents["diagIds"]["byIds"][frec.diagnostic.id] ? me._devComponents["diagIds"]["byIds"][frec.diagnostic.id] : "unknown";
                        if (typeof locData[vehComp] === "undefined") {
                           locData[vehComp] = {};
                        }
                        locData[vehComp][time] = me._getLocFromGeotabData(frec.data);
                     }
                  }
                  else if (typeof res === "object" &&
                     typeof res.data !== "undefined" &&
                     typeof res.dateTime !== "undefined" &&
                     typeof res.diagnostic !== "undefined" &&
                     typeof res.diagnostic.id !== "undefined"
                  ) {
                     const time = moment(res.dateTime).unix();
                     const vehComp = me._devComponents["diagIds"]["byIds"][res.diagnostic.id] ? me._devComponents["diagIds"]["byIds"][res.diagnostic.id] : "unknown";
                     if (typeof locData[vehComp] === "undefined") {
                        locData[vehComp] = {};
                     }
                     locData[vehComp][time] = me._getLocFromGeotabData(res.data);
                  }
               }
            }
            return locData;
         },

         /**
         * _generateVehIgnitionDb() Stores Ignition Status in Object Db
         *
         * In "data" property;
         * - Ignition on will be indicated by a 1
         * - Ignition off will be indicated by a 0
         *
         * @return {object} structure storing Array of vehicle Ignition organized by ON/OFF status
         */
         _generateVehIgnitionDb: function (result) {
            const ignitionData = {
               "on-latest": 0,
               "on": [],
               "off-latest": 0,
               "off": [],
               "byTime": {},
            };

            if (result && result.length) {
               for (const res of result) {
                  if (Array.isArray(res) && res.length) {
                     for (const rec of res) {
                        if (typeof rec.data === "undefined" ||
                           typeof rec.dateTime === "undefined") {
                           continue; // Invalid / missing records discarded
                        }
                        const time = moment(rec.dateTime).unix();
                        const status = rec.data ? "on" : "off";
                        ignitionData[status].push(time);
                        ignitionData["byTime"][time] = status;
                        ignitionData["on-latest"] = status === "on" && time > ignitionData["on-latest"] ? time : ignitionData["on-latest"];
                        ignitionData["off-latest"] = status === "off" && time > ignitionData["off-latest"] ? time : ignitionData["off-latest"];
                     }
                  }
                  else if (typeof res === "object" &&
                     typeof res.data !== "undefined" &&
                     typeof res.dateTime !== "undefined"
                  ) {
                     const time = moment(res.dateTime).unix();
                     const status = res.data ? "on" : "off";
                     ignitionData[status].push(time);
                     ignitionData["byTime"][time] = status;
                     ignitionData["on-latest"] = status === "on" && time > ignitionData["on-latest"] ? time : ignitionData["on-latest"];
                     ignitionData["off-latest"] = status === "off" && time > ignitionData["off-latest"] ? time : ignitionData["off-latest"];
                  }
               }
            }
            return ignitionData;
         },

         _mDimAssign: function (obj, keyPath, value) {
            const lastKeyIndex = keyPath.length - 1;
            for (const i = 0; i < lastKeyIndex; ++i) {
               const key = keyPath[i];
               if (!(key in obj)) {
                  obj[key] = {};
               }
               obj = obj[key];
            }
            obj[keyPath[lastKeyIndex]] = value;
         },

         _fromDataToValueObj: function (geotabData) {
            const diagName = me._locLib.idxIds[geotabData.diagnostic.id];
            const unitOfMeasure = me._locLib[diagName].unitOfMeasure;
            const valueObj = {};

            // Temperature conversions from Geotab default celcius to farenheit
            if (unitOfMeasure === "UnitOfMeasureDegreesCelsiusId") {
               valueObj.c = parseInt(geotabData.data);
               valueObj.f = me._celciusToFarenheit(parseInt(geotabData.data));
            }
            // Pressure conversions from Geotab default kPa to psi and bar
            else {
               const kpa = parseInt(geotabData.data) / 1000;
               valueObj.kpa = kpa;
               valueObj.psi = me._kpaToPsi(kpa);
               valueObj.bar = me._kpaToBa(kpa);
            }
            return valueObj;
         },

         _celciusToFarenheit: function (c) {
            return Math.round((c * 9 / 5 + 32) * 10) / 10; // Round to 1 decimal place;
         },

         _kpaToPsi: function (kpa) {
            return Math.round((kpa / 6.89475729) * 10) / 10;
         },

         _kpaToBa: function (kpa) {
            return Math.round((kpa / 100) * 10) / 10;
         },

         /**
         * _getLocFromGeotabData() Extract and store Axle/Tire loction in Object Db
         *
         * In "data" property;
         * - Axle is an increment of 1 of the HIGH order 4 bits in data byte
         *     e.g. In byte "0010 0011", 0010 or 2 + 1 = Axle 3
         * - Axle is an increment of 1 of the LOW order 4 bits in data byte
         *     e.g. In byte "0010 0011", 0011 or 3 + 1 = Tire 4
         *
         * @return {object} storing Axle/Tire loction
         */
         _getLocFromGeotabData: function (data) {
            return {
               axle: (data >> 4) + 1,
               tire: (data & 0b00001111) + 1,
            };
         },

         _extractZoneFromLoc: function (loc) {
            return loc.split("reefer temperature")[1].trim().replace("zone", "Zone");
         },

         _extractAxleFromLoc: function (loc) {
            return loc.split(":")[1].trim().replace("axle", "Axle").replace("tire", "Tire");
         },

         _buildApiCall: function (vehCmps) {
            const calls = [];
            const vehComps = vehCmps || me._devComponents.ids.split(",")[0]; // If undefined, only get tractor sensors

            for (const comp of vehComps.split(",")) {
               for (const loc of me._locLib.idxNames[comp]) {
                  const diagId = me._locLib[loc].id;
                  calls.push(["Get", {
                     typeName: "StatusData",
                     search: {
                        fromDate: me._fromDate,
                        toDate: me._toDate,
                        deviceSearch: {
                           id: me._devId
                        },
                        diagnosticSearch: {
                           id: diagId
                        }
                     }
                  }]);
               }
            }
            return calls;
         },

         _convertSecondsToHMS: function (seconds) {
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

         _locLib: {
            "idxNames": {
               "tractor": [
                  "Peripheral device: reefer temperature zone 4",
                  "Peripheral device: reefer temperature zone 2",
                  "Peripheral device: reefer temperature zone 3",
                  "Peripheral device: reefer temperature zone 1",
                  "Tire temperature: axle 4 tire 2",
                  "Tire temperature: axle 4 tire 1",
                  "Tire temperature: axle 2 tire 2",
                  "Tire temperature: axle 5 tire 1",
                  "Tire temperature: axle 8 tire 2",
                  "Tire temperature: axle 14 tire 3",
                  "Tire temperature: axle 15 tire 4",
                  "Tire temperature: axle 8 tire 3",
                  "Tire temperature: axle 10 tire 2",
                  "Tire temperature: axle 5 tire 3",
                  "Tire temperature: axle 10 tire 3",
                  "Tire temperature: axle 5 tire 2",
                  "Tire temperature: axle 13 tire 1",
                  "Tire temperature: axle 7 tire 2",
                  "Tire temperature: axle 7 tire 4",
                  "Tire temperature: axle 11 tire 3",
                  "Tire temperature: axle 14 tire 2",
                  "Tire temperature: axle 6 tire 1",
                  "Tire temperature: axle 9 tire 1",
                  "Tire temperature: axle 9 tire 2",
                  "Tire temperature: axle 9 tire 4",
                  "Tire temperature: axle 3 tire 4",
                  "Tire temperature: axle 5 tire 4",
                  "Tire temperature: axle 10 tire 1",
                  "Tire temperature: axle 7 tire 1",
                  "Tire temperature: axle 3 tire 2",
                  "Tire temperature: axle 11 tire 1",
                  "Tire temperature: axle 12 tire 4",
                  "Tire temperature: axle 15 tire 2",
                  "Tire temperature: axle 4 tire 4",
                  "Tire temperature: axle 2 tire 4",
                  "Tire temperature: axle 13 tire 3",
                  "Tire temperature: axle 8 tire 4",
                  "Tire temperature: axle 11 tire 2",
                  "Tire temperature: axle 6 tire 3",
                  "Tire temperature: axle 13 tire 4",
                  "Tire temperature: axle 1 tire 2",
                  "Tire temperature: axle 3 tire 1",
                  "Tire temperature: axle 9 tire 3",
                  "Tire temperature: axle 12 tire 3",
                  "Tire temperature: axle 13 tire 2",
                  "Tire temperature: axle 1 tire 1",
                  "Tire temperature: axle 1 tire 3",
                  "Tire temperature: axle 6 tire 2",
                  "Tire temperature: axle 12 tire 1",
                  "Tire temperature: axle 3 tire 3",
                  "Tire temperature: axle 12 tire 2",
                  "Tire temperature: axle 11 tire 4",
                  "Tire temperature: axle 8 tire 1",
                  "Tire temperature: axle 2 tire 1",
                  "Tire temperature: axle 7 tire 3",
                  "Tire temperature: axle 6 tire 4",
                  "Tire temperature: axle 15 tire 1",
                  "Tire temperature: axle 14 tire 1",
                  "Tire temperature: axle 2 tire 3",
                  "Tire temperature: axle 15 tire 3",
                  "Tire temperature: axle 4 tire 3",
                  "Tire temperature: axle 14 tire 4",
                  "Tire temperature: axle 1 tire 4",
                  "Tire temperature: axle 10 tire 4",
                  "Tire pressure: axle 15 tire 2",
                  "Tire pressure: axle 5 tire 3",
                  "Tire pressure: axle 1 tire 3",
                  "Tire pressure: axle 13 tire 1",
                  "Tire pressure: axle 14 tire 4",
                  "Tire pressure: axle 1 tire 4",
                  "Tire pressure: axle 10 tire 4",
                  "Tire pressure: axle 6 tire 3",
                  "Tire pressure: axle 2 tire 4",
                  "Tire pressure: axle 11 tire 3",
                  "Tire pressure: axle 5 tire 2",
                  "Tire pressure: axle 9 tire 4",
                  "Tire pressure: axle 13 tire 4",
                  "Tire pressure: axle 7 tire 4",
                  "Tire pressure: axle 13 tire 2",
                  "Tire pressure: axle 15 tire 4",
                  "Tire pressure: axle 4 tire 3",
                  "Tire pressure: axle 3 tire 4",
                  "Tire pressure: axle 3 tire 1",
                  "Tire pressure: axle 12 tire 1",
                  "Tire pressure: axle 7 tire 1",
                  "Tire pressure: axle 2 tire 1",
                  "Tire pressure: axle 6 tire 4",
                  "Tire pressure: axle 1 tire 2",
                  "Tire pressure: axle 5 tire 4",
                  "Tire pressure: axle 3 tire 2",
                  "Tire pressure: axle 12 tire 4",
                  "Tire pressure: axle 10 tire 1",
                  "Tire pressure: axle 8 tire 3",
                  "Tire pressure: axle 8 tire 2",
                  "Tire pressure: axle 11 tire 4",
                  "Tire pressure: axle 12 tire 3",
                  "Tire pressure: axle 6 tire 1",
                  "Tire pressure: axle 11 tire 2",
                  "Tire pressure: axle 6 tire 2",
                  "Tire pressure: axle 2 tire 2",
                  "Tire pressure: axle 5 tire 1",
                  "Tire pressure: axle 15 tire 1",
                  "Tire pressure: axle 15 tire 3",
                  "Tire pressure: axle 12 tire 2",
                  "Tire pressure: axle 9 tire 3",
                  "Tire pressure: axle 10 tire 3",
                  "Tire pressure: axle 9 tire 2",
                  "Tire pressure: axle 4 tire 2",
                  "Tire pressure: axle 14 tire 2",
                  "Tire pressure: axle 9 tire 1",
                  "Tire pressure: axle 11 tire 1",
                  "Tire pressure: axle 4 tire 4",
                  "Tire pressure: axle 7 tire 3",
                  "Tire pressure: axle 8 tire 1",
                  "Tire pressure: axle 3 tire 3",
                  "Tire pressure: axle 13 tire 3",
                  "Tire pressure: axle 2 tire 3",
                  "Tire pressure: axle 4 tire 1",
                  "Tire pressure: axle 10 tire 2",
                  "Tire pressure: axle 7 tire 2",
                  "Tire pressure: axle 14 tire 1",
                  "Tire pressure: axle 14 tire 3",
                  "Tire pressure: axle 8 tire 4",
                  "Tire pressure: axle 1 tire 1"
               ],

               "trailer1": [
                  "Peripheral device tire temperature: trailer 1 axle 4 tire 3",
                  "Peripheral device tire temperature: trailer 1 axle 3 tire 2",
                  "Peripheral device tire temperature: trailer 1 axle 4 tire 4",
                  "Peripheral device tire temperature: trailer 1 axle 2 tire 1",
                  "Peripheral device tire temperature: trailer 1 axle 4 tire 1",
                  "Peripheral device tire temperature: trailer 1 axle 5 tire 1",
                  "Peripheral device tire temperature: trailer 1 axle 1 tire 4",
                  "Peripheral device tire temperature: trailer 1 axle 5 tire 2",
                  "Peripheral device tire temperature: trailer 1 axle 2 tire 2",
                  "Peripheral device tire temperature: trailer 1 axle 1 tire 3",
                  "Peripheral device tire temperature: trailer 1 axle 6 tire 1",
                  "Peripheral device tire temperature: trailer 1 axle 2 tire 4",
                  "Peripheral device tire temperature: trailer 1 axle 6 tire 2",
                  "Peripheral device tire temperature: trailer 1 axle 2 tire 3",
                  "Peripheral device tire temperature: trailer 1 axle 1 tire 1",
                  "Peripheral device tire temperature: trailer 1 axle 1 tire 2",
                  "Peripheral device tire temperature: trailer 1 axle 5 tire 4",
                  "Peripheral device tire temperature: trailer 1 axle 5 tire 3",
                  "Peripheral device tire temperature: trailer 1 axle 3 tire 3",
                  "Peripheral device tire temperature: trailer 1 axle 3 tire 4",
                  "Peripheral device tire temperature: trailer 1 axle 6 tire 3",
                  "Peripheral device tire temperature: trailer 1 axle 3 tire 1",
                  "Peripheral device tire temperature: trailer 1 axle 4 tire 2",
                  "Peripheral device tire temperature: trailer 1 axle 6 tire 4",
                  "Peripheral device tire pressure: trailer 1 axle 4 tire 4",
                  "Peripheral device tire pressure: trailer 1 axle 1 tire 1",
                  "Peripheral device tire pressure: trailer 1 axle 5 tire 2",
                  "Peripheral device tire pressure: trailer 1 axle 1 tire 2",
                  "Peripheral device tire pressure: trailer 1 axle 2 tire 3",
                  "Peripheral device tire pressure: trailer 1 axle 1 tire 4",
                  "Peripheral device tire pressure: trailer 1 axle 3 tire 3",
                  "Peripheral device tire pressure: trailer 1 axle 5 tire 1",
                  "Peripheral device tire pressure: trailer 1 axle 6 tire 2",
                  "Peripheral device tire pressure: trailer 1 axle 3 tire 2",
                  "Peripheral device tire pressure: trailer 1 axle 4 tire 3",
                  "Peripheral device tire pressure: trailer 1 axle 6 tire 3",
                  "Peripheral device tire pressure: trailer 1 axle 5 tire 4",
                  "Peripheral device tire pressure: trailer 1 axle 1 tire 3",
                  "Peripheral device tire pressure: trailer 1 axle 2 tire 1",
                  "Peripheral device tire pressure: trailer 1 axle 5 tire 3",
                  "Peripheral device tire pressure: trailer 1 axle 3 tire 4",
                  "Peripheral device tire pressure: trailer 1 axle 2 tire 4",
                  "Peripheral device tire pressure: trailer 1 axle 6 tire 4",
                  "Peripheral device tire pressure: trailer 1 axle 6 tire 1",
                  "Peripheral device tire pressure: trailer 1 axle 2 tire 2",
                  "Peripheral device tire pressure: trailer 1 axle 4 tire 1",
                  "Peripheral device tire pressure: trailer 1 axle 3 tire 1",
                  "Peripheral device tire pressure: trailer 1 axle 4 tire 2"
               ],

               "trailer2": [
                  "Peripheral device tire temperature: trailer 2 axle 5 tire 3",
                  "Peripheral device tire temperature: trailer 2 axle 3 tire 4",
                  "Peripheral device tire temperature: trailer 2 axle 4 tire 1",
                  "Peripheral device tire temperature: trailer 2 axle 6 tire 3",
                  "Peripheral device tire temperature: trailer 2 axle 2 tire 1",
                  "Peripheral device tire temperature: trailer 2 axle 1 tire 4",
                  "Peripheral device tire temperature: trailer 2 axle 2 tire 3",
                  "Peripheral device tire temperature: trailer 2 axle 3 tire 3",
                  "Peripheral device tire temperature: trailer 2 axle 3 tire 2",
                  "Peripheral device tire temperature: trailer 2 axle 6 tire 2",
                  "Peripheral device tire temperature: trailer 2 axle 1 tire 2",
                  "Peripheral device tire temperature: trailer 2 axle 2 tire 2",
                  "Peripheral device tire temperature: trailer 2 axle 4 tire 2",
                  "Peripheral device tire temperature: trailer 2 axle 6 tire 1",
                  "Peripheral device tire temperature: trailer 2 axle 1 tire 3",
                  "Peripheral device tire temperature: trailer 2 axle 6 tire 4",
                  "Peripheral device tire temperature: trailer 2 axle 3 tire 1",
                  "Peripheral device tire temperature: trailer 2 axle 5 tire 4",
                  "Peripheral device tire temperature: trailer 2 axle 4 tire 3",
                  "Peripheral device tire temperature: trailer 2 axle 2 tire 4",
                  "Peripheral device tire temperature: trailer 2 axle 5 tire 2",
                  "Peripheral device tire temperature: trailer 2 axle 4 tire 4",
                  "Peripheral device tire temperature: trailer 2 axle 1 tire 1",
                  "Peripheral device tire temperature: trailer 2 axle 5 tire 1",
                  "Peripheral device tire pressure: trailer 2 axle 3 tire 2",
                  "Peripheral device tire pressure: trailer 2 axle 5 tire 1",
                  "Peripheral device tire pressure: trailer 2 axle 2 tire 4",
                  "Peripheral device tire pressure: trailer 2 axle 4 tire 3",
                  "Peripheral device tire pressure: trailer 2 axle 5 tire 4",
                  "Peripheral device tire pressure: trailer 2 axle 6 tire 2",
                  "Peripheral device tire pressure: trailer 2 axle 5 tire 3",
                  "Peripheral device tire pressure: trailer 2 axle 1 tire 3",
                  "Peripheral device tire pressure: trailer 2 axle 1 tire 2",
                  "Peripheral device tire pressure: trailer 2 axle 4 tire 2",
                  "Peripheral device tire pressure: trailer 2 axle 1 tire 1",
                  "Peripheral device tire pressure: trailer 2 axle 2 tire 3",
                  "Peripheral device tire pressure: trailer 2 axle 3 tire 4",
                  "Peripheral device tire pressure: trailer 2 axle 6 tire 4",
                  "Peripheral device tire pressure: trailer 2 axle 4 tire 4",
                  "Peripheral device tire pressure: trailer 2 axle 6 tire 3",
                  "Peripheral device tire pressure: trailer 2 axle 3 tire 1",
                  "Peripheral device tire pressure: trailer 2 axle 2 tire 2",
                  "Peripheral device tire pressure: trailer 2 axle 5 tire 2",
                  "Peripheral device tire pressure: trailer 2 axle 4 tire 1",
                  "Peripheral device tire pressure: trailer 2 axle 2 tire 1",
                  "Peripheral device tire pressure: trailer 2 axle 1 tire 4",
                  "Peripheral device tire pressure: trailer 2 axle 3 tire 3",
                  "Peripheral device tire pressure: trailer 2 axle 6 tire 1"
               ],

               "trailer3": [
                  "Peripheral device tire temperature: trailer 3 axle 1 tire 4",
                  "Peripheral device tire temperature: trailer 3 axle 5 tire 2",
                  "Peripheral device tire temperature: trailer 3 axle 3 tire 4",
                  "Peripheral device tire temperature: trailer 3 axle 2 tire 4",
                  "Peripheral device tire temperature: trailer 3 axle 5 tire 4",
                  "Peripheral device tire temperature: trailer 3 axle 2 tire 1",
                  "Peripheral device tire temperature: trailer 3 axle 3 tire 3",
                  "Peripheral device tire temperature: trailer 3 axle 1 tire 2",
                  "Peripheral device tire temperature: trailer 3 axle 5 tire 1",
                  "Peripheral device tire temperature: trailer 3 axle 6 tire 4",
                  "Peripheral device tire temperature: trailer 3 axle 3 tire 1",
                  "Peripheral device tire temperature: trailer 3 axle 6 tire 2",
                  "Peripheral device tire temperature: trailer 3 axle 3 tire 2",
                  "Peripheral device tire temperature: trailer 3 axle 5 tire 3",
                  "Peripheral device tire temperature: trailer 3 axle 6 tire 1",
                  "Peripheral device tire temperature: trailer 3 axle 4 tire 2",
                  "Peripheral device tire temperature: trailer 3 axle 4 tire 4",
                  "Peripheral device tire temperature: trailer 3 axle 1 tire 1",
                  "Peripheral device tire temperature: trailer 3 axle 2 tire 3",
                  "Peripheral device tire temperature: trailer 3 axle 6 tire 3",
                  "Peripheral device tire temperature: trailer 3 axle 2 tire 2",
                  "Peripheral device tire temperature: trailer 3 axle 4 tire 1",
                  "Peripheral device tire temperature: trailer 3 axle 4 tire 3",
                  "Peripheral device tire temperature: trailer 3 axle 1 tire 3",
                  "Peripheral device tire pressure: trailer 3 axle 6 tire 2",
                  "Peripheral device tire pressure: trailer 3 axle 1 tire 4",
                  "Peripheral device tire pressure: trailer 3 axle 4 tire 1",
                  "Peripheral device tire pressure: trailer 3 axle 3 tire 3",
                  "Peripheral device tire pressure: trailer 3 axle 4 tire 2",
                  "Peripheral device tire pressure: trailer 3 axle 1 tire 3",
                  "Peripheral device tire pressure: trailer 3 axle 5 tire 1",
                  "Peripheral device tire pressure: trailer 3 axle 6 tire 3",
                  "Peripheral device tire pressure: trailer 3 axle 5 tire 4",
                  "Peripheral device tire pressure: trailer 3 axle 2 tire 2",
                  "Peripheral device tire pressure: trailer 3 axle 5 tire 3",
                  "Peripheral device tire pressure: trailer 3 axle 1 tire 1",
                  "Peripheral device tire pressure: trailer 3 axle 4 tire 3",
                  "Peripheral device tire pressure: trailer 3 axle 2 tire 1",
                  "Peripheral device tire pressure: trailer 3 axle 4 tire 4",
                  "Peripheral device tire pressure: trailer 3 axle 2 tire 4",
                  "Peripheral device tire pressure: trailer 3 axle 3 tire 2",
                  "Peripheral device tire pressure: trailer 3 axle 1 tire 2",
                  "Peripheral device tire pressure: trailer 3 axle 5 tire 2",
                  "Peripheral device tire pressure: trailer 3 axle 3 tire 4",
                  "Peripheral device tire pressure: trailer 3 axle 2 tire 3",
                  "Peripheral device tire pressure: trailer 3 axle 6 tire 1",
                  "Peripheral device tire pressure: trailer 3 axle 6 tire 4",
                  "Peripheral device tire pressure: trailer 3 axle 3 tire 1"
               ]
            },
            "idxIds": {

               /* TempTrac */
               "DiagnosticReeferTemperatureZone4Id": "Peripheral device: reefer temperature zone 4",
               "DiagnosticReeferTemperatureZone2Id": "Peripheral device: reefer temperature zone 2",
               "DiagnosticReeferTemperatureZone3Id": "Peripheral device: reefer temperature zone 3",
               "DiagnosticReeferTemperatureZone1Id": "Peripheral device: reefer temperature zone 1",

               /* Tractor */
               "af-aART3R20iqTABMMuOQug": "Tire temperature: axle 4 tire 2",
               "aJ5BZCAIRcUOtSQU2ah125Q": "Tire temperature: axle 4 tire 1",
               "aJ6V9PwpaWEK6YwvKSLxuDg": "Tire temperature: axle 2 tire 2",
               "afTvCGj0LME2nPQ_yi6Zprg": "Tire temperature: axle 5 tire 1",
               "awgE9H0owikaNhxQp-8ORrg": "Tire temperature: axle 8 tire 2",
               "a_QqQSc7prEmssBy2cr4GiQ": "Tire temperature: axle 14 tire 3",
               "acHLkVisytUqE-SFYpyke-Q": "Tire temperature: axle 15 tire 4",
               "aksQyj4DQBky5HyURZiKYwg": "Tire temperature: axle 8 tire 3",
               "aSLXud_CMGEiskiVrUGfDZw": "Tire temperature: axle 10 tire 2",
               "a1hqxUSZzJ0S2JyYEyo_VeQ": "Tire temperature: axle 5 tire 3",
               "abmqqxx7dREm4XCdaJagnKw": "Tire temperature: axle 10 tire 3",
               "a1-Xqquf_Pk2BLTSnpF2OLw": "Tire temperature: axle 5 tire 2",
               "anVIOrFs7-UC7rjVos2KK0w": "Tire temperature: axle 13 tire 1",
               "aR1xLRYgjQ0ilhjk5Af9ijQ": "Tire temperature: axle 7 tire 2",
               "aCIDQe8BU90KbPzprepe2pA": "Tire temperature: axle 7 tire 4",
               "aj0WbeSf22U-D90H53AUPGw": "Tire temperature: axle 11 tire 3",
               "aMcfoAqAI_0qftES-nOkdXg": "Tire temperature: axle 14 tire 2",
               "a2DB7ykkjnEmPsEUM8ax4Qw": "Tire temperature: axle 6 tire 1",
               "a7hDn0EY6kk-LJUhgheNKgw": "Tire temperature: axle 9 tire 1",
               "a_x2ggICa9EaLmUmijtxVxw": "Tire temperature: axle 9 tire 2",
               "aySNM1EiJRUW5c0m_2MNk_Q": "Tire temperature: axle 9 tire 4",
               "a5zQnIKLK1EGJc0y74FM76Q": "Tire temperature: axle 3 tire 4",
               "auMikJD79gk-SaVPlRyg0Cg": "Tire temperature: axle 5 tire 4",
               "aKe_wiJuqJE2jNV0ihv4eeA": "Tire temperature: axle 10 tire 1",
               "azHJzyul44Um0gmMP5OKW8g": "Tire temperature: axle 7 tire 1",
               "a3_U0ud3wbkKNvGRSVJATOg": "Tire temperature: axle 3 tire 2",
               "adq1VIj3Mbk-ZKmYOnn5Djw": "Tire temperature: axle 11 tire 1",
               "atHQLX-xXBEalP2aOLb2cNA": "Tire temperature: axle 12 tire 4",
               "a_IYsTjcEMEm762d24DFUdA": "Tire temperature: axle 15 tire 2",
               "afGmJoFp5M02mSmv6iumwfQ": "Tire temperature: axle 4 tire 4",
               "alXGwTauFBkq48G840Hni1g": "Tire temperature: axle 2 tire 4",
               "aoMlYiDcBlk-cPnLliFLTtw": "Tire temperature: axle 13 tire 3",
               "ajMeii2CJykmBHHNtskGPyQ": "Tire temperature: axle 8 tire 4",
               "afbN7sX31KEqhoHTZAIKFnw": "Tire temperature: axle 11 tire 2",
               "apPupKJzE6Um-PHd2-XGVbQ": "Tire temperature: axle 6 tire 3",
               "arrO0vmDWZEOIFnfLvRMxkQ": "Tire temperature: axle 13 tire 4",
               "a1ZcS5E35KkOVBXxcqSCihQ": "Tire temperature: axle 1 tire 2",
               "a2Sj4el_ot0akRIAFB3j3dA": "Tire temperature: axle 3 tire 1",
               "amhgewWRlz0e8M4VA1o1tkQ": "Tire temperature: axle 9 tire 3",
               "aV00Fh2yuRk2a-pCjfLbOAQ": "Tire temperature: axle 12 tire 3",
               "aGv5W2jGib0qGmZFTthHqxg": "Tire temperature: axle 13 tire 2",
               "aMc7Tbwr7oEG_65ZlQIhe8A": "Tire temperature: axle 1 tire 1",
               "ayIh-pPu-BUyW35gJQDE-eQ": "Tire temperature: axle 1 tire 3",
               "alIBMrLvBRkGoJZwLXT4aNA": "Tire temperature: axle 6 tire 2",
               "a-Z4vcpJrK0OcAZ4JV5-DUA": "Tire temperature: axle 12 tire 1",
               "ahQIxeVmRhUWwja1X5JWRmw": "Tire temperature: axle 3 tire 3",
               "aPtrBlvZnR0GGJbSgpf7YtA": "Tire temperature: axle 12 tire 2",
               "aSEhZa5CWvEWFPLorvUtl9A": "Tire temperature: axle 11 tire 4",
               "aVyx_amL1G067I7yelZtTqg": "Tire temperature: axle 8 tire 1",
               "aB1AI1v7VZEuEpL9DL2pX5w": "Tire temperature: axle 2 tire 1",
               "aJcg4DnM3AUaZQc-dTwheRA": "Tire temperature: axle 7 tire 3",
               "aRQu7NYg_rUykKdD5aLB3Tg": "Tire temperature: axle 6 tire 4",
               "avTVfxhYRP0K5Fdf2UnmVFw": "Tire temperature: axle 15 tire 1",
               "aN8DkqeyfYkGUZdmBUqL7WA": "Tire temperature: axle 14 tire 1",
               "ajfPPsCzHZkOMSeHqdB122g": "Tire temperature: axle 2 tire 3",
               "aE05ArsMmmUizi-yBlxGGpg": "Tire temperature: axle 15 tire 3",
               "ajbFDc7c6PUCLMu1BJUKdYQ": "Tire temperature: axle 4 tire 3",
               "awF7driK_DEKXY_Kmt1i0mg": "Tire temperature: axle 14 tire 4",
               "aDO8NxWx690S8VPvFn45NJA": "Tire temperature: axle 1 tire 4",
               "aweRcCBktTESBkI4aIIaVxg": "Tire temperature: axle 10 tire 4",
               "afymkm9jH_0m_gAZkB2YY7w": "Tire pressure: axle 15 tire 2",
               "aS59DbXj9VUeHZw0A81Y5TA": "Tire pressure: axle 5 tire 3",
               "ammSx3EpAVEWFRA4yst8hGA": "Tire pressure: axle 1 tire 3",
               "aUPhXzwOWIkCmEBKvkVg5Zw": "Tire pressure: axle 13 tire 1",
               "alHeD6taYXEuH3yCaQQ8R-A": "Tire pressure: axle 14 tire 4",
               "aDTv46qmi302XziRVk7SOYw": "Tire pressure: axle 1 tire 4",
               "aaw36-92yaUuzvCZoKoiD9g": "Tire pressure: axle 10 tire 4",
               "ahx9K_344rU6qFilQAF6Esg": "Tire pressure: axle 6 tire 3",
               "aDHfNLzHx0USy7isxSHgT1Q": "Tire pressure: axle 2 tire 4",
               "axLqNDg3AF0u4bi4N79kc3g": "Tire pressure: axle 11 tire 3",
               "aPww5uoVhKEC7sy5wxF4tbQ": "Tire pressure: axle 5 tire 2",
               "aBnIGO8z_BUuqpjfvsIW80g": "Tire pressure: axle 9 tire 4",
               "aeo9W40sUCUK5hUKmWWuUWg": "Tire pressure: axle 13 tire 4",
               "aWD9ZUNd75kCacEXe4bN97A": "Tire pressure: axle 7 tire 4",
               "avpBdnkY5hUqCIEdFINDRPA": "Tire pressure: axle 13 tire 2",
               "aTFYkXEL8c0eYh1QXFqZCzw": "Tire pressure: axle 15 tire 4",
               "aubbIscaJzEKptmBPdkmukA": "Tire pressure: axle 4 tire 3",
               "aucGvS2b7GE2eBWJptDcQTQ": "Tire pressure: axle 3 tire 4",
               "aHuKjEY6QYEGRXmat21HiFg": "Tire pressure: axle 3 tire 1",
               "azXrGzYd0v0iNR2f1eYxZrw": "Tire pressure: axle 12 tire 1",
               "au2spF4W84E2-12mLeyzC9A": "Tire pressure: axle 7 tire 1",
               "a5OQtfETMnEeVAms6MINtMQ": "Tire pressure: axle 2 tire 1",
               "aGQz-0014q0qQuGzLGcjzHw": "Tire pressure: axle 6 tire 4",
               "aWh7GmzEY20aZA3C4KSBZuA": "Tire pressure: axle 1 tire 2",
               "arJxAG_FB00GwM3N00Y6Whw": "Tire pressure: axle 5 tire 4",
               "aXLrB8-L0kkWwJXrnEdPYvQ": "Tire pressure: axle 3 tire 2",
               "awQIRTYlQx02Zl3v9HUrGjQ": "Tire pressure: axle 12 tire 4",
               "az5qzThnBY0KSMnwnNyvNkQ": "Tire pressure: axle 10 tire 1",
               "ap8APxcA9sk--x3_taAerkQ": "Tire pressure: axle 8 tire 3",
               "aPnpH0F0JQ0q6coWjTvgqHg": "Tire pressure: axle 8 tire 2",
               "aS75tKaxbRE-5K4ZVNTFbWg": "Tire pressure: axle 11 tire 4",
               "aCzHq1tPPBkSxO4mqKYxL_A": "Tire pressure: axle 12 tire 3",
               "aXIP7a0nEgU6dxZGxGBXbSw": "Tire pressure: axle 6 tire 1",
               "a9K-yD73p7UelSZLahVvXSw": "Tire pressure: axle 11 tire 2",
               "at8jmyXzYGEmpo5LurduU_w": "Tire pressure: axle 6 tire 2",
               "aYT21qD9lUkydm5SNLVP2Kw": "Tire pressure: axle 2 tire 2",
               "a4hVw9GtnN06ClZbBbuJ_1A": "Tire pressure: axle 5 tire 1",
               "aaN_Fa-6luECCbJc82AF1tA": "Tire pressure: axle 15 tire 1",
               "aKXS14K7z9EmkUaPJzw-_RA": "Tire pressure: axle 15 tire 3",
               "a1dfQ-q5ZRkOMuanRgvu57A": "Tire pressure: axle 12 tire 2",
               "aaHc0-gOrWECbEq4qg02B-A": "Tire pressure: axle 9 tire 3",
               "aLQakfX7fFEWfCrAdE7SI7g": "Tire pressure: axle 10 tire 3",
               "aSB58Wc8x1k-cjLKT5BVSQA": "Tire pressure: axle 9 tire 2",
               "a6uqOJv4P2EKQo7oBzHckrQ": "Tire pressure: axle 4 tire 2",
               "arq0jP0jTIE-STLy_Irs-Kw": "Tire pressure: axle 14 tire 2",
               "aV8WCZOe8Jkynz797aav7WQ": "Tire pressure: axle 9 tire 1",
               "acckG84GvXkC94sejQz44Hw": "Tire pressure: axle 11 tire 1",
               "a_wS1PWcq70aVdMoGNy676Q": "Tire pressure: axle 4 tire 4",
               "aONK3kCogOUuIGdS8hhKGiA": "Tire pressure: axle 7 tire 3",
               "aPem32mhR7EmN19W6eD3M8Q": "Tire pressure: axle 8 tire 1",
               "ajN885q748kueWd0nNFtatA": "Tire pressure: axle 3 tire 3",
               "aM8CUZ103VkuKfuS0wmGYPQ": "Tire pressure: axle 13 tire 3",
               "aqnMOJwje1kmfBOwBqj0zLQ": "Tire pressure: axle 2 tire 3",
               "arRAX2-GlvEO5JOzrOW0Nyg": "Tire pressure: axle 4 tire 1",
               "aKt5ITkO4kkOKJ_JTuocMmA": "Tire pressure: axle 10 tire 2",
               "ayc0vUJCH00qTpvMb6SH59w": "Tire pressure: axle 7 tire 2",
               "aj1hqGeelsUWOyPWLFvUs8Q": "Tire pressure: axle 14 tire 1",
               "aevn4KPf8bkCJWP5L3mQKAw": "Tire pressure: axle 14 tire 3",
               "aIBxsSTHMPUGFY__OvOEqCg": "Tire pressure: axle 8 tire 4",
               "axw5pat2bp0ueRduqcJi2KQ": "Tire pressure: axle 1 tire 1",

               /* Trailer 1 */
               "av-7nmyzSDEiBcRDpax9XwQ": "Peripheral device tire temperature: trailer 1 axle 4 tire 3",
               "a8W8XrBk65ECpIiSHQrdwpQ": "Peripheral device tire temperature: trailer 1 axle 3 tire 2",
               "a3-guntvtCkKXXimdgESeBw": "Peripheral device tire temperature: trailer 1 axle 4 tire 4",
               "ab4_iJdiZjkSi9iywGGgDJA": "Peripheral device tire temperature: trailer 1 axle 2 tire 1",
               "aeNBT3_JzWUqoDzot_VVymg": "Peripheral device tire temperature: trailer 1 axle 4 tire 1",
               "aio8G6xm0T0-m6D64eiXq8w": "Peripheral device tire temperature: trailer 1 axle 5 tire 1",
               "aSx4sxJmSXEi07kcDyRKDsw": "Peripheral device tire temperature: trailer 1 axle 1 tire 4",
               "aJ7REd1YJykupdUhUB4Uezw": "Peripheral device tire temperature: trailer 1 axle 5 tire 2",
               "ameT6maBOAkaDtlEnFgJq_Q": "Peripheral device tire temperature: trailer 1 axle 2 tire 2",
               "aR1pR_4OjV0eowFjfY-SasA": "Peripheral device tire temperature: trailer 1 axle 1 tire 3",
               "ahYYp6qyrU0y7fHwQ5lxnbQ": "Peripheral device tire temperature: trailer 1 axle 6 tire 1",
               "azVdLjnyM1Eupzn8O5vaxtA": "Peripheral device tire temperature: trailer 1 axle 2 tire 4",
               "alg5yGb5ZEkaTnIlsEwTghg": "Peripheral device tire temperature: trailer 1 axle 6 tire 2",
               "aD5jFsDFrGUapTIotvp_GRQ": "Peripheral device tire temperature: trailer 1 axle 2 tire 3",
               "ablV8lrsvDkeiWpnI2QfMPg": "Peripheral device tire temperature: trailer 1 axle 1 tire 1",
               "avkkKzpSD50il7J5qmNsIFg": "Peripheral device tire temperature: trailer 1 axle 1 tire 2",
               "ae0Lk1q9LZEOO66X4YwWkow": "Peripheral device tire temperature: trailer 1 axle 5 tire 4",
               "afZEy_7Am906-LLC4W6xuUQ": "Peripheral device tire temperature: trailer 1 axle 5 tire 3",
               "aw_VEhum4V0qzZbOj1ZH8Pg": "Peripheral device tire temperature: trailer 1 axle 3 tire 3",
               "avfJ95BT-NEyTUbihRKXw5w": "Peripheral device tire temperature: trailer 1 axle 3 tire 4",
               "ac98h3XY4lkqBgsykqqw9dg": "Peripheral device tire temperature: trailer 1 axle 6 tire 3",
               "av0Wwrr13z0mtn9Cbz91txw": "Peripheral device tire temperature: trailer 1 axle 3 tire 1",
               "aNpE8SrX61kmi7vefI82ldw": "Peripheral device tire temperature: trailer 1 axle 4 tire 2",
               "aaM2YzIHm4UySm_tI0c3JrA": "Peripheral device tire temperature: trailer 1 axle 6 tire 4",
               "aoXL-czVSe0aFrwEKAUgpSQ": "Peripheral device tire pressure: trailer 1 axle 4 tire 4",
               "aiImdaxpyOUOqHgYiIq9Pdg": "Peripheral device tire pressure: trailer 1 axle 1 tire 1",
               "a558xfocfOkqq0RGif3PYkA": "Peripheral device tire pressure: trailer 1 axle 5 tire 2",
               "anGN3cyDOU0-a7xXDZC9FlA": "Peripheral device tire pressure: trailer 1 axle 1 tire 2",
               "a2aQWL9vbIEaFtjOIygXpNw": "Peripheral device tire pressure: trailer 1 axle 2 tire 3",
               "alTF5vGqw8UKeSUIRQKwyhA": "Peripheral device tire pressure: trailer 1 axle 1 tire 4",
               "aYnZufXXYcEm060ZK4tzbww": "Peripheral device tire pressure: trailer 1 axle 3 tire 3",
               "altKk6qgEqkSCqVNv26HKMw": "Peripheral device tire pressure: trailer 1 axle 5 tire 1",
               "aqfLL9jojEEuRBVVoOnnMvw": "Peripheral device tire pressure: trailer 1 axle 6 tire 2",
               "aMf4Mfu2RPkmtN2C4s_yy6g": "Peripheral device tire pressure: trailer 1 axle 3 tire 2",
               "aN6xyABRxyU6TnWWGCo48lw": "Peripheral device tire pressure: trailer 1 axle 4 tire 3",
               "aShus-gSfSkS8DWbKTFquew": "Peripheral device tire pressure: trailer 1 axle 6 tire 3",
               "aOtviSvi0hUm7-2trnI8wAw": "Peripheral device tire pressure: trailer 1 axle 5 tire 4",
               "aOzYhibYm8Uuyj3bl18lP8w": "Peripheral device tire pressure: trailer 1 axle 1 tire 3",
               "aiUOCYsLw-UuMKXhrzWYNiw": "Peripheral device tire pressure: trailer 1 axle 2 tire 1",
               "an9aZLqd5uEyGaX5Qo9xSmw": "Peripheral device tire pressure: trailer 1 axle 5 tire 3",
               "aBXb6Hcojuku-uItx7iSCOA": "Peripheral device tire pressure: trailer 1 axle 3 tire 4",
               "aur1cwwirIk-ym434gRLBVA": "Peripheral device tire pressure: trailer 1 axle 2 tire 4",
               "a49vpNDRQoEG50ZdK2p_rXQ": "Peripheral device tire pressure: trailer 1 axle 6 tire 4",
               "aUwmJiXOXMEGHoKstyej0nA": "Peripheral device tire pressure: trailer 1 axle 6 tire 1",
               "a4SQvHuXgm0qdAa9XMhI5pQ": "Peripheral device tire pressure: trailer 1 axle 2 tire 2",
               "ar20m0c8XM0qGYriVvG7d1A": "Peripheral device tire pressure: trailer 1 axle 4 tire 1",
               "agJKt4tlDQ0WbpfUQQ3bGew": "Peripheral device tire pressure: trailer 1 axle 3 tire 1",
               "ar5iByUEFz0SyJf6Q9BfJtQ": "Peripheral device tire pressure: trailer 1 axle 4 tire 2",

               /* Trailer 2 */
               "agKc5_RtImUOx6AYqAlvt-Q": "Peripheral device tire temperature: trailer 2 axle 5 tire 3",
               "a99JAnc5DuEqPdgvELZvgDw": "Peripheral device tire temperature: trailer 2 axle 3 tire 4",
               "aPOlQSZzorkSlNQzgUop9ZQ": "Peripheral device tire temperature: trailer 2 axle 4 tire 1",
               "aHwFNTYYCzECYpBgbNIznww": "Peripheral device tire temperature: trailer 2 axle 6 tire 3",
               "agpC-PvnSJkW_5ikoOg0WIw": "Peripheral device tire temperature: trailer 2 axle 2 tire 1",
               "aI1bKcTKLukOraSrnmJ-7cg": "Peripheral device tire temperature: trailer 2 axle 1 tire 4",
               "adeC918cOXkSNvzZwGVwqGw": "Peripheral device tire temperature: trailer 2 axle 2 tire 3",
               "a8mJwVfLLIEGgNDxZaTfNbw": "Peripheral device tire temperature: trailer 2 axle 3 tire 3",
               "a5RV-FSl0BU2B4UVrhY6FsQ": "Peripheral device tire temperature: trailer 2 axle 3 tire 2",
               "aT08_83KvnE2dEEfLgcan8w": "Peripheral device tire temperature: trailer 2 axle 6 tire 2",
               "aTtkuUj7060ikMkjXseUgOw": "Peripheral device tire temperature: trailer 2 axle 1 tire 2",
               "adxBetWHIKkaG3V_ph_BhyQ": "Peripheral device tire temperature: trailer 2 axle 2 tire 2",
               "aI8uO2CQ6A0iaD3acPRBKAA": "Peripheral device tire temperature: trailer 2 axle 4 tire 2",
               "aDYQobqlAl0m4xH4oUNl1EQ": "Peripheral device tire temperature: trailer 2 axle 6 tire 1",
               "aqSYLGYDvjEKnIZQTqLTuLw": "Peripheral device tire temperature: trailer 2 axle 1 tire 3",
               "aIqlzThBFFEqwM5i-pqzSWg": "Peripheral device tire temperature: trailer 2 axle 6 tire 4",
               "aOf5V0c5KvEKXPa2uQ9o9qg": "Peripheral device tire temperature: trailer 2 axle 3 tire 1",
               "aYEpdhJGKOUSBdb9v1Lbj4A": "Peripheral device tire temperature: trailer 2 axle 5 tire 4",
               "aLdCVnDVWa0GGk8hre-mCtA": "Peripheral device tire temperature: trailer 2 axle 4 tire 3",
               "a6RpYQEXpnk6XKcsVRhtY3Q": "Peripheral device tire temperature: trailer 2 axle 2 tire 4",
               "aiJy_8EYUg0WF4tf1i2qGfQ": "Peripheral device tire temperature: trailer 2 axle 5 tire 2",
               "ag8dvMYb3s02Ndd0Qec8HiQ": "Peripheral device tire temperature: trailer 2 axle 4 tire 4",
               "araR8mswfs06ZH-v-XJAf2w": "Peripheral device tire temperature: trailer 2 axle 1 tire 1",
               "aQerXJeXJikO5uvUzeZjAPQ": "Peripheral device tire temperature: trailer 2 axle 5 tire 1",
               "aIphJmTIEvUKbnwszf6RYhQ": "Peripheral device tire pressure: trailer 2 axle 3 tire 2",
               "azA4EGYVH6kenmA3ccqzeXg": "Peripheral device tire pressure: trailer 2 axle 5 tire 1",
               "a-MeuiogirUureBeU_XpaDA": "Peripheral device tire pressure: trailer 2 axle 2 tire 4",
               "aSr8VyEKyd0-qAhoqbmP7QA": "Peripheral device tire pressure: trailer 2 axle 4 tire 3",
               "aq62nuOT02UqIkh3Qb01O2A": "Peripheral device tire pressure: trailer 2 axle 5 tire 4",
               "a5C45BLPEREeQEx_KnV4t7g": "Peripheral device tire pressure: trailer 2 axle 6 tire 2",
               "aIZx8fruMlkiXwTFdZKB02A": "Peripheral device tire pressure: trailer 2 axle 5 tire 3",
               "aqxP_I0DPqEOE-T2iMgcUfw": "Peripheral device tire pressure: trailer 2 axle 1 tire 3",
               "aKIHzl1Or50eKL0kys3wZOg": "Peripheral device tire pressure: trailer 2 axle 1 tire 2",
               "a9NB2cZXS90iHPlzgVqjudA": "Peripheral device tire pressure: trailer 2 axle 4 tire 2",
               "anivGk3NBq0WuYWRFsA8i-g": "Peripheral device tire pressure: trailer 2 axle 1 tire 1",
               "aRjLg1djVFES9Am9LtfY_Kg": "Peripheral device tire pressure: trailer 2 axle 2 tire 3",
               "aFj5MS5cupUeNMW_GYlNGgQ": "Peripheral device tire pressure: trailer 2 axle 3 tire 4",
               "ayBB61Dsaa0WfpXoG8ycvpw": "Peripheral device tire pressure: trailer 2 axle 6 tire 4",
               "a9c9yPQ0deEmGPomSDFL6nQ": "Peripheral device tire pressure: trailer 2 axle 4 tire 4",
               "aLxkwNTgtbUa0d7SptpEqaA": "Peripheral device tire pressure: trailer 2 axle 6 tire 3",
               "a6IiOvOrMLUWb6LgS3t6FBA": "Peripheral device tire pressure: trailer 2 axle 3 tire 1",
               "aue4KnLeXXU-vRr3A8Dlkng": "Peripheral device tire pressure: trailer 2 axle 2 tire 2",
               "aOVj04lzzsEiBUb7okAkb2w": "Peripheral device tire pressure: trailer 2 axle 5 tire 2",
               "aRk-QrHUlCkGaWL_8wL7kzg": "Peripheral device tire pressure: trailer 2 axle 4 tire 1",
               "arVA95TeSZkqOxMDz6ekQJQ": "Peripheral device tire pressure: trailer 2 axle 2 tire 1",
               "aRTwuV8X1qEKlWdO6o4SHBA": "Peripheral device tire pressure: trailer 2 axle 1 tire 4",
               "aUe4D3OsNhE27OfWNae8gIA": "Peripheral device tire pressure: trailer 2 axle 3 tire 3",
               "aeTuqJroVW0WsPPnBqGcwLg": "Peripheral device tire pressure: trailer 2 axle 6 tire 1",

               /* Trailer 3 */
               "ab2Fqg2bNbUeoOQIV4BTagQ": "Peripheral device tire temperature: trailer 3 axle 1 tire 4",
               "awEAqh8jieEKU0AWpFLE9Jg": "Peripheral device tire temperature: trailer 3 axle 5 tire 2",
               "araMSRvJd0kG9ECEeVa_aTg": "Peripheral device tire temperature: trailer 3 axle 3 tire 4",
               "a_bLviqmfikeQMCRl4YjwwA": "Peripheral device tire temperature: trailer 3 axle 2 tire 4",
               "aCykppg1KK0CX1DRiPH5Y_g": "Peripheral device tire temperature: trailer 3 axle 5 tire 4",
               "aiYrrhzrvVUG3bUXXWOwpXw": "Peripheral device tire temperature: trailer 3 axle 2 tire 1",
               "aFlrw9w5Yl0q-x0lSr6d-KQ": "Peripheral device tire temperature: trailer 3 axle 3 tire 3",
               "aF7y6hQj_BUKiP1NpbvstjQ": "Peripheral device tire temperature: trailer 3 axle 1 tire 2",
               "aNkfmmDIDwkiXoHs9l8fOrQ": "Peripheral device tire temperature: trailer 3 axle 5 tire 1",
               "axV75zfN45EOWkH8xGrOtMA": "Peripheral device tire temperature: trailer 3 axle 6 tire 4",
               "aVJsMFfpta0SzH4Zax_9TvQ": "Peripheral device tire temperature: trailer 3 axle 3 tire 1",
               "ay5N4RCJAO0CHTIjL4Q1WEg": "Peripheral device tire temperature: trailer 3 axle 6 tire 2",
               "aNEpSh7WjykmNTIkz-wi09g": "Peripheral device tire temperature: trailer 3 axle 3 tire 2",
               "a5tcYGwmNY0utaI96Hn2G9w": "Peripheral device tire temperature: trailer 3 axle 5 tire 3",
               "aOGSppyVNvEeOgZzF35LL4w": "Peripheral device tire temperature: trailer 3 axle 6 tire 1",
               "aNGZDIE9fDU2O1p6GI1DINQ": "Peripheral device tire temperature: trailer 3 axle 4 tire 2",
               "aJa7BrFr0OE2WbbGvqWwhUA": "Peripheral device tire temperature: trailer 3 axle 4 tire 4",
               "aUgl3XsHniUyY6rdX6pFkow": "Peripheral device tire temperature: trailer 3 axle 1 tire 1",
               "a5JC7agzX00Soq7rUKLDb1g": "Peripheral device tire temperature: trailer 3 axle 2 tire 3",
               "a1Vh9w6oZ80qyX8iKkh5XHw": "Peripheral device tire temperature: trailer 3 axle 6 tire 3",
               "aod2F0j_x4UylRNWq_ZlLUQ": "Peripheral device tire temperature: trailer 3 axle 2 tire 2",
               "amf_OMGhbe0eRsNeW96qaCw": "Peripheral device tire temperature: trailer 3 axle 4 tire 1",
               "aVzc4pgAFskqgh_NVuPZ6EA": "Peripheral device tire temperature: trailer 3 axle 4 tire 3",
               "aSM0xROkUAEq1ov4J1jgUkw": "Peripheral device tire temperature: trailer 3 axle 1 tire 3",
               "aNOCr8YvRG06wFwY8Vfcfkw": "Peripheral device tire pressure: trailer 3 axle 6 tire 2",
               "aDQ-H7PB2pU6oYBt0bpvyww": "Peripheral device tire pressure: trailer 3 axle 1 tire 4",
               "agiCJlft9hk6_DihsQGhbeg": "Peripheral device tire pressure: trailer 3 axle 4 tire 1",
               "axnU95osj8EKTMkEbHmzYKQ": "Peripheral device tire pressure: trailer 3 axle 3 tire 3",
               "aTI2eo8EHyUWjRkNcpdNh7Q": "Peripheral device tire pressure: trailer 3 axle 4 tire 2",
               "aDm6IIpVhdkWTEUacWcwH4Q": "Peripheral device tire pressure: trailer 3 axle 1 tire 3",
               "a_kan9Gsv3UaJK0vr2C9-XA": "Peripheral device tire pressure: trailer 3 axle 5 tire 1",
               "aiz8OvmId9UK6p09S1HLD2g": "Peripheral device tire pressure: trailer 3 axle 6 tire 3",
               "anPQiKKENIEmXr17QW-Lhag": "Peripheral device tire pressure: trailer 3 axle 5 tire 4",
               "a48OUjrqX_UWNoWdD8ozPOg": "Peripheral device tire pressure: trailer 3 axle 2 tire 2",
               "asV5bF9v710i823ZhMyKPpw": "Peripheral device tire pressure: trailer 3 axle 5 tire 3",
               "aQXVqDNqof0y2XnjMaDwgTg": "Peripheral device tire pressure: trailer 3 axle 1 tire 1",
               "av9A63iPJKkusDn5HygSr3w": "Peripheral device tire pressure: trailer 3 axle 4 tire 3",
               "a1QxeWa8GN0OCd4BdL-TdcQ": "Peripheral device tire pressure: trailer 3 axle 2 tire 1",
               "a3LhPoqp15EqcVIzTpTqmwg": "Peripheral device tire pressure: trailer 3 axle 4 tire 4",
               "aSAsD6yIFzEWvIZLwU8pRoQ": "Peripheral device tire pressure: trailer 3 axle 2 tire 4",
               "auM8_y6nNJUeII5QcoJwEng": "Peripheral device tire pressure: trailer 3 axle 3 tire 2",
               "aGizbe9Fer0ehdZbroM8UcQ": "Peripheral device tire pressure: trailer 3 axle 1 tire 2",
               "apUUAYdXOgEOfuq0x1gefwg": "Peripheral device tire pressure: trailer 3 axle 5 tire 2",
               "aGZXViyR0n0K9_bS2Ea8kTA": "Peripheral device tire pressure: trailer 3 axle 3 tire 4",
               "aUIercIxRzUOY2Lhuy35f-Q": "Peripheral device tire pressure: trailer 3 axle 2 tire 3",
               "aENtMjq048E2Q7L3N4PXDAw": "Peripheral device tire pressure: trailer 3 axle 6 tire 1",
               "asx1jEr14akmL4cDyBKCoHQ": "Peripheral device tire pressure: trailer 3 axle 6 tire 4",
               "aDhOAu0DTr0uaaN3vDQ_BHA": "Peripheral device tire pressure: trailer 3 axle 3 tire 1"
            },

            /* TempTrac */
            "Peripheral device: reefer temperature zone 4": {
               "loc": "Peripheral device: reefer temperature zone 4",
               "id": "DiagnosticReeferTemperatureZone4Id",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Peripheral device: reefer temperature zone 2": {
               "loc": "Peripheral device: reefer temperature zone 2",
               "id": "DiagnosticReeferTemperatureZone2Id",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Peripheral device: reefer temperature zone 3": {
               "loc": "Peripheral device: reefer temperature zone 3",
               "id": "DiagnosticReeferTemperatureZone3Id",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Peripheral device: reefer temperature zone 1": {
               "loc": "Peripheral device: reefer temperature zone 1",
               "id": "DiagnosticReeferTemperatureZone1Id",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },

            /* Tractor */
            "Tire temperature: axle 4 tire 2": {
               "loc": "Tire temperature: axle 4 tire 2",
               "id": "af-aART3R20iqTABMMuOQug",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 4 tire 1": {
               "loc": "Tire temperature: axle 4 tire 1",
               "id": "aJ5BZCAIRcUOtSQU2ah125Q",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 2 tire 2": {
               "loc": "Tire temperature: axle 2 tire 2",
               "id": "aJ6V9PwpaWEK6YwvKSLxuDg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 5 tire 1": {
               "loc": "Tire temperature: axle 5 tire 1",
               "id": "afTvCGj0LME2nPQ_yi6Zprg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 8 tire 2": {
               "loc": "Tire temperature: axle 8 tire 2",
               "id": "awgE9H0owikaNhxQp-8ORrg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 14 tire 3": {
               "loc": "Tire temperature: axle 14 tire 3",
               "id": "a_QqQSc7prEmssBy2cr4GiQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 15 tire 4": {
               "loc": "Tire temperature: axle 15 tire 4",
               "id": "acHLkVisytUqE-SFYpyke-Q",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 8 tire 3": {
               "loc": "Tire temperature: axle 8 tire 3",
               "id": "aksQyj4DQBky5HyURZiKYwg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 10 tire 2": {
               "loc": "Tire temperature: axle 10 tire 2",
               "id": "aSLXud_CMGEiskiVrUGfDZw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 5 tire 3": {
               "loc": "Tire temperature: axle 5 tire 3",
               "id": "a1hqxUSZzJ0S2JyYEyo_VeQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 10 tire 3": {
               "loc": "Tire temperature: axle 10 tire 3",
               "id": "abmqqxx7dREm4XCdaJagnKw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 5 tire 2": {
               "loc": "Tire temperature: axle 5 tire 2",
               "id": "a1-Xqquf_Pk2BLTSnpF2OLw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 13 tire 1": {
               "loc": "Tire temperature: axle 13 tire 1",
               "id": "anVIOrFs7-UC7rjVos2KK0w",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 7 tire 2": {
               "loc": "Tire temperature: axle 7 tire 2",
               "id": "aR1xLRYgjQ0ilhjk5Af9ijQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 7 tire 4": {
               "loc": "Tire temperature: axle 7 tire 4",
               "id": "aCIDQe8BU90KbPzprepe2pA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 11 tire 3": {
               "loc": "Tire temperature: axle 11 tire 3",
               "id": "aj0WbeSf22U-D90H53AUPGw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 14 tire 2": {
               "loc": "Tire temperature: axle 14 tire 2",
               "id": "aMcfoAqAI_0qftES-nOkdXg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 6 tire 1": {
               "loc": "Tire temperature: axle 6 tire 1",
               "id": "a2DB7ykkjnEmPsEUM8ax4Qw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 9 tire 1": {
               "loc": "Tire temperature: axle 9 tire 1",
               "id": "a7hDn0EY6kk-LJUhgheNKgw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 9 tire 2": {
               "loc": "Tire temperature: axle 9 tire 2",
               "id": "a_x2ggICa9EaLmUmijtxVxw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 9 tire 4": {
               "loc": "Tire temperature: axle 9 tire 4",
               "id": "aySNM1EiJRUW5c0m_2MNk_Q",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 3 tire 4": {
               "loc": "Tire temperature: axle 3 tire 4",
               "id": "a5zQnIKLK1EGJc0y74FM76Q",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 5 tire 4": {
               "loc": "Tire temperature: axle 5 tire 4",
               "id": "auMikJD79gk-SaVPlRyg0Cg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 10 tire 1": {
               "loc": "Tire temperature: axle 10 tire 1",
               "id": "aKe_wiJuqJE2jNV0ihv4eeA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 7 tire 1": {
               "loc": "Tire temperature: axle 7 tire 1",
               "id": "azHJzyul44Um0gmMP5OKW8g",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 3 tire 2": {
               "loc": "Tire temperature: axle 3 tire 2",
               "id": "a3_U0ud3wbkKNvGRSVJATOg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 11 tire 1": {
               "loc": "Tire temperature: axle 11 tire 1",
               "id": "adq1VIj3Mbk-ZKmYOnn5Djw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 12 tire 4": {
               "loc": "Tire temperature: axle 12 tire 4",
               "id": "atHQLX-xXBEalP2aOLb2cNA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 15 tire 2": {
               "loc": "Tire temperature: axle 15 tire 2",
               "id": "a_IYsTjcEMEm762d24DFUdA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 4 tire 4": {
               "loc": "Tire temperature: axle 4 tire 4",
               "id": "afGmJoFp5M02mSmv6iumwfQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 2 tire 4": {
               "loc": "Tire temperature: axle 2 tire 4",
               "id": "alXGwTauFBkq48G840Hni1g",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 13 tire 3": {
               "loc": "Tire temperature: axle 13 tire 3",
               "id": "aoMlYiDcBlk-cPnLliFLTtw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 8 tire 4": {
               "loc": "Tire temperature: axle 8 tire 4",
               "id": "ajMeii2CJykmBHHNtskGPyQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 11 tire 2": {
               "loc": "Tire temperature: axle 11 tire 2",
               "id": "afbN7sX31KEqhoHTZAIKFnw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 6 tire 3": {
               "loc": "Tire temperature: axle 6 tire 3",
               "id": "apPupKJzE6Um-PHd2-XGVbQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 13 tire 4": {
               "loc": "Tire temperature: axle 13 tire 4",
               "id": "arrO0vmDWZEOIFnfLvRMxkQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 1 tire 2": {
               "loc": "Tire temperature: axle 1 tire 2",
               "id": "a1ZcS5E35KkOVBXxcqSCihQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 3 tire 1": {
               "loc": "Tire temperature: axle 3 tire 1",
               "id": "a2Sj4el_ot0akRIAFB3j3dA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 9 tire 3": {
               "loc": "Tire temperature: axle 9 tire 3",
               "id": "amhgewWRlz0e8M4VA1o1tkQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 12 tire 3": {
               "loc": "Tire temperature: axle 12 tire 3",
               "id": "aV00Fh2yuRk2a-pCjfLbOAQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 13 tire 2": {
               "loc": "Tire temperature: axle 13 tire 2",
               "id": "aGv5W2jGib0qGmZFTthHqxg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 1 tire 1": {
               "loc": "Tire temperature: axle 1 tire 1",
               "id": "aMc7Tbwr7oEG_65ZlQIhe8A",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 1 tire 3": {
               "loc": "Tire temperature: axle 1 tire 3",
               "id": "ayIh-pPu-BUyW35gJQDE-eQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 6 tire 2": {
               "loc": "Tire temperature: axle 6 tire 2",
               "id": "alIBMrLvBRkGoJZwLXT4aNA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 12 tire 1": {
               "loc": "Tire temperature: axle 12 tire 1",
               "id": "a-Z4vcpJrK0OcAZ4JV5-DUA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 3 tire 3": {
               "loc": "Tire temperature: axle 3 tire 3",
               "id": "ahQIxeVmRhUWwja1X5JWRmw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 12 tire 2": {
               "loc": "Tire temperature: axle 12 tire 2",
               "id": "aPtrBlvZnR0GGJbSgpf7YtA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 11 tire 4": {
               "loc": "Tire temperature: axle 11 tire 4",
               "id": "aSEhZa5CWvEWFPLorvUtl9A",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 8 tire 1": {
               "loc": "Tire temperature: axle 8 tire 1",
               "id": "aVyx_amL1G067I7yelZtTqg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 2 tire 1": {
               "loc": "Tire temperature: axle 2 tire 1",
               "id": "aB1AI1v7VZEuEpL9DL2pX5w",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 7 tire 3": {
               "loc": "Tire temperature: axle 7 tire 3",
               "id": "aJcg4DnM3AUaZQc-dTwheRA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 6 tire 4": {
               "loc": "Tire temperature: axle 6 tire 4",
               "id": "aRQu7NYg_rUykKdD5aLB3Tg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 15 tire 1": {
               "loc": "Tire temperature: axle 15 tire 1",
               "id": "avTVfxhYRP0K5Fdf2UnmVFw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 14 tire 1": {
               "loc": "Tire temperature: axle 14 tire 1",
               "id": "aN8DkqeyfYkGUZdmBUqL7WA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 2 tire 3": {
               "loc": "Tire temperature: axle 2 tire 3",
               "id": "ajfPPsCzHZkOMSeHqdB122g",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 15 tire 3": {
               "loc": "Tire temperature: axle 15 tire 3",
               "id": "aE05ArsMmmUizi-yBlxGGpg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 4 tire 3": {
               "loc": "Tire temperature: axle 4 tire 3",
               "id": "ajbFDc7c6PUCLMu1BJUKdYQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 14 tire 4": {
               "loc": "Tire temperature: axle 14 tire 4",
               "id": "awF7driK_DEKXY_Kmt1i0mg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 1 tire 4": {
               "loc": "Tire temperature: axle 1 tire 4",
               "id": "aDO8NxWx690S8VPvFn45NJA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },
            "Tire temperature: axle 10 tire 4": {
               "loc": "Tire temperature: axle 10 tire 4",
               "id": "aweRcCBktTESBkI4aIIaVxg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "tractor"
            },

            "Tire pressure: axle 15 tire 2": {
               "loc": "Tire pressure: axle 15 tire 2",
               "id": "afymkm9jH_0m_gAZkB2YY7w",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 5 tire 3": {
               "loc": "Tire pressure: axle 5 tire 3",
               "id": "aS59DbXj9VUeHZw0A81Y5TA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 1 tire 3": {
               "loc": "Tire pressure: axle 1 tire 3",
               "id": "ammSx3EpAVEWFRA4yst8hGA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 13 tire 1": {
               "loc": "Tire pressure: axle 13 tire 1",
               "id": "aUPhXzwOWIkCmEBKvkVg5Zw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 14 tire 4": {
               "loc": "Tire pressure: axle 14 tire 4",
               "id": "alHeD6taYXEuH3yCaQQ8R-A",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 1 tire 4": {
               "loc": "Tire pressure: axle 1 tire 4",
               "id": "aDTv46qmi302XziRVk7SOYw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 10 tire 4": {
               "loc": "Tire pressure: axle 10 tire 4",
               "id": "aaw36-92yaUuzvCZoKoiD9g",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 6 tire 3": {
               "loc": "Tire pressure: axle 6 tire 3",
               "id": "ahx9K_344rU6qFilQAF6Esg",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 2 tire 4": {
               "loc": "Tire pressure: axle 2 tire 4",
               "id": "aDHfNLzHx0USy7isxSHgT1Q",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 11 tire 3": {
               "loc": "Tire pressure: axle 11 tire 3",
               "id": "axLqNDg3AF0u4bi4N79kc3g",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 5 tire 2": {
               "loc": "Tire pressure: axle 5 tire 2",
               "id": "aPww5uoVhKEC7sy5wxF4tbQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 9 tire 4": {
               "loc": "Tire pressure: axle 9 tire 4",
               "id": "aBnIGO8z_BUuqpjfvsIW80g",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 13 tire 4": {
               "loc": "Tire pressure: axle 13 tire 4",
               "id": "aeo9W40sUCUK5hUKmWWuUWg",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 7 tire 4": {
               "loc": "Tire pressure: axle 7 tire 4",
               "id": "aWD9ZUNd75kCacEXe4bN97A",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 13 tire 2": {
               "loc": "Tire pressure: axle 13 tire 2",
               "id": "avpBdnkY5hUqCIEdFINDRPA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 15 tire 4": {
               "loc": "Tire pressure: axle 15 tire 4",
               "id": "aTFYkXEL8c0eYh1QXFqZCzw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 4 tire 3": {
               "loc": "Tire pressure: axle 4 tire 3",
               "id": "aubbIscaJzEKptmBPdkmukA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 3 tire 4": {
               "loc": "Tire pressure: axle 3 tire 4",
               "id": "aucGvS2b7GE2eBWJptDcQTQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 3 tire 1": {
               "loc": "Tire pressure: axle 3 tire 1",
               "id": "aHuKjEY6QYEGRXmat21HiFg",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 12 tire 1": {
               "loc": "Tire pressure: axle 12 tire 1",
               "id": "azXrGzYd0v0iNR2f1eYxZrw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 7 tire 1": {
               "loc": "Tire pressure: axle 7 tire 1",
               "id": "au2spF4W84E2-12mLeyzC9A",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 2 tire 1": {
               "loc": "Tire pressure: axle 2 tire 1",
               "id": "a5OQtfETMnEeVAms6MINtMQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 6 tire 4": {
               "loc": "Tire pressure: axle 6 tire 4",
               "id": "aGQz-0014q0qQuGzLGcjzHw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 1 tire 2": {
               "loc": "Tire pressure: axle 1 tire 2",
               "id": "aWh7GmzEY20aZA3C4KSBZuA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 5 tire 4": {
               "loc": "Tire pressure: axle 5 tire 4",
               "id": "arJxAG_FB00GwM3N00Y6Whw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 3 tire 2": {
               "loc": "Tire pressure: axle 3 tire 2",
               "id": "aXLrB8-L0kkWwJXrnEdPYvQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 12 tire 4": {
               "loc": "Tire pressure: axle 12 tire 4",
               "id": "awQIRTYlQx02Zl3v9HUrGjQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 10 tire 1": {
               "loc": "Tire pressure: axle 10 tire 1",
               "id": "az5qzThnBY0KSMnwnNyvNkQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 8 tire 3": {
               "loc": "Tire pressure: axle 8 tire 3",
               "id": "ap8APxcA9sk--x3_taAerkQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 8 tire 2": {
               "loc": "Tire pressure: axle 8 tire 2",
               "id": "aPnpH0F0JQ0q6coWjTvgqHg",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 11 tire 4": {
               "loc": "Tire pressure: axle 11 tire 4",
               "id": "aS75tKaxbRE-5K4ZVNTFbWg",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 12 tire 3": {
               "loc": "Tire pressure: axle 12 tire 3",
               "id": "aCzHq1tPPBkSxO4mqKYxL_A",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 6 tire 1": {
               "loc": "Tire pressure: axle 6 tire 1",
               "id": "aXIP7a0nEgU6dxZGxGBXbSw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 11 tire 2": {
               "loc": "Tire pressure: axle 11 tire 2",
               "id": "a9K-yD73p7UelSZLahVvXSw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 6 tire 2": {
               "loc": "Tire pressure: axle 6 tire 2",
               "id": "at8jmyXzYGEmpo5LurduU_w",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 2 tire 2": {
               "loc": "Tire pressure: axle 2 tire 2",
               "id": "aYT21qD9lUkydm5SNLVP2Kw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 5 tire 1": {
               "loc": "Tire pressure: axle 5 tire 1",
               "id": "a4hVw9GtnN06ClZbBbuJ_1A",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 15 tire 1": {
               "loc": "Tire pressure: axle 15 tire 1",
               "id": "aaN_Fa-6luECCbJc82AF1tA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 15 tire 3": {
               "loc": "Tire pressure: axle 15 tire 3",
               "id": "aKXS14K7z9EmkUaPJzw-_RA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 12 tire 2": {
               "loc": "Tire pressure: axle 12 tire 2",
               "id": "a1dfQ-q5ZRkOMuanRgvu57A",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 9 tire 3": {
               "loc": "Tire pressure: axle 9 tire 3",
               "id": "aaHc0-gOrWECbEq4qg02B-A",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 10 tire 3": {
               "loc": "Tire pressure: axle 10 tire 3",
               "id": "aLQakfX7fFEWfCrAdE7SI7g",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 9 tire 2": {
               "loc": "Tire pressure: axle 9 tire 2",
               "id": "aSB58Wc8x1k-cjLKT5BVSQA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 4 tire 2": {
               "loc": "Tire pressure: axle 4 tire 2",
               "id": "a6uqOJv4P2EKQo7oBzHckrQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 14 tire 2": {
               "loc": "Tire pressure: axle 14 tire 2",
               "id": "arq0jP0jTIE-STLy_Irs-Kw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 9 tire 1": {
               "loc": "Tire pressure: axle 9 tire 1",
               "id": "aV8WCZOe8Jkynz797aav7WQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 11 tire 1": {
               "loc": "Tire pressure: axle 11 tire 1",
               "id": "acckG84GvXkC94sejQz44Hw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 4 tire 4": {
               "loc": "Tire pressure: axle 4 tire 4",
               "id": "a_wS1PWcq70aVdMoGNy676Q",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 7 tire 3": {
               "loc": "Tire pressure: axle 7 tire 3",
               "id": "aONK3kCogOUuIGdS8hhKGiA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 8 tire 1": {
               "loc": "Tire pressure: axle 8 tire 1",
               "id": "aPem32mhR7EmN19W6eD3M8Q",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 3 tire 3": {
               "loc": "Tire pressure: axle 3 tire 3",
               "id": "ajN885q748kueWd0nNFtatA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 13 tire 3": {
               "loc": "Tire pressure: axle 13 tire 3",
               "id": "aM8CUZ103VkuKfuS0wmGYPQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 2 tire 3": {
               "loc": "Tire pressure: axle 2 tire 3",
               "id": "aqnMOJwje1kmfBOwBqj0zLQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 4 tire 1": {
               "loc": "Tire pressure: axle 4 tire 1",
               "id": "arRAX2-GlvEO5JOzrOW0Nyg",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 10 tire 2": {
               "loc": "Tire pressure: axle 10 tire 2",
               "id": "aKt5ITkO4kkOKJ_JTuocMmA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 7 tire 2": {
               "loc": "Tire pressure: axle 7 tire 2",
               "id": "ayc0vUJCH00qTpvMb6SH59w",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 14 tire 1": {
               "loc": "Tire pressure: axle 14 tire 1",
               "id": "aj1hqGeelsUWOyPWLFvUs8Q",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 14 tire 3": {
               "loc": "Tire pressure: axle 14 tire 3",
               "id": "aevn4KPf8bkCJWP5L3mQKAw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 8 tire 4": {
               "loc": "Tire pressure: axle 8 tire 4",
               "id": "aIBxsSTHMPUGFY__OvOEqCg",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },
            "Tire pressure: axle 1 tire 1": {
               "loc": "Tire pressure: axle 1 tire 1",
               "id": "axw5pat2bp0ueRduqcJi2KQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "tractor"
            },

            /* Trailer 1 */
            "Peripheral device tire temperature: trailer 1 axle 4 tire 3": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 4 tire 3",
               "id": "av-7nmyzSDEiBcRDpax9XwQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 3 tire 2": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 3 tire 2",
               "id": "a8W8XrBk65ECpIiSHQrdwpQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 4 tire 4": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 4 tire 4",
               "id": "a3-guntvtCkKXXimdgESeBw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 2 tire 1": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 2 tire 1",
               "id": "ab4_iJdiZjkSi9iywGGgDJA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 4 tire 1": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 4 tire 1",
               "id": "aeNBT3_JzWUqoDzot_VVymg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 5 tire 1": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 5 tire 1",
               "id": "aio8G6xm0T0-m6D64eiXq8w",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 1 tire 4": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 1 tire 4",
               "id": "aSx4sxJmSXEi07kcDyRKDsw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 5 tire 2": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 5 tire 2",
               "id": "aJ7REd1YJykupdUhUB4Uezw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 2 tire 2": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 2 tire 2",
               "id": "ameT6maBOAkaDtlEnFgJq_Q",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 1 tire 3": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 1 tire 3",
               "id": "aR1pR_4OjV0eowFjfY-SasA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 6 tire 1": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 6 tire 1",
               "id": "ahYYp6qyrU0y7fHwQ5lxnbQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 2 tire 4": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 2 tire 4",
               "id": "azVdLjnyM1Eupzn8O5vaxtA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 6 tire 2": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 6 tire 2",
               "id": "alg5yGb5ZEkaTnIlsEwTghg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 2 tire 3": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 2 tire 3",
               "id": "aD5jFsDFrGUapTIotvp_GRQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 1 tire 1": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 1 tire 1",
               "id": "ablV8lrsvDkeiWpnI2QfMPg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 1 tire 2": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 1 tire 2",
               "id": "avkkKzpSD50il7J5qmNsIFg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 5 tire 4": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 5 tire 4",
               "id": "ae0Lk1q9LZEOO66X4YwWkow",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 5 tire 3": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 5 tire 3",
               "id": "afZEy_7Am906-LLC4W6xuUQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 3 tire 3": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 3 tire 3",
               "id": "aw_VEhum4V0qzZbOj1ZH8Pg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 3 tire 4": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 3 tire 4",
               "id": "avfJ95BT-NEyTUbihRKXw5w",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 6 tire 3": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 6 tire 3",
               "id": "ac98h3XY4lkqBgsykqqw9dg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 3 tire 1": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 3 tire 1",
               "id": "av0Wwrr13z0mtn9Cbz91txw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 4 tire 2": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 4 tire 2",
               "id": "aNpE8SrX61kmi7vefI82ldw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },
            "Peripheral device tire temperature: trailer 1 axle 6 tire 4": {
               "loc": "Peripheral device tire temperature: trailer 1 axle 6 tire 4",
               "id": "aaM2YzIHm4UySm_tI0c3JrA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer1"
            },

            "Peripheral device tire pressure: trailer 1 axle 4 tire 4": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 4 tire 4",
               "id": "aoXL-czVSe0aFrwEKAUgpSQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 1 tire 1": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 1 tire 1",
               "id": "aiImdaxpyOUOqHgYiIq9Pdg",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 5 tire 2": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 5 tire 2",
               "id": "a558xfocfOkqq0RGif3PYkA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 1 tire 2": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 1 tire 2",
               "id": "anGN3cyDOU0-a7xXDZC9FlA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 2 tire 3": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 2 tire 3",
               "id": "a2aQWL9vbIEaFtjOIygXpNw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 1 tire 4": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 1 tire 4",
               "id": "alTF5vGqw8UKeSUIRQKwyhA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 3 tire 3": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 3 tire 3",
               "id": "aYnZufXXYcEm060ZK4tzbww",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 5 tire 1": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 5 tire 1",
               "id": "altKk6qgEqkSCqVNv26HKMw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 6 tire 2": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 6 tire 2",
               "id": "aqfLL9jojEEuRBVVoOnnMvw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 3 tire 2": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 3 tire 2",
               "id": "aMf4Mfu2RPkmtN2C4s_yy6g",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 4 tire 3": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 4 tire 3",
               "id": "aN6xyABRxyU6TnWWGCo48lw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 6 tire 3": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 6 tire 3",
               "id": "aShus-gSfSkS8DWbKTFquew",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 5 tire 4": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 5 tire 4",
               "id": "aOtviSvi0hUm7-2trnI8wAw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 1 tire 3": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 1 tire 3",
               "id": "aOzYhibYm8Uuyj3bl18lP8w",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 2 tire 1": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 2 tire 1",
               "id": "aiUOCYsLw-UuMKXhrzWYNiw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 5 tire 3": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 5 tire 3",
               "id": "an9aZLqd5uEyGaX5Qo9xSmw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 3 tire 4": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 3 tire 4",
               "id": "aBXb6Hcojuku-uItx7iSCOA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 2 tire 4": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 2 tire 4",
               "id": "aur1cwwirIk-ym434gRLBVA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 6 tire 4": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 6 tire 4",
               "id": "a49vpNDRQoEG50ZdK2p_rXQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 6 tire 1": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 6 tire 1",
               "id": "aUwmJiXOXMEGHoKstyej0nA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 2 tire 2": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 2 tire 2",
               "id": "a4SQvHuXgm0qdAa9XMhI5pQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 4 tire 1": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 4 tire 1",
               "id": "ar20m0c8XM0qGYriVvG7d1A",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 3 tire 1": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 3 tire 1",
               "id": "agJKt4tlDQ0WbpfUQQ3bGew",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },
            "Peripheral device tire pressure: trailer 1 axle 4 tire 2": {
               "loc": "Peripheral device tire pressure: trailer 1 axle 4 tire 2",
               "id": "ar5iByUEFz0SyJf6Q9BfJtQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer1"
            },

            /* Trailer 2 */
            "Peripheral device tire temperature: trailer 2 axle 5 tire 3": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 5 tire 3",
               "id": "agKc5_RtImUOx6AYqAlvt-Q",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 3 tire 4": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 3 tire 4",
               "id": "a99JAnc5DuEqPdgvELZvgDw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 4 tire 1": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 4 tire 1",
               "id": "aPOlQSZzorkSlNQzgUop9ZQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 6 tire 3": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 6 tire 3",
               "id": "aHwFNTYYCzECYpBgbNIznww",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 2 tire 1": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 2 tire 1",
               "id": "agpC-PvnSJkW_5ikoOg0WIw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 1 tire 4": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 1 tire 4",
               "id": "aI1bKcTKLukOraSrnmJ-7cg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 2 tire 3": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 2 tire 3",
               "id": "adeC918cOXkSNvzZwGVwqGw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 3 tire 3": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 3 tire 3",
               "id": "a8mJwVfLLIEGgNDxZaTfNbw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 3 tire 2": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 3 tire 2",
               "id": "a5RV-FSl0BU2B4UVrhY6FsQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 6 tire 2": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 6 tire 2",
               "id": "aT08_83KvnE2dEEfLgcan8w",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 1 tire 2": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 1 tire 2",
               "id": "aTtkuUj7060ikMkjXseUgOw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 2 tire 2": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 2 tire 2",
               "id": "adxBetWHIKkaG3V_ph_BhyQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 4 tire 2": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 4 tire 2",
               "id": "aI8uO2CQ6A0iaD3acPRBKAA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 6 tire 1": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 6 tire 1",
               "id": "aDYQobqlAl0m4xH4oUNl1EQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 1 tire 3": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 1 tire 3",
               "id": "aqSYLGYDvjEKnIZQTqLTuLw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 6 tire 4": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 6 tire 4",
               "id": "aIqlzThBFFEqwM5i-pqzSWg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 3 tire 1": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 3 tire 1",
               "id": "aOf5V0c5KvEKXPa2uQ9o9qg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 5 tire 4": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 5 tire 4",
               "id": "aYEpdhJGKOUSBdb9v1Lbj4A",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 4 tire 3": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 4 tire 3",
               "id": "aLdCVnDVWa0GGk8hre-mCtA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 2 tire 4": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 2 tire 4",
               "id": "a6RpYQEXpnk6XKcsVRhtY3Q",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 5 tire 2": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 5 tire 2",
               "id": "aiJy_8EYUg0WF4tf1i2qGfQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 4 tire 4": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 4 tire 4",
               "id": "ag8dvMYb3s02Ndd0Qec8HiQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 1 tire 1": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 1 tire 1",
               "id": "araR8mswfs06ZH-v-XJAf2w",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire temperature: trailer 2 axle 5 tire 1": {
               "loc": "Peripheral device tire temperature: trailer 2 axle 5 tire 1",
               "id": "aQerXJeXJikO5uvUzeZjAPQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 3 tire 2": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 3 tire 2",
               "id": "aIphJmTIEvUKbnwszf6RYhQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 5 tire 1": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 5 tire 1",
               "id": "azA4EGYVH6kenmA3ccqzeXg",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 2 tire 4": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 2 tire 4",
               "id": "a-MeuiogirUureBeU_XpaDA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 4 tire 3": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 4 tire 3",
               "id": "aSr8VyEKyd0-qAhoqbmP7QA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },

            "Peripheral device tire pressure: trailer 2 axle 5 tire 4": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 5 tire 4",
               "id": "aq62nuOT02UqIkh3Qb01O2A",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 6 tire 2": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 6 tire 2",
               "id": "a5C45BLPEREeQEx_KnV4t7g",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 5 tire 3": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 5 tire 3",
               "id": "aIZx8fruMlkiXwTFdZKB02A",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 1 tire 3": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 1 tire 3",
               "id": "aqxP_I0DPqEOE-T2iMgcUfw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 1 tire 2": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 1 tire 2",
               "id": "aKIHzl1Or50eKL0kys3wZOg",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 4 tire 2": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 4 tire 2",
               "id": "a9NB2cZXS90iHPlzgVqjudA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 1 tire 1": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 1 tire 1",
               "id": "anivGk3NBq0WuYWRFsA8i-g",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 2 tire 3": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 2 tire 3",
               "id": "aRjLg1djVFES9Am9LtfY_Kg",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 3 tire 4": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 3 tire 4",
               "id": "aFj5MS5cupUeNMW_GYlNGgQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 6 tire 4": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 6 tire 4",
               "id": "ayBB61Dsaa0WfpXoG8ycvpw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 4 tire 4": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 4 tire 4",
               "id": "a9c9yPQ0deEmGPomSDFL6nQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 6 tire 3": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 6 tire 3",
               "id": "aLxkwNTgtbUa0d7SptpEqaA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 3 tire 1": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 3 tire 1",
               "id": "a6IiOvOrMLUWb6LgS3t6FBA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 2 tire 2": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 2 tire 2",
               "id": "aue4KnLeXXU-vRr3A8Dlkng",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 5 tire 2": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 5 tire 2",
               "id": "aOVj04lzzsEiBUb7okAkb2w",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 4 tire 1": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 4 tire 1",
               "id": "aRk-QrHUlCkGaWL_8wL7kzg",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 2 tire 1": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 2 tire 1",
               "id": "arVA95TeSZkqOxMDz6ekQJQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 1 tire 4": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 1 tire 4",
               "id": "aRTwuV8X1qEKlWdO6o4SHBA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 3 tire 3": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 3 tire 3",
               "id": "aUe4D3OsNhE27OfWNae8gIA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },
            "Peripheral device tire pressure: trailer 2 axle 6 tire 1": {
               "loc": "Peripheral device tire pressure: trailer 2 axle 6 tire 1",
               "id": "aeTuqJroVW0WsPPnBqGcwLg",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer2"
            },

            /* Trailer 3 */
            "Peripheral device tire temperature: trailer 3 axle 1 tire 4": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 1 tire 4",
               "id": "ab2Fqg2bNbUeoOQIV4BTagQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 5 tire 2": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 5 tire 2",
               "id": "awEAqh8jieEKU0AWpFLE9Jg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 3 tire 4": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 3 tire 4",
               "id": "araMSRvJd0kG9ECEeVa_aTg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 2 tire 4": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 2 tire 4",
               "id": "a_bLviqmfikeQMCRl4YjwwA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 5 tire 4": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 5 tire 4",
               "id": "aCykppg1KK0CX1DRiPH5Y_g",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 2 tire 1": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 2 tire 1",
               "id": "aiYrrhzrvVUG3bUXXWOwpXw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 3 tire 3": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 3 tire 3",
               "id": "aFlrw9w5Yl0q-x0lSr6d-KQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 1 tire 2": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 1 tire 2",
               "id": "aF7y6hQj_BUKiP1NpbvstjQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 5 tire 1": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 5 tire 1",
               "id": "aNkfmmDIDwkiXoHs9l8fOrQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 6 tire 4": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 6 tire 4",
               "id": "axV75zfN45EOWkH8xGrOtMA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 3 tire 1": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 3 tire 1",
               "id": "aVJsMFfpta0SzH4Zax_9TvQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 6 tire 2": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 6 tire 2",
               "id": "ay5N4RCJAO0CHTIjL4Q1WEg",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 3 tire 2": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 3 tire 2",
               "id": "aNEpSh7WjykmNTIkz-wi09g",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 5 tire 3": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 5 tire 3",
               "id": "a5tcYGwmNY0utaI96Hn2G9w",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 6 tire 1": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 6 tire 1",
               "id": "aOGSppyVNvEeOgZzF35LL4w",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 4 tire 2": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 4 tire 2",
               "id": "aNGZDIE9fDU2O1p6GI1DINQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 4 tire 4": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 4 tire 4",
               "id": "aJa7BrFr0OE2WbbGvqWwhUA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 1 tire 1": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 1 tire 1",
               "id": "aUgl3XsHniUyY6rdX6pFkow",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 2 tire 3": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 2 tire 3",
               "id": "a5JC7agzX00Soq7rUKLDb1g",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 6 tire 3": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 6 tire 3",
               "id": "a1Vh9w6oZ80qyX8iKkh5XHw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 2 tire 2": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 2 tire 2",
               "id": "aod2F0j_x4UylRNWq_ZlLUQ",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 4 tire 1": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 4 tire 1",
               "id": "amf_OMGhbe0eRsNeW96qaCw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 4 tire 3": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 4 tire 3",
               "id": "aVzc4pgAFskqgh_NVuPZ6EA",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },
            "Peripheral device tire temperature: trailer 3 axle 1 tire 3": {
               "loc": "Peripheral device tire temperature: trailer 3 axle 1 tire 3",
               "id": "aSM0xROkUAEq1ov4J1jgUkw",
               "unitOfMeasure": "UnitOfMeasureDegreesCelsiusId",
               "type": "trailer3"
            },

            "Peripheral device tire pressure: trailer 3 axle 6 tire 2": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 6 tire 2",
               "id": "aNOCr8YvRG06wFwY8Vfcfkw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 1 tire 4": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 1 tire 4",
               "id": "aDQ-H7PB2pU6oYBt0bpvyww",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 4 tire 1": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 4 tire 1",
               "id": "agiCJlft9hk6_DihsQGhbeg",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 3 tire 3": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 3 tire 3",
               "id": "axnU95osj8EKTMkEbHmzYKQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 4 tire 2": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 4 tire 2",
               "id": "aTI2eo8EHyUWjRkNcpdNh7Q",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 1 tire 3": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 1 tire 3",
               "id": "aDm6IIpVhdkWTEUacWcwH4Q",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 5 tire 1": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 5 tire 1",
               "id": "a_kan9Gsv3UaJK0vr2C9-XA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 6 tire 3": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 6 tire 3",
               "id": "aiz8OvmId9UK6p09S1HLD2g",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 5 tire 4": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 5 tire 4",
               "id": "anPQiKKENIEmXr17QW-Lhag",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 2 tire 2": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 2 tire 2",
               "id": "a48OUjrqX_UWNoWdD8ozPOg",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 5 tire 3": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 5 tire 3",
               "id": "asV5bF9v710i823ZhMyKPpw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 1 tire 1": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 1 tire 1",
               "id": "aQXVqDNqof0y2XnjMaDwgTg",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 4 tire 3": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 4 tire 3",
               "id": "av9A63iPJKkusDn5HygSr3w",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 2 tire 1": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 2 tire 1",
               "id": "a1QxeWa8GN0OCd4BdL-TdcQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 4 tire 4": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 4 tire 4",
               "id": "a3LhPoqp15EqcVIzTpTqmwg",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 2 tire 4": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 2 tire 4",
               "id": "aSAsD6yIFzEWvIZLwU8pRoQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 3 tire 2": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 3 tire 2",
               "id": "auM8_y6nNJUeII5QcoJwEng",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 1 tire 2": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 1 tire 2",
               "id": "aGizbe9Fer0ehdZbroM8UcQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 5 tire 2": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 5 tire 2",
               "id": "apUUAYdXOgEOfuq0x1gefwg",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 3 tire 4": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 3 tire 4",
               "id": "aGZXViyR0n0K9_bS2Ea8kTA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 2 tire 3": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 2 tire 3",
               "id": "aUIercIxRzUOY2Lhuy35f-Q",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 6 tire 1": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 6 tire 1",
               "id": "aENtMjq048E2Q7L3N4PXDAw",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 6 tire 4": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 6 tire 4",
               "id": "asx1jEr14akmL4cDyBKCoHQ",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            },
            "Peripheral device tire pressure: trailer 3 axle 3 tire 1": {
               "loc": "Peripheral device tire pressure: trailer 3 axle 3 tire 1",
               "id": "aDhOAu0DTr0uaaN3vDQ_BHA",
               "unitOfMeasure": "UnitOfMeasurePascalsId",
               "type": "trailer3"
            }
         }
      };
      return me;
   }.bind(this)();
}