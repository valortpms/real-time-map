import L from "leaflet";
import splSrv from "../../../../spartanlync/services";
import storage from "../../../../dataStore";
import layersModel from "../../layers";
import { getLatLngsForTimeRange } from "../../utils/device-data-helpers";
import { bindDeviceNamePopup } from "../../popups/path-popups";
import { colorHexCodes } from "../../../../constants/color-hex-codes";

//create new path, every path must belong to a marker.
export function initHistoricPath(deviceMarker) {

   const {
      deviceID,
      deviceData,
   } = deviceMarker;

   const latLngList = getLatLngsForTimeRange(storage.timeRangeStart, storage.currentTime, deviceData, deviceID);
   const polyline = L.polyline(latLngList, {
      smoothFactor: 1,
      weight: 3,
      color: colorHexCodes.geotabBlue //DEBUG  geotabBlue testLimeGreen
   });

   const historicPathConstructors = {
      deviceID,
      deviceData,
      polyline
   };

   const newHistoricPath = {
      ...historicPathModel,
      ...historicPathConstructors
   };

   layersModel.addToMovingLayer(polyline);
   bindDeviceNamePopup(deviceID, polyline, "historical");
   return newHistoricPath;
}

export const historicPathModel = {
   deviceID: undefined,
   deviceData: undefined,
   polyline: undefined,
   delayedInterval: undefined,

   timeChangedUpdate(currentSecond) {
      clearTimeout(this.delayedInterval);
      this.delayedInterval = null;
      const latLngs = getLatLngsForTimeRange(storage.timeRangeStart, currentSecond, this.deviceData, this.deviceID);
      this.polyline.setLatLngs(latLngs);

      // Throw Event notifying of creation of new Historic Path polyline on map
      if (typeof storage.selectedDevices[this.deviceID] !== "undefined") {
         splSrv.events.exec("onHistoricPathCreatedOrUpdated", this.deviceID, this.polyline.getLatLngs());
      }
   },

   updateHistoricPath(currentSecond, realLatLng) {
      this.delayedInterval = setTimeout(() => {
         this.polyline.addLatLng(realLatLng);

         // Throw Event notifying of new point added to Historic Path polyline on map
         if (typeof storage.selectedDevices[this.deviceID] !== "undefined") {
            splSrv.events.exec("onHistoricPathCreatedOrUpdated", this.deviceID, this.polyline.getLatLngs());
         }

      }, storage.dateKeeper$.getPeriod() * 0.75);
   },
};