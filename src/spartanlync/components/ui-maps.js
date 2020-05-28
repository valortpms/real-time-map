// eslint-disable-next-line no-unused-vars
import React, { Fragment } from "react";
import moment from "moment-timezone";
import splSrv from "../services";
import { renderToString } from "react-dom/server";
import { Html5Entities } from "html-entities";
import { fetchVehSensorData, splSensorDataParser } from "../services/api/temptrac-tpms/utils";

/**
 *  Manage the Vehicle Sensor Data shown on Map
 */
export const splSensorDb = {

   _sensorDataLifetime: 180,                 // (Default: 180 seconds) Afer this period, cached data is refreshed from API (in seconds)

   _sensorSearchInProgressResponse: "BUSY",  // Do not allow simultaneous searches on the same vehicle
   _cache: {},

   /**
    *  Return in DIV HTML containing vehicle sensor data
    *
    *  @returns string
    */
   getVehSensorDataDiv: function (vehId, vehName) {
      const me = this;
      return new Promise((resolve, reject) => {
         me._fetchCachedSensorData(vehId, vehName)
            .then((sensorData) => {
               const splHtml = me._generateSensorDataHtml(sensorData);
               resolve(splHtml ? `<p class="SPL-popupSensor"> ${splHtml} </p>` : "");
            })
            .catch((reason) => {
               reject(reason === me._sensorSearchInProgressResponse ? "" : `<p class="SPL-popupSensor"> ${reason} </p>`);
            });
      });
   },

   /**
    * Getters/Setters for _sensorDataLifetime
    * ( Minimum Value - 10 seconds )
    */
   get sensorDataLifetimeInSec() {
      const me = this;
      return me._sensorDataLifetime;
   },
   set sensorDataLifetimeInSec(seconds) {
      const me = this;
      if (seconds >= 10) {
         me._sensorDataLifetime = seconds;
      }
   },

   /**
    * Clear the Sensor data cache of all vehicles
    * IF a SEARCH OPERATION is NOT occuring
    *
    *  @returns object
    */
   clearCache: function () {
      const me = this;
      for (const vehId in me._cache) {
         if (me._cache[vehId].searching) {
            return false;
         }
      }
      me._cache = {};
   },

   /**
    * Fetch vehicle sensor data from cache or API
    * ( cached is refreshed after X minutes, as defined in _sensorDataLifetime )
    *
    *  @returns object
    */
   _fetchCachedSensorData: function (vehId, vehName) {
      const me = this;
      return new Promise((resolve, reject) => {
         if (typeof me._cache[vehId] === "undefined") {
            me._cache[vehId] = {
               searching: false,
               expiry: moment().utc().add(me._sensorDataLifetime, "seconds").unix(),
               data: null
            };
         }
         // Do not allow simultaneous searches on the same vehicle
         if (me._cache[vehId].searching) {
            reject(me._sensorSearchInProgressResponse);
         }
         else if (me._cache[vehId].data === null || me._cache[vehId].expiry < moment().utc().unix()) {
            me._cache[vehId].searching = true;

            // On first-time search of a vehicle
            // In Geotab library, reset the Sensor Search Parameters to a new Vehicle configuration
            if (me._cache[vehId].data === null) {
               splSrv.goLib.resetAsFirstTime();
            }

            //Splunk for sensor data
            fetchVehSensorData(vehId)
               .then((sensorData) => {
                  me._cache[vehId].searching = false;

                  // Save Vehicle Name
                  sensorData.vehName = vehName;

                  // Report on what we found on the initial search only,
                  // Reporting on Repeat searches will be handled by the data merging code
                  if (me._cache[vehId].data === null) {
                     console.log("--- NEW SENSOR DATA FOUND after the last search.  " +
                        "Temptrac [" + Object.keys(sensorData.temptrac).length + "]  " +
                        "TPMS Temperature [" + Object.keys(sensorData.tpmstemp).length + "]  " +
                        "TPMS Pressure [" + Object.keys(sensorData.tpmspress).length + "]"
                     );
                  }

                  // Merge new data with cached data
                  me._cache[vehId].expiry = moment().utc().add(me._sensorDataLifetime, "seconds").unix();
                  me._cache[vehId].data = me._mergeSensorDataIntoCache(me._cache[vehId].data, sensorData);

                  // Fresh data, update cache and then send it
                  resolve(me._cache[vehId].data);
               })
               .catch((reason) => {
                  me._cache[vehId].searching = false;

                  if (me._cache[vehId].data === null) {
                     // If there was never any sensor data for this vehicle, notify User
                     console.log("--- fetchVehSensorData() Vehicle '" + vehName + "' Error: ", reason);
                     reject(reason);
                  }
                  else {
                     console.log("--- No NEW Sensor Data Found for this date range");
                  }

                  // Keep sending the cached data
                  // as it's the best data we have for that search period.
                  // while resetting when we will search again for new data
                  me._cache[vehId].expiry = moment().utc().add(me._sensorDataLifetime, "seconds").unix();
                  resolve(me._cache[vehId].data);  // PRODUCTION USAGE
                  //resolve({}); // FOR DEBUGGING UI
               });
         }
         else {
            // Data from cache is fresh, send it
            resolve(me._cache[vehId].data);  // PRODUCTION USAGE
            //resolve({}); // FOR DEBUGGING UI
         }
      });
   },

   /**
    * Merge fresh sensor data with existing cache data (by sensor location)
    *
    *  @returns object
    */
   _mergeSensorDataIntoCache: function (cache, sdata) {
      if (cache === null) {
         return sdata;
      }
      ["temptrac", "tpmstemp", "tpmspress"].forEach(function (type) {
         if (sdata.hasOwnProperty(type) && Object.keys(sdata[type]).length) {
            console.log("--- Found and Merged [ " + Object.keys(sdata[type]).length + " ] " +
               (type === "temptrac" ? "Temptrac" :
                  (type === "tpmstemp" ? "TPMS Temperature" :
                     "TPMS Pressure")) +
               " sensor data records"
            );
            Object.keys(sdata[type]).forEach(function (loc) {
               cache[type][loc] = sdata[type][loc];
            });
         }
      });
      return cache;
   },

   /**
    *  Generate HTML from sensor data
    *
    *  @returns string
    */
   _generateSensorDataHtml: function (sdata) {
      if (typeof sdata.vehCfg === "undefined") { return ""; }
      const me = this;
      const htmlEntities = new Html5Entities();
      const data = splSensorDataParser.do(sdata);
      let headerTopHtml = "";
      let headerHtml = "";
      let contentHtml = "";

      if (data.foundTemptracSensors) {
         headerTopHtml += me._getTemptracHtml("header-top");
         headerHtml += me._getTemptracHtml("header");
         contentHtml += me._getTemptracHtml("content", data.temptracHtml);
      }
      if (data.foundTpmsTempSensors || data.foundTpmsPressSensors) {
         headerTopHtml += me._getTpmsHtml("header-top");
         if (data.foundTpmsTempSensors) {
            headerHtml += me._getTpmsHtml("header-temp");
            contentHtml += me._getTpmsHtml("content-temp", data.tpmsTempHtml);
         }
         if (data.foundTpmsPressSensors) {
            headerHtml += me._getTpmsHtml("header-press");
            contentHtml += me._getTpmsHtml("content-press", data.tpmsPressHtml);
         }
      }

      return htmlEntities.decode(
         renderToString((
            <div className="splTable">
               <div className="splTableRow pointer" title="View In SpartanLync Tools" myclick={`navigateToSplTools('${data.vehId}','${data.vehName}')`}>
                  {`${headerTopHtml}`}
               </div>
               <div className="splTableRow">
                  {`${headerHtml}`}
               </div>
               <div className="splTableRow">
                  {`${contentHtml}`}
               </div>
               <div className="splTableRow footer">
                  <div className="splTableCell"><label>Last Reading:</label>{`${data.lastReadTimestamp}`}</div>
               </div>
            </div>
         ))
      ).replace(/myclick/g, "onclick").replace(/\s+data\-reactroot\=\"\"/g, "");
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
               <Fragment>
                  <div className="splTableCell header">Temp</div>
               </Fragment>
            ));
            break;

         case "header-press":
            return renderToString((
               <Fragment>
                  <div className="splTableCell header">Press</div>
               </Fragment>
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
   }
};
