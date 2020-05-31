// eslint-disable-next-line no-unused-vars
import React, { Fragment } from "react";
import moment from "moment-timezone";
import splSrv from ".";
import { renderToString } from "react-dom/server";
import { Html5Entities } from "html-entities";

/**
 *  Manage / Generate cached Vehicle Sensor data as HTML output to UI
 */
export const INITSplSensorDataTools = function (goLib) {

   /**
    *  Private Variables
    */
   this._sensorDataLifetime = 180;                 // (Default: 180 seconds) Afer this period, cached data is refreshed from API (in seconds)
   this._sensorSearchInProgressResponse = "BUSY";  // Do not allow simultaneous searches on the same vehicle

   this._goLib = null;
   this._cache = null;

   /**
    * Fetch vehicle sensor data from cache or API
    * ( cached is refreshed after X minutes, as defined in _sensorDataLifetime )
    *
    *  @returns object / string (on Error)
    */
   this.fetchCachedSensorData = function (vehId, vehName) {
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
               me._goLib.resetAsFirstTime();
            }

            //Splunk for sensor data
            me._fetchData(vehId)
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
                     console.log("---- Vehicle [ " + vehName + " ] Error:", reason);
                     reject(reason);
                  }
                  else {
                     console.log("---- No NEW Sensor Data Found for this date range");
                  }

                  // Resetting when we will search again for new data
                  me._cache[vehId].expiry = moment().utc().add(me._sensorDataLifetime, "seconds").unix();

                  // (** DEPRECATED **) Keep sending the cached data, as it's the best data we have for that search period.
                  //resolve(me._cache[vehId].data);

                  // Nothing new with this data, so don't send anything to UI
                  resolve({});
               });
         }
         else {
            // (** DEPRECATED **) Data from cache is fresh, send it
            //resolve(me._cache[vehId].data);

            // Nothing new with this data, so don't send anything to UI
            resolve({});
         }
      });
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
    * Clear the Sensor data cache of all vehicles
    * IF a SEARCH OPERATION is NOT occuring
    *
    *  @returns boolean
    */
   this.resetCache = function () {
      const me = this;
      for (const vehId in me._cache) {
         if (me._cache[vehId].searching) {
            return false;
         }
      }
      me._cache = {};
      return true;
   };

   /**
    *  Generate HTML from sensor data
    *
    *  @returns string
    */
   this.generateSensorDataHtml = function (sdata) {
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
            <Fragment>
               <div className="splTable">
                  <div className="splTableRow pointer" data-tip="View In SpartanLync Tools" data-for="splTooltip" myclick={`navigateToSplTools('${data.vehId}','${data.vehName}')`}>
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
               <script type="text/javascript">
                  document.addEventListener("DOMContentLoaded", function(event) {
                     refreshSplTooltips()
                  });
               </script>
            </Fragment>
         ))
      ).replace(/myclick/g, "onclick").replace(/\s+data\-reactroot\=\"\"/g, "");
   };

   this._getTemptracHtml = function (section, content) {
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
   };

   this._getTpmsHtml = function (section, content) {
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
   };

   /**
    *  Fetch Temptrac and TPMS sensor data
    *
    *  @returns object / string (on Error)
    */
   this._fetchData = function (vehId) {
      const me = this;
      return new Promise((resolve, reject) => {
         me._goLib.getData(vehId, "", function (sensorData) {
            if (sensorData === null) {
               reject(splSrv.sensorDataNotFoundMsg);
            }
            else {
               resolve(sensorData);
            }
         });
      });
   };

   /**
    * Merge fresh sensor data with existing cache data (by sensor location)
    *
    *  @returns object
    */
   this._mergeSensorDataIntoCache = function (cache, sdata) {
      if (cache === null) {
         return sdata;
      }

      // Reset all records in cache as originating from cache and therefore NOT new
      ["temptrac", "tpmstemp", "tpmspress"].forEach(function (type) {
         if (cache.hasOwnProperty(type) && Object.keys(cache[type]).length) {
            Object.keys(cache[type]).forEach(function (loc) {
               cache[type][loc].new = false;
            });
         }
      });

      // Merge new data into Cache
      ["temptrac", "tpmstemp", "tpmspress"].forEach(function (type) {
         let mergeCount = 0;

         if (sdata.hasOwnProperty(type) && Object.keys(sdata[type]).length) {
            Object.keys(sdata[type]).forEach(function (loc) {
               if (cache[type][loc].time !== sdata[type][loc].time) {
                  mergeCount++;
                  cache[type][loc] = sdata[type][loc];
                  cache[type][loc].new = true;
               }
            });
            if (mergeCount) {
               console.log("--- Found and Merged [ " + mergeCount + " ] " +
                  (type === "temptrac" ? "Temptrac" :
                     (type === "tpmstemp" ? "TPMS Temperature" :
                        "TPMS Pressure")) +
                  " sensor data records"
               );
            }
         }
      });
      return cache;
   };

   /**
    *  INIT - Constructor, When an instance gets created
    *
    *  @returns void
    */
   this._configure = function (goLib) {
      if (goLib && typeof goLib === "object") {
         this._goLib = goLib;
      }
      this._cache = {};
   };

   this._configure(goLib);
};


/**
*  Tools for converting Vehicle Sensor Data objects into HTML presented by UI
*/
export const splSensorDataParser = {

   _lastReadTimestampUnix: 0,

   /**
    *  Return vehicle sensor data HTML in a data object
    *
    *  @returns object
    */
   do: function (sdata) {
      const me = this;
      const data = {
         vehId: sdata.vehId,
         vehName: sdata.vehName,
         lastReadTimestamp: ""
      };
      me._lastReadTimestampUnix = 0;

      if (Object.keys(sdata.temptrac).length) {
         data.foundTemptracSensors = true;
         data.temptracHtml = me._genHtml(sdata.temptrac);
      }
      if (Object.keys(sdata.tpmstemp).length) {
         data.foundTpmsTempSensors = true;
         data.tpmsTempHtml = me._genHtml(sdata.tpmstemp);
      }
      if (Object.keys(sdata.tpmspress).length) {
         data.foundTpmsPressSensors = true;
         data.tpmsPressHtml = me._genHtml(sdata.tpmspress);
      }

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
   _genHtml: function (sdata) {
      const me = this;
      const keysSorted = Object.keys(sdata).sort();
      const htmlEntities = new Html5Entities();
      let outHtml = "";

      keysSorted.forEach(function (loc) {
         if (sdata.hasOwnProperty(loc)) {
            const locObj = sdata[loc];
            const sensorTime = splSrv.convertUnixToTzHuman(locObj.time);

            // Keep track of the most recent sensor data timestamp
            if (locObj.time > me._lastReadTimestampUnix) {
               me._lastReadTimestampUnix = locObj.time;
            }

            // Animate the sensor record if NEW
            let animationClassName = "glow-" + (locObj.type === "Temptrac" ? "temptrac" : "tpms");
            if (typeof locObj.new !== "undefined" && locObj.new === false) {
               animationClassName = "";
            }

            // Process Temptrac Record
            if (locObj.type === "Temptrac") {
               const locHtml = me._convertLocToShortName(locObj.zone);
               outHtml += htmlEntities.decode(renderToString((
                  <div className={`${animationClassName}`} data-tip={`<div style='margin: 0px; padding: 0px; text-align: center;'><p style='margin: 0px; padding: 0px;'>Sensor Timestamp:</p>${sensorTime}</div>`} data-for="splTooltip">
                     <div className="val-loc">{`${locHtml}`}</div>
                     <div className="val-temp">{`${locObj.val.c}`} <span>&#8451;</span><p>{`${locObj.val.f}`} <span>&#8457;</span></p></div>
                  </div>
               )));
            }
            // Process TPMS-Temperature Record
            else if (locObj.type === "Tire Temperature") {
               const locHtml = me._convertLocToShortName(locObj.axle);
               outHtml += htmlEntities.decode(renderToString((
                  <div className={`${animationClassName}`} data-tip={`<div style='margin: 0px; padding: 0px; text-align: center;'><p style='margin: 0px; padding: 0px;'>Sensor Timestamp:</p>${sensorTime}</div>`} data-for="splTooltip">
                     <div className="val-loc">{`${locHtml}`}</div>
                     <div className="val-temp">{`${locObj.val.c}`} <span>&#8451;</span><p>{`${locObj.val.f}`} <span>&#8457;</span></p></div>
                  </div>
               )));
            }
            // Process TPMS-Pressure Record
            else if (locObj.type === "Tire Pressure") {
               const locHtml = me._convertLocToShortName(locObj.axle);
               outHtml += htmlEntities.decode(renderToString((
                  <div className={`${animationClassName}`} data-tip={`<div style='margin: 0px; padding: 0px; text-align: center;'><p style='margin: 0px; padding: 0px;'>Sensor Timestamp:</p>${sensorTime}</div>`} data-for="splTooltip">
                     <div className="val-loc">{`${locHtml}`}</div>
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
   }
};