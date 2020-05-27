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

   _sensorDataLifetime: 180,  // (Default: 180 seconds) Afer this period, cached data is refreshed from API (in seconds)
   _cache: {},

   /**
    *  Return in DIV HTML containing vehicle sensor data
    *
    *  @returns string
    */
   getVehSensorDataDiv: function (vehId, vehName) {
      const me = this;
      me.sensorDataLifetimeInSec = splSrv.sensorDataLifetime;

      return new Promise((resolve, reject) => {
         me._fetchCachedSensorData(vehId, vehName)
            .then((sensors) => {
               const splHtml =
                  me._generateSensorDataHtml(sensors)
                     .replace(/myclick/g, "onclick")
                     .replace(/\s+data\-reactroot\=\"\"/g, "");
               resolve(splHtml ? `<p class="SPL-popupSensor"> ${splHtml} </p>` : "");
            })
            .catch((reason) => {
               reject(`<p class="SPL-popupSensor"> ${reason} </p>`);
            });
      });
   },

   /**
    *  Getters/Setters for _sensorDataLifetime
    */
   get sensorDataLifetimeInSec() {
      const me = this;
      return me._sensorDataLifetime;
   },
   set sensorDataLifetimeInSec(seconds) {
      const me = this;
      if (seconds > 10) {
         me._sensorDataLifetime = seconds;
      }
   },

   /**
    * Fetch vehicle sensor data from cached or API
    * ( cached is refreshed after XX minutes, as defined in _sensorDataLifetime )
    *
    *  @returns object
    */
   _fetchCachedSensorData: function (vehId, vehName) {
      const me = this;
      return new Promise((resolve, reject) => {
         if (typeof me._cache[vehId] === "undefined") {
            me._cache[vehId] = {
               expiry: moment().utc().add(me._sensorDataLifetime, "seconds").unix(),
               data: null
            };
         }
         if (me._cache[vehId].data === null || me._cache[vehId].expiry < moment().utc().unix()) {
            fetchVehSensorData(vehId)
               .then((sensors) => {
                  // Save Vehicle Name
                  sensors.vehName = vehName;

                  // Store it
                  me._cache[vehId] = {
                     expiry: moment().utc().add(me._sensorDataLifetime, "seconds").unix(),
                     data: sensors
                  };
                  // Fresh data, update cache and then send it
                  resolve(me._cache[vehId].data);
               })
               .catch((reason) => {
                  if (me._cache[vehId].data === null) {
                     // If there was never any sensor data for this vehicle, notify User
                     console.log("fetchVehSensorData() Vehicle '" + vehName + "' Error: ", reason);
                     reject(reason);
                  }
                  // Keep sending the cached data
                  // as it's the best data we have for that search period.
                  // while resetting when we will search again for new data
                  me._cache[vehId].expiry = moment().utc().add(me._sensorDataLifetime, "seconds").unix();
                  resolve(me._cache[vehId].data);  //resolve({});  FOR DEBUGGING UI
               });
         }
         else {
            // Data from cache is fresh, send it
            resolve(me._cache[vehId].data);  //resolve({});  FOR DEBUGGING UI
         }
      });
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

      return htmlEntities.decode(renderToString((
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
