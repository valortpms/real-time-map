// eslint-disable-next-line no-unused-vars
import React from "react";
import moment from "moment-timezone";
import splSrv from "../..";
import { renderToString } from "react-dom/server";

/**
 *  Fetch Temptrac and TPMS sensor data
 */
export function fetchVehSensorData(vehId) {
   return new Promise((resolve, reject) => {
      splSrv.goLib.getData(vehId, "", function (sensorData) {
         if (sensorData === null) {
            reject("No Sensors Found");
         } else {
            resolve(sensorData);
         }
      });
   });
};

/**
 *  Convert Vehicle Sensor Data objects into HTML presented by UI
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
      data.lastReadTimestamp = me._convertUnixToTzHuman(me._lastReadTimestampUnix);

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
      let outHtml = "";

      keysSorted.forEach(function (loc) {
         if (sdata.hasOwnProperty(loc)) {
            const locObj = sdata[loc];
            const sensorTime = me._convertUnixToTzHuman(locObj.time);

            // Keep track of the most recent sensor data timestamp
            if (locObj.time > me._lastReadTimestampUnix) {
               me._lastReadTimestampUnix = locObj.time;
            }

            // Process Temptrac Record
            if (locObj.type === "Temptrac") {
               const locHtml = me._convertLocToShortName(locObj.zone);
               outHtml += renderToString((
                  <div title={`Sensor Timestamp: ${sensorTime}`}>
                     <div className="val-loc">{`${locHtml}`}</div>
                     <div className="val-temp">{`${locObj.val.c}`} <span>&#8451;</span><p>{`${locObj.val.f}`} <span>&#8457;</span></p></div>
                  </div>
               ));
            }
            // Process TPMS-Temperature Record
            else if (locObj.type === "Tire Temperature") {
               const locHtml = me._convertLocToShortName(locObj.axle);
               outHtml += renderToString((
                  <div title={`Sensor Timestamp: ${sensorTime}`}>
                     <div className="val-loc">{`${locHtml}`}</div>
                     <div className="val-temp">{`${locObj.val.c}`} <span>&#8451;</span><p>{`${locObj.val.f}`} <span>&#8457;</span></p></div>
                  </div>
               ));
            }
            // Process TPMS-Pressure Record
            else if (locObj.type === "Tire Pressure") {
               const locHtml = me._convertLocToShortName(locObj.axle);
               outHtml += renderToString((
                  <div title={`Sensor Timestamp: ${sensorTime}`}>
                     <div className="val-loc">{`${locHtml}`}</div>
                     <div className="val-pres">{`${locObj.val.psi}`} <span>Psi</span><p>{`${locObj.val.kpa}`} <span>kPa</span></p><p>{`${locObj.val.bar}`} <span>Bar</span></p></div>
                  </div>
               ));
            }
         }
      });
      return outHtml;
   },

   /**
    * Convert from Unix timestamp to Human-readable time
    * eg. Sa Aug 17, 2020 7:00 PM EDT
    *
    *  @returns string
    */
   _convertUnixToTzHuman: function (unixTime) {
      return isNaN(unixTime) ? null : moment.unix(unixTime).format(splSrv.splHumanTimeFormat);
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
