// eslint-disable-next-line no-unused-vars
import React, { Fragment } from "react";
import moment from "moment-timezone";
import splSrv from ".";
import { renderToString } from "react-dom/server";
import { Html5Entities } from "html-entities";
import { fetchVehSensorDataAsync } from "../services/api/temptrac-tpms/utils";
import { liveButtonModel } from "../../components/controls/live-button-model/live-button-model";

/**
 *  Manage / Generate cached Vehicle Sensor data for UI
 */
export const INITSplSensorDataTools = function (goLibCreatorFunc) {

   /**
    *  Private Variables
    */
   this._sensorDataLifetime = 180;                 // (Default: 180 seconds) Afer this period, cached data is refreshed from API (in seconds)
   this._sensorSearchInProgressResponse = "BUSY";  // Do not allow simultaneous searches on the same vehicle

   this._goLibCreatorFunc = null;
   this._goLibVeh = {};
   this._cache = {};

   this._sensorDataNotFoundMsg = "";
   this._vehComponents = {};

   this._onFetchReleaseStaleCachedSensorDataFlagObj = {};

   /**
    * Fetch vehicle sensor data from cache or API
    * ( cached is refreshed after X minutes, as defined in _sensorDataLifetime )
    *
    *  @returns promise
    */
   this.fetchCachedSensorData = function (vehId, vehName) {
      const me = this;
      if (typeof me._cache[vehId] === "undefined") {
         me._cache[vehId] = {
            searching: false,
            firstTime: true,
            noSensorDataFound: false,
            expiry: moment().add(me._sensorDataLifetime, "seconds").unix(),
            data: null
         };
         // Create TEMPTRAC-TPMS library object vehicle instance
         me._goLibVeh[vehId] = me._goLibCreatorFunc();
      }
      return new Promise((resolve, reject) => {
         // Do not allow simultaneous searches on the same vehicle
         if (me._cache[vehId].searching) {
            reject(me._sensorSearchInProgressResponse);
         }
         else if (me._cache[vehId].data === null || me._cache[vehId].expiry < moment().unix()) {
            me._cache[vehId].searching = true;
            me._cache[vehId].noSensorDataFound = true;

            // On first-time search of a vehicle
            // In Geotab library, reset the Sensor Search Parameters to a new Vehicle configuration
            if (me._cache[vehId].data === null) {
               me._goLibVeh[vehId].resetAsFirstTime();
            }

            // DEBUG TEMP
            let debugCacheData = "";
            let debugSensorData = "";

            //Splunk for sensor data
            me._fetchData(vehId)
               .then((sensorData) => {
                  me._cache[vehId].searching = false;

                  // Save Vehicle Name
                  sensorData.vehName = vehName;

                  // Report on what we found on the initial search only,
                  // Reporting on Repeat searches will be handled by the data merging code
                  if (me._cache[vehId].data === null) {
                     me._cache[vehId].noSensorDataFound = false;

                     if (sensorData.vehCfg.total === 1) {
                        console.log("VehicleID [ " + vehId + " ]: --- NEW SENSOR DATA FOUND after the last search.  " +
                           "Temptrac [" + Object.keys(sensorData.temptrac).length + "]  " +
                           "TPMS Temperature [" + Object.keys(sensorData.tpmstemp).length + "]  " +
                           "TPMS Pressure [" + Object.keys(sensorData.tpmspress).length + "]"
                        );
                     }
                     else {
                        sensorData.vehCfg.ids.map(compId => {
                           console.log("VehicleID [ " + vehId + " ]: --- NEW SENSOR DATA FOUND on " +
                              me._vehComponents[compId].toUpperCase() + " after the last search.  " +
                              "Temptrac [" + Object.keys(sensorData[compId].temptrac).length + "]  " +
                              "TPMS Temperature [" + Object.keys(sensorData[compId].tpmstemp).length + "]  " +
                              "TPMS Pressure [" + Object.keys(sensorData[compId].tpmspress).length + "]"
                           );
                        });
                     }
                  }

                  // If cache is EMPTY, populate with new sensor data
                  if (me._cache[vehId].data === null) {
                     if (sensorData.vehCfg.total === 1) {
                        sensorData[sensorData.vehCfg.active] = {
                           temptrac: sensorData.temptrac,
                           tpmspress: sensorData.tpmspress,
                           tpmstemp: sensorData.tpmstemp
                        };
                        delete sensorData.temptrac;
                        delete sensorData.tpmspress;
                        delete sensorData.tpmstemp;
                     }
                     me._cache[vehId].data = sensorData;
                  }
                  // Merge NEW Single-Component (possibly TRACTOR) data with cached data
                  else if (sensorData.vehCfg.total === 1) {

                     // Flag all data in cache as OLD
                     me._resetSensorDataInCache(vehId);

                     // Merge with Single-Component cached data
                     if (me._cache[vehId].data.vehCfg.total === 1) {
                        debugCacheData = JSON.stringify(me._cache[vehId].data[me._cache[vehId].data.vehCfg.active]); //DEBUG
                        debugSensorData = JSON.stringify(sensorData); //DEBUG
                        me._cache[vehId].data[me._cache[vehId].data.vehCfg.active] =
                           me._mergeSensorDataIntoCache(
                              me._cache[vehId].data[me._cache[vehId].data.vehCfg.active],
                              sensorData,
                              me._cache[vehId].data.vehCfg.active,
                              vehId
                           );
                     }
                     // Merge with Multi-Component cached data
                     else {
                        me._cache[vehId].data.vehCfg.ids.map(cacheCompId => {
                           if (cacheCompId === sensorData.vehCfg.active) {
                              debugCacheData = JSON.stringify(me._cache[vehId].data[cacheCompId]); //DEBUG
                              debugSensorData = JSON.stringify(sensorData); //DEBUG
                              me._cache[vehId].data[cacheCompId] = me._mergeSensorDataIntoCache(
                                 me._cache[vehId].data[cacheCompId],
                                 sensorData,
                                 cacheCompId,
                                 vehId
                              );
                           }
                        });
                     }
                  }
                  // Merge NEW Multi-Component Vehicle data with cached data
                  else {

                     // Flag all data in cache as OLD
                     me._resetSensorDataInCache(vehId);

                     // Merge with Single-Component cached data
                     if (me._cache[vehId].data.vehCfg.total === 1) {
                        sensorData.vehCfg.ids.map(compId => {
                           if (compId === me._cache[vehId].data.vehCfg.active) {
                              console.log("----------------- compId = ", compId, " cache = ", me._cache[vehId].data[compId], " sdata = ", sensorData[compId]);
                              debugCacheData = JSON.stringify(me._cache[vehId].data[compId]); //DEBUG
                              debugSensorData = JSON.stringify(sensorData[compId]); //DEBUG
                              sensorData[compId] = me._mergeSensorDataIntoCache(
                                 me._cache[vehId].data[compId],
                                 sensorData[compId],
                                 compId,
                                 vehId
                              );
                           }
                        });
                        me._cache[vehId].data = sensorData;
                     }
                     // Merge with Multi-Component cached data
                     else {
                        sensorData.vehCfg.ids.map(compId => {
                           debugCacheData = JSON.stringify(me._cache[vehId].data[compId]); //DEBUG
                           debugSensorData = JSON.stringify(sensorData[compId]); //DEBUG
                           me._cache[vehId].data[compId] = me._mergeSensorDataIntoCache(
                              me._cache[vehId].data[compId],
                              sensorData[compId],
                              compId,
                              vehId
                           );
                        });
                     }
                  }

                  // Notify if no sensor data was found
                  if (me._cache[vehId].noSensorDataFound) {
                     console.log("NO NEW SENSOR DATA FOUND for this date range");
                  }

                  // Set next cache expiry
                  me._cache[vehId].expiry = moment().add(me._sensorDataLifetime, "seconds").unix();

                  // Fresh data, update cache and then send it
                  resolve(me._cache[vehId].data);
               })
               .catch((reason) => {
                  me._cache[vehId].searching = false;

                  if (me._cache[vehId].data === null) {
                     // If there was never any sensor data for this vehicle, notify User
                     console.log("---- ERROR OCCURED WHILE PROCESSING DATA for Vehicle [ " + vehName + " ]:", reason);
                     reject(reason);
                  }
                  else {
                     if (reason === me._sensorDataNotFoundMsg) {
                        console.log("NO NEW SENSOR DATA FOUND for this date range.");
                     }
                     else {
                        console.log("---- ERROR OCCURED WHILE PROCESSING DATA: " + reason);
                        console.log("---- mergeSensorDataIntoCache(): cache = ", debugCacheData, " sdata = ", debugSensorData);
                     }
                  }

                  // Resetting when we will search again for new data
                  me._cache[vehId].expiry = moment().add(me._sensorDataLifetime, "seconds").unix();

                  // Release cached stale sensor data, if explicitly requested by UI
                  if (typeof me._cache[vehId].data !== "undefined" &&
                     typeof me._onFetchReleaseStaleCachedSensorDataFlagObj[vehId] !== "undefined" &&
                     me._onFetchReleaseStaleCachedSensorDataFlagObj[vehId] === true) {
                     me._onFetchReleaseStaleCachedSensorDataFlagObj[vehId] = false;
                     resolve(me._cache[vehId].data);
                  }
                  // Nothing new with this data, so don't send anything to UI
                  else {
                     resolve({});
                  }
               });
         }
         else {
            // Release cached stale sensor data, if explicitly requested by UI
            if (typeof me._cache[vehId].data !== "undefined" &&
               typeof me._onFetchReleaseStaleCachedSensorDataFlagObj[vehId] !== "undefined" &&
               me._onFetchReleaseStaleCachedSensorDataFlagObj[vehId] === true) {
               me._onFetchReleaseStaleCachedSensorDataFlagObj[vehId] = false;
               resolve(me._cache[vehId].data);
            }
            // Nothing new with this data, so don't send anything to UI
            else {
               resolve({});
            }
         }
      });
   };

   /**
    * Method for toggling _onFetchReleaseStaleCachedSensorData flag object
    */
   this.releaseStaleCachedSensorDataOnNextFetch = function (vehId) {
      const me = this;
      if (vehId && typeof me._cache[vehId] !== "undefined" && me._cache[vehId].data) {
         me._onFetchReleaseStaleCachedSensorDataFlagObj[vehId] = true;
      }
   };

   /**
    * Standardized error response used when Library busy with search in progress
    *
    *  @returns string
    */
   this.getSensorSearchInProgressResponse = function () {
      const me = this;
      return me._sensorSearchInProgressResponse;
   };

   /**
    * Getters/Setters for _sensorDataLifetime
    * ( Minimum Value - 10 seconds )
    */
   this.getSensorDataLifetimeInSec = function () {
      const me = this;
      return me._sensorDataLifetime;
   };
   this.setSensorDataLifetimeInSec = function (seconds) {
      const me = this;
      if (seconds >= 10) {
         me._sensorDataLifetime = seconds;
      }
   };

   /**
    * Getters/Setters for firstTime
    */
   this.getFirstTime = function (vehId) {
      const me = this;
      return typeof me._cache[vehId].firstTime === "undefined" ? true : me._cache[vehId].firstTime;
   };
   this.setFirstTime = function (vehId, firstTime) {
      const me = this;
      if (typeof me._cache[vehId].firstTime !== "undefined") {
         me._cache[vehId].firstTime = firstTime;
      }
   };

   /**
    * Getters/Setters for _vehComponents
    */
   this.getVehComponents = function () {
      const me = this;
      return me._vehComponents;
   };
   this.setVehComponents = function (comLib) {
      const me = this;
      me._vehComponents = comLib;
   };

   /**
    * Getters/Setters for _sensorDataNotFoundMsg
    */
   this.getSensorDataNotFoundMsg = function () {
      const me = this;
      return me._sensorDataNotFoundMsg;
   };
   this.setSensorDataNotFoundMsg = function (msg) {
      const me = this;
      me._sensorDataNotFoundMsg = msg;
   };

   /**
    * Getters/Setters for _sensorSearchInProgressResponse
    */
   this.getSensorSearchInProgressResponseMsg = function () {
      const me = this;
      return me._sensorSearchInProgressResponse;
   };
   this.setSensorSearchInProgressResponseMsg = function (msg) {
      const me = this;
      me._sensorSearchInProgressResponse = msg;
   };

   /**
    * Delete cache for vehicle
    * If busy, recursively keep checking until free, then delete
    *
    *  @returns void
    */
   this.resetCache = function (vehId) {
      const me = this;
      if (typeof vehId !== "undefined" && vehId !== null &&
         typeof me._cache !== null &&
         typeof me._cache === "object" &&
         typeof me._cache[vehId] !== "undefined") {
         if (me._cache[vehId].searching) {
            setTimeout(() => me.resetCache(vehId), 100);
         }
         else {
            delete me._cache[vehId];
         }
      }
   };

   /**
    *  Fetch Temptrac and TPMS sensor data
    *
    *  @returns promise
    */
   this._fetchData = function (vehId) {
      const me = this;
      return new Promise((resolve, reject) => {
         const toDateOverride = liveButtonModel.getToDateOverride();
         const firstTimeCallOverride = typeof me._cache[vehId].firstTime !== "undefined" ? me._cache[vehId].firstTime : null;

         me._goLibVeh[vehId].getData(vehId, "", function (sensorData) {
            if (sensorData === null) {
               reject(me._sensorDataNotFoundMsg);
            }
            else {
               // Single-Vehicle Component found (normally TRACTOR, but we should not assume)
               if (sensorData.vehCfg.total === 1) {
                  resolve(sensorData);
               }
               // Multi-Vehicle Component(s) found (any combination of "tractor", "trailer1", "trailer2", "trailer3")
               else {
                  const vehCompFound = sensorData.vehCfg.active;
                  let ids = sensorData.vehCfg.ids.filter((id) => { return id !== vehCompFound; });
                  const data = {
                     vehCfg: sensorData.vehCfg,
                     vehId: sensorData.vehId,
                  };

                  // If toDate override supplied in parameters, return toDate property in result data
                  if (typeof sensorData.toDate !== "undefined") {
                     data.toDate = sensorData.toDate;
                  }

                  // Search & Assemble vehicle component data
                  data[vehCompFound] = {
                     temptrac: sensorData.temptrac,
                     tpmspress: sensorData.tpmspress,
                     tpmstemp: sensorData.tpmstemp,
                  };
                  sensorData.vehCfg.ids
                     .filter(compId => { return (compId !== vehCompFound); })
                     .map(compId => {
                        fetchVehSensorDataAsync(vehId, compId, me._cache[vehId].firstTime)
                           .then((sdata) => {
                              data[compId] = {
                                 temptrac: sdata.temptrac,
                                 tpmspress: sdata.tpmspress,
                                 tpmstemp: sdata.tpmstemp,
                              };
                              ids = ids.filter((id) => { return id !== compId; });
                           })
                           .catch(() => {
                              data[compId] = null;
                           })
                           .finally(() => {
                              if (ids.length === 0) {
                                 resolve(data);
                              }
                           });
                     });
               }
            }
         }, firstTimeCallOverride, toDateOverride);
      });
   };

   /**
    * Reset cached data as old, prior to merging with new data
    * by reseting all location records as originating from cache and therefore NOT new
    *
    * @param {string} vehId       - Geotab Device Id
    * @param {boolean} clearNulls - Reset stale NEW sensor readings to OLD readings
    *
    * @returns object
    */
   this._resetSensorDataInCache = function (vehId, clearNewNulls) {
      const me = this;
      const resetNewNulls = typeof clearNewNulls !== "undefined" && clearNewNulls === true ? true : false;
      me._cache[vehId].data.vehCfg.ids.map(compId => {
         ["temptrac", "tpmstemp", "tpmspress"].forEach(function (type) {
            if (typeof me._cache[vehId].data[compId] !== "undefined" &&
               me._cache[vehId].data[compId].hasOwnProperty(type) &&
               Object.keys(me._cache[vehId].data[compId][type]).length) {
               Object.keys(me._cache[vehId].data[compId][type]).forEach(function (loc) {
                  if (resetNewNulls) {
                     if (typeof me._cache[vehId].data[compId][type][loc].new !== "undefined" &&
                        me._cache[vehId].data[compId][type][loc].new === null) {
                        me._cache[vehId].data[compId][type][loc].new = false;
                     }
                  }
                  else {
                     if (typeof me._cache[vehId].data[compId][type][loc].new === "undefined") {
                        me._cache[vehId].data[compId][type][loc].new = false;
                     }
                     else {
                        if (me._cache[vehId].data[compId][type][loc].new === true) {
                           me._cache[vehId].data[compId][type][loc].new = null;
                        }
                     }
                  }
               });
            }
         });
      });
   };

   /**
    * Merge fresh sensor data with existing cache data (by sensor location)
    *
    *  @returns object
    */
   this._mergeSensorDataIntoCache = function (cache, sdata, vehCompId, vehId) {
      if (cache === null) {
         return sdata;
      }
      const me = this;
      let newSensorDataFound = false;

      // Merge new data into Cache
      ["temptrac", "tpmstemp", "tpmspress"].forEach(function (type) {
         let mergeCount = 0;

         if (sdata.hasOwnProperty(type) && Object.keys(sdata[type]).length) {
            Object.keys(sdata[type]).forEach(function (loc) {
               if (typeof cache[type][loc] !== "undefined") {
                  const cacheTime = cache[type][loc].time;
                  const sdataTime = sdata[type][loc].time;
                  if (cacheTime !== sdataTime) {
                     mergeCount++;
                     cache[type][loc] = sdata[type][loc];
                     cache[type][loc].new = true;
                     newSensorDataFound = true;
                  }
               }
               // AxleTire in sdata does not exist in cache...Insert it
               else {
                  mergeCount++;
                  cache[type][loc] = sdata[type][loc];
                  cache[type][loc].new = true;
                  newSensorDataFound = true;
               }
            });
            if (mergeCount) {
               const vehCompDesc =
                  typeof vehCompId !== "undefined" && vehCompId ?
                     me._vehComponents[vehCompId].toUpperCase() :
                     "";

               console.log("--- Found and Merged [ " + mergeCount + " ] " +
                  (type === "temptrac" ? "Temptrac" :
                     (type === "tpmstemp" ? "TPMS Temperature" :
                        "TPMS Pressure")) +
                  " sensor data records" +
                  (vehCompDesc ? " from " + vehCompDesc : "")
               );
            }
         }
      });
      if (newSensorDataFound) {
         me._cache[vehId].noSensorDataFound = false;
         me._resetSensorDataInCache(vehId, true);
      }
      return cache;
   };

   /**
    *  INIT - Constructor, When an instance gets created
    *
    *  @returns void
    */
   this._configure = function (goLibCreatorFunc) {
      if (goLibCreatorFunc && typeof goLibCreatorFunc === "function") {
         this._goLibCreatorFunc = goLibCreatorFunc;
      }
   };

   this._configure(goLibCreatorFunc);
};


/**
*  Tools for converting Vehicle Sensor Data objects into HTML presented by UI
*/
export const splSensorDataParser = {

   _lastReadTimestampUnix: 0,

   /**
    *  Generate HTML from sensor data
    *
    *  @returns string
    */
   generateSensorDataHtml: function (sdata, vehId, sdataToolsLib) {
      if (typeof sdata.vehCfg === "undefined") { return ""; }

      const me = this;
      const htmlEntities = new Html5Entities();
      const data = me._do(sdata, !sdataToolsLib.getFirstTime(vehId));
      const lastReadingLabel = splmap.tr("sensor_search_last_reading");
      const splToolsSwitchTooltip = splmap.tr("sensor_search_switchto_spltools_instruction");
      const timeWarpHtml = typeof sdata.toDate !== "undefined" ? "<strong>" + splmap.tr("sensor_search_back_in_time") + "</strong>" : "";
      const timeWarpClass = typeof sdata.toDate !== "undefined" ? "time-warp" : "";
      let headerTopHtml = "";
      let headerHtml = "";
      let contentHtml = "";

      // Render Headers
      if (data.foundTemptracSensors) {
         headerTopHtml += me._getTemptracHtml("header-top");
         headerHtml += me._getTemptracHtml("header");
      }
      if (data.foundTpmsTempSensors || data.foundTpmsPressSensors) {
         headerTopHtml += me._getTpmsHtml("header-top");
         if (data.foundTpmsTempSensors) {
            headerHtml += me._getTpmsHtml("header-temp");
         }
         if (data.foundTpmsPressSensors) {
            headerHtml += me._getTpmsHtml("header-press");
         }
      }
      sdataToolsLib.setFirstTime(vehId, false);

      // Render Content
      data.compIds.map(compId => {
         contentHtml += me._getComponentContentHtml(
            compId,
            (data.compIds.length !== 1),
            data
         );
      });

      return htmlEntities.decode(
         renderToString((
            <Fragment>
               <div className={`splTable ${timeWarpClass}`}>
                  <div className="splTableRow pointer" data-tip={`${splToolsSwitchTooltip}`} data-for="splTooltip" myclick={`navigateToSplTools('${data.vehId}','${data.vehName}')`}>
                     {`${headerTopHtml}`}
                  </div>
                  <div className="splTableRow">
                     {`${headerHtml}`}
                  </div>
                  {`${contentHtml}`}
                  <div className="splTableRow footer">
                     <div className="splTableCell"><label>{`${lastReadingLabel}`}:</label>{`${timeWarpHtml}`}{`${data.lastReadTimestamp}`}</div>
                  </div>
               </div>
               <script type="text/javascript">
                  document.addEventListener("DOMContentLoaded", function(event) {
                     refreshSplTooltips()
                  });
               </script>
            </Fragment>
         ))
      ).replace(/myclick/g, "onclick").replace(/\s+data\-reactroot\=\"\"/g, "");
   },

   _getComponentContentHtml: function (compId, showHeader, data) {
      const me = this;
      const htmlEntities = new Html5Entities();
      const firstComponentHeaderClass = compId === data.compIds[0] ? "first" : "";
      const headerTitle = showHeader ? splmap.tr(splSrv.vehCompTr.toTr[compId]) : "";
      const compHeaderHtml = headerTitle ? htmlEntities.decode(renderToString((
         <div className="splTableRow">
            <div className={`splTableCell component-header ${firstComponentHeaderClass}`}>
               {`${headerTitle}`}
            </div>
         </div>
      ))) : "";

      let compContentHtml = "";
      if (data.foundTemptracSensors) {
         compContentHtml += me._getTemptracHtml("content",
            typeof data[compId].temptracHtml !== "undefined" ?
               data[compId].temptracHtml : "&nbsp;");
      }
      if (data.foundTpmsTempSensors || data.foundTpmsPressSensors) {
         if (data.foundTpmsTempSensors) {
            compContentHtml += me._getTpmsHtml("content-temp",
               typeof data[compId].tpmsTempHtml !== "undefined" ?
                  data[compId].tpmsTempHtml : "&nbsp;");
         }
         if (data.foundTpmsPressSensors) {
            compContentHtml += me._getTpmsHtml("content-press",
               typeof data[compId].tpmsPressHtml !== "undefined" ?
                  data[compId].tpmsPressHtml : "&nbsp;");
         }
      }

      return htmlEntities.decode(renderToString((
         <Fragment>
            {`${compHeaderHtml}`}
            <div className="splTableRow">
               {`${compContentHtml}`}
            </div>
         </Fragment>
      )));
   },

   _getTemptracHtml: function (section, content) {
      const htmlEntities = new Html5Entities();
      const contentHtml = content || "";
      switch (section) {
         case "header-top":
            return renderToString((
               <div className="splTableCell header header-top temptrac"><div className="button-badge">TEMPTRAC</div></div>
            ));
            break;

         case "header":
            return renderToString((
               <div className="splTableCell header temptrac">Temp</div>
            ));
            break;

         case "content":
            return htmlEntities.decode(renderToString((
               <div className="splTableCell temptrac content-table">
                  <div className="content-body">
                     {`${contentHtml}`}
                  </div>
               </div>
            )));
            break;
      }
   },

   _getTpmsHtml: function (section, content) {
      const htmlEntities = new Html5Entities();
      const contentHtml = content || "";
      switch (section) {
         case "header-top":
            return renderToString((
               <div className="splTableCell header header-top tpms"><div className="button-badge">TPMS</div></div>
            ));
            break;

         case "header-temp":
            return renderToString((
               <div className="splTableCell header">Temp</div>
            ));
            break;

         case "header-press":
            return renderToString((
               <div className="splTableCell header">Press</div>
            ));
            break;

         case "content-temp":
         case "content-press":
            return htmlEntities.decode(renderToString((
               <div className="splTableCell content-table">
                  <div className="content-body">
                     {`${contentHtml}`}
                  </div>
               </div>
            )));
            break;
      }
   },

   /**
    *  Return vehicle sensor data HTML in a data object
    *
    *  @returns object
    */
   _do: function (sdata, isUpdate) {
      const me = this;
      const cloneData = JSON.parse(JSON.stringify(sdata)); // clone sensor data object... can't modify the original
      const compIds = cloneData.vehCfg.total === 1 ? [cloneData.vehCfg.active] : cloneData.vehCfg.ids;
      const data = {
         compIds: [],
         vehId: cloneData.vehId,
         vehName: cloneData.vehName,
         lastReadTimestamp: ""
      };
      const vehTemptracThresholdType = splSrv.getTemptracVehThresholdSetting(cloneData.vehId);
      const vehTemptracThresholdTypeHtml =
         "<span class='spl-vehicle-alert-tooltip-temptrac-label'>(" +
         splmap.tr("label_temptrac_threshold") + ": " +
         (vehTemptracThresholdType === "fridge" ? splmap.tr("label_temptrac_threshold_fri") : splmap.tr("label_temptrac_threshold_fre")) +
         ")</span>";

      me._lastReadTimestampUnix = 0;

      // Process Single/Multi-Component source sensor data
      data.foundTemptracSensors = false;
      data.foundTpmsTempSensors = false;
      data.foundTpmsPressSensors = false;
      compIds.map(compId => {

         // IF LIVE, Merge in cached Fault/Alert data into sensor data, for Vehicle component
         if (!liveButtonModel.getToDateOverride()) {
            splSrv.cache.getFaultData(cloneData.vehId).forEach(faultObj => {

               if (typeof faultObj.alert !== "undefined" &&
                  typeof faultObj.alert.type !== "undefined" &&
                  typeof faultObj.occurredOnLatestIgnition !== "undefined" &&
                  typeof faultObj.loc !== "undefined" &&
                  Array.isArray(faultObj.loc) && faultObj.loc.length &&
                  faultObj.occurredOnLatestIgnition &&
                  (
                     faultObj.alert.type === "Tire Pressure Fault" ||
                     faultObj.alert.type === "Tire Temperature Fault" ||
                     faultObj.alert.type === "TempTrac Temperature Fault"
                  )
               ) {
                  // eslint-disable-next-line complexity
                  faultObj.loc.forEach(locObj => {

                     // TempTrac Temperature Alerts
                     if (typeof locObj.vehComp !== "undefined" &&
                        typeof cloneData[compId].temptrac !== "undefined" &&
                        faultObj.alert.type === "TempTrac Temperature Fault" &&
                        locObj.vehComp === compId) {

                        const locId = "temptrac_zone" + locObj.zone;
                        if (typeof cloneData[compId].temptrac[locId] !== "undefined") {
                           if (typeof cloneData[compId].temptrac[locId].alert === "undefined" || (
                              typeof cloneData[compId].temptrac[locId].alert !== "undefined" &&
                              faultObj.time > cloneData[compId].temptrac[locId].alert.time)) {
                              cloneData[compId].temptrac[locId].alert = {
                                 time: faultObj.time,
                                 class: "alert-" + faultObj.alert.color.toLowerCase(),
                                 html:
                                    "<p class='spl-vehicle-alert-tooltip-header'>" + splmap.tr("alert_header") + ":</p>" +
                                    splmap.tr(faultObj.alert.trId) + "<br />" + vehTemptracThresholdTypeHtml + "<br />" +
                                    "@" + splSrv.convertUnixToTzHuman(faultObj.time) + "<p>"
                              };
                           }
                        }
                     }

                     // TPMS Pressure Alerts
                     if (typeof locObj.vehComp !== "undefined" &&
                        typeof cloneData[compId].tpmspress !== "undefined" &&
                        faultObj.alert.type === "Tire Pressure Fault" &&
                        locObj.vehComp === compId) {

                        const locId = "tirepress_axle" + locObj.axle + "tire" + locObj.tire;
                        if (typeof cloneData[compId].tpmspress[locId] !== "undefined") {
                           if (typeof cloneData[compId].tpmspress[locId].alert === "undefined" || (
                              typeof cloneData[compId].tpmspress[locId].alert !== "undefined" &&
                              faultObj.time > cloneData[compId].tpmspress[locId].alert.time)) {
                              cloneData[compId].tpmspress[locId].alert = {
                                 time: faultObj.time,
                                 class: "alert-" + faultObj.alert.color.toLowerCase(),
                                 html:
                                    "<p class='spl-vehicle-alert-tooltip-header'>" + splmap.tr("alert_header") + ":</p>" +
                                    splmap.tr(faultObj.alert.trId) + "<br />( " + splmap.tr("alert_tire_pressure_fault") + " )<br />" +
                                    "@" + splSrv.convertUnixToTzHuman(faultObj.time) + "<p>"
                              };
                           }
                        }
                     }

                     // TPMS Temperature Alerts
                     if (typeof locObj.vehComp !== "undefined" &&
                        typeof cloneData[compId].tpmstemp !== "undefined" &&
                        faultObj.alert.type === "Tire Temperature Fault" &&
                        locObj.vehComp === compId) {

                        const locId = "tiretemp_axle" + locObj.axle + "tire" + locObj.tire;
                        if (typeof cloneData[compId].tpmstemp[locId] !== "undefined") {
                           if (typeof cloneData[compId].tpmstemp[locId].alert === "undefined" || (
                              typeof cloneData[compId].tpmstemp[locId].alert !== "undefined" &&
                              faultObj.time > cloneData[compId].tpmstemp[locId].alert.time)) {
                              cloneData[compId].tpmstemp[locId].alert = {
                                 time: faultObj.time,
                                 class: "alert-" + faultObj.alert.color.toLowerCase(),
                                 html:
                                    "<p class='spl-vehicle-alert-tooltip-header'>" + splmap.tr("alert_header") + ":</p>" +
                                    splmap.tr(faultObj.alert.trId) + "<br />( " + splmap.tr("alert_tire_temperature_fault") + " )<br />" +
                                    "@" + splSrv.convertUnixToTzHuman(faultObj.time) + "<p>"
                              };
                           }
                        }
                     }
                  });
               }
            });
         }

         data[compId] = {};
         if (Object.keys(cloneData[compId].temptrac).length) {
            data.compIds.push(compId);
            data.foundTemptracSensors = true;
            data[compId].temptracHtml = me._genHtml(cloneData[compId].temptrac, isUpdate);
         }
         if (Object.keys(cloneData[compId].tpmstemp).length) {
            data.compIds.push(compId);
            data.foundTpmsTempSensors = true;
            data[compId].tpmsTempHtml = me._genHtml(cloneData[compId].tpmstemp, isUpdate);
         }
         if (Object.keys(cloneData[compId].tpmspress).length) {
            data.compIds.push(compId);
            data.foundTpmsPressSensors = true;
            data[compId].tpmsPressHtml = me._genHtml(cloneData[compId].tpmspress, isUpdate);
         }
      });

      // Remove duplicate component Ids
      data.compIds = [...new Set(data.compIds)];

      // Format the most recent timestamp, into human readable format
      // eg. Sa Aug 17, 2020 7:00 PM EDT
      data.lastReadTimestamp = splSrv.convertUnixToTzHuman(me._lastReadTimestampUnix);

      return data;
   },

   /**
    * Generate HTML fragment for each Sensor Data Record
    *
    *  @returns string
    */
   _genHtml: function (sdata, isUpdate) {
      const me = this;
      const keysSorted = Object.keys(sdata).sort();
      const htmlEntities = new Html5Entities();
      const sensorTimeLabel = splmap.tr("sensor_search_sensor_timestamp");
      let outHtml = "";

      keysSorted.forEach(function (loc) {
         if (sdata.hasOwnProperty(loc)) {
            const locObj = sdata[loc];
            const sensorTime = splSrv.convertUnixToTzHuman(locObj.time);
            const alertClass = typeof locObj.alert !== "undefined" && typeof locObj.alert.class !== "undefined" ? locObj.alert.class : "";
            const alertTooltipHtml = typeof locObj.alert !== "undefined" && typeof locObj.alert.html !== "undefined" ? locObj.alert.html : "";

            // Keep track of the most recent sensor data timestamp
            if (locObj.time > me._lastReadTimestampUnix) {
               me._lastReadTimestampUnix = locObj.time;
            }

            // Animate the sensor record if NEW === true
            let animationClassName = "glow-" +
               (locObj.type === "Temptrac" ?
                  (isUpdate ? "stay-on-" : "") + "temptrac" :
                  (isUpdate ? "stay-on-" : "") + "tpms"
               );
            if (typeof locObj.new !== "undefined" && locObj.new === false) {
               animationClassName = "";
            }

            // Process Temptrac Record
            if (locObj.type === "Temptrac") {
               const locHtml = me._convertLocToShortName(locObj.zone);
               outHtml += htmlEntities.decode(renderToString((
                  <div className={`${animationClassName}`} data-tip={`<div style='margin: 0px; padding: 0px; text-align: center;'>${alertTooltipHtml}<p style='margin: 0px; padding: 0px;'>${sensorTimeLabel}:</p>${sensorTime}</div>`} data-for="splTooltip">
                     <div className={`val-loc ${alertClass}`}>{`${locHtml}`}</div>
                     <div className="val-temp">{`${locObj.val.c}`} <span>&#8451;</span><p>{`${locObj.val.f}`} <span>&#8457;</span></p></div>
                  </div>
               )));
            }
            // Process TPMS-Temperature Record
            else if (locObj.type === "Tire Temperature") {
               const locHtml = me._convertLocToShortName(locObj.axle);
               outHtml += htmlEntities.decode(renderToString((
                  <div className={`${animationClassName}`} data-tip={`<div style='margin: 0px; padding: 0px; text-align: center;'>${alertTooltipHtml}<p style='margin: 0px; padding: 0px;'>${sensorTimeLabel}:</p>${sensorTime}</div>`} data-for="splTooltip">
                     <div className={`val-loc ${alertClass}`}>{`${locHtml}`}</div>
                     <div className="val-temp">{`${locObj.val.c}`} <span>&#8451;</span><p>{`${locObj.val.f}`} <span>&#8457;</span></p></div>
                  </div>
               )));
            }
            // Process TPMS-Pressure Record
            else if (locObj.type === "Tire Pressure") {
               const locHtml = me._convertLocToShortName(locObj.axle);
               outHtml += htmlEntities.decode(renderToString((
                  <div className={`${animationClassName}`} data-tip={`<div style='margin: 0px; padding: 0px; text-align: center;'>${alertTooltipHtml}<p style='margin: 0px; padding: 0px;'>${sensorTimeLabel}:</p>${sensorTime}</div>`} data-for="splTooltip">
                     <div className={`val-loc ${alertClass}`}>{`${locHtml}`}</div>
                     <div className="val-pres">{`${locObj.val.psi}`} <span>Psi</span><p>{`${locObj.val.kpa}`} <span>kPa</span></p><p>{`${locObj.val.bar}`} <span>Bar</span></p></div>
                  </div>
               )));
            }
         }
      });
      return outHtml;
   },

   /**
   * Convert Location Title/Label to ShortName equivelant
   * eg. "Axle 1 Tire 2" => "A1-T2"
   *
   *  @returns string
   */
   _convertLocToShortName: function (locLabel) {
      if (locLabel) {
         return locLabel.indexOf("one") > -1 ?
            locLabel :
            locLabel
               .replace("Axle ", "A")
               .replace("Tire ", "T")
               .replace(" ", "-");
      }
      return "";
   },

   /**
   * Convert Location Array of Objects to HTML string
   * [0: {axle: 1, tire: 2, vehComp: "tractor"}] => "<div><span>Axle 1 Tire 2 &hyphen; Tractor</span></div>"
   *     OR
   * [0: {zone: "1", vehComp: "tractor"}] => "<div><span>Zone 1 &hyphen; Tractor</span></div>"
   *
   *  @returns string
   */
   convertLocArrObjToLocHtml: function (locArr) {
      const me = this;
      if (typeof locArr !== "undefined" && locArr !== null &&
         Array.isArray(locArr) && locArr.length) {
         let locHtml = "";
         locArr.forEach(locObj => {
            const locStr = (typeof locObj.zone !== "undefined" ?
               "Zone " + locObj.zone :
               "Axle " + locObj.axle + " Tire " + locObj.tire) +
               " &hyphen; " + splSrv.vehCompDb.names[locObj.vehComp];
            locHtml += "<span>" + me._locTr(locStr) + "</span>";
         });
         return '<div class="spl-vehicle-alert-tooltip-location-items">' + locHtml + "</div>";
      }
      return "";
   },

   _locTr: function (rawVal) {
      let val = rawVal.toString().trim();
      if (val) {
         val = val.replace("Zone", splmap.tr("alert_desc_zone"));
         val = val.replace("Axle", splmap.tr("alert_desc_axle"));
         val = val.replace("Tire", splmap.tr("alert_desc_tire"));
         val = val.replace("Tractor", splmap.tr("alert_desc_tractor"));
         val = val.replace("Trailer", splmap.tr("alert_desc_trailer"));
         val = val.replace("Dolly", splmap.tr("alert_desc_dolly"));
      }
      return val;
   }
};